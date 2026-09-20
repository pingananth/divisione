-- D229 conference registration schema.
--
-- Money is stored as integer paise everywhere. Never use a float type for an
-- amount: a half-paise rounding error becomes a payment that will not reconcile.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table events (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  venue           text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,

  -- Each Division collects into its own account.
  upi_vpa         text not null,
  upi_payee_name  text not null,
  -- Short code embedded in the UPI transaction note, e.g. 'E' for Division E.
  ref_prefix      text not null,

  -- [{ id, label, amountPaise, endsAt }] — see lib/pricing.ts.
  tiers           jsonb not null default '[]'::jsonb,
  -- Subset of: club, area, division, mealPreference, tshirtSize.
  enabled_fields  text[] not null default '{}',

  support_email   text not null,
  registration_open boolean not null default true,
  created_at      timestamptz not null default now(),

  constraint events_dates_ordered check (ends_at >= starts_at),
  constraint events_tiers_is_array check (jsonb_typeof(tiers) = 'array')
);

-- ---------------------------------------------------------------------------
-- Registrations
-- ---------------------------------------------------------------------------

create type registration_status as enum ('pending', 'confirmed', 'rejected');

create table registrations (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,

  -- Short human-quotable code printed on the ticket and read out at the desk.
  ticket_id         text not null unique,

  full_name         text not null,
  email             text not null,
  phone             text not null,

  club              text,
  area              text,
  division          text,
  meal_preference   text,
  tshirt_size       text,

  tier_id           text not null,
  amount_due_paise  integer not null check (amount_due_paise > 0),

  status            registration_status not null default 'pending',
  -- Free-text note from the organiser when they confirm or reject by hand.
  review_note       text,
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,

  created_at        timestamptz not null default now()
);

create index registrations_event_status_idx on registrations (event_id, status, created_at desc);
create index registrations_email_idx on registrations (lower(email));

-- Deliberately NOT unique on (event_id, email): members routinely register a
-- spouse or guest under one email address, and a unique constraint would block
-- that. Genuine duplicates are caught instead by the unique UTR below, since a
-- second real payment always carries a different reference.

-- ---------------------------------------------------------------------------
-- Payment claims — the UTR an attendee submits after paying
-- ---------------------------------------------------------------------------

create table payment_claims (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references registrations(id) on delete cascade,

  utr              text not null check (utr ~ '^[0-9]{12}$'),
  screenshot_path  text,

  -- Populated by reconciliation once a bank credit is matched.
  matched_row_id   uuid,
  matched_at       timestamptz,

  created_at       timestamptz not null default now()
);

create unique index payment_claims_one_per_registration
  on payment_claims (registration_id);

-- A UPI reference identifies exactly one payment, so it may back exactly one
-- registration. This rejects a reused reference at submission time with a clear
-- message rather than letting two people both claim one payment.
-- lib/reconcile.ts still detects duplicates as defence in depth, for rows
-- imported from the old process or edited by hand.
create unique index payment_claims_utr_unique on payment_claims (utr);

-- ---------------------------------------------------------------------------
-- Bank statements
-- ---------------------------------------------------------------------------

create table statement_uploads (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  filename      text not null,
  uploaded_by   uuid references auth.users(id),
  row_count     integer not null default 0,
  skipped_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create table statement_rows (
  id             uuid primary key default gen_random_uuid(),
  upload_id      uuid not null references statement_uploads(id) on delete cascade,
  event_id       uuid not null references events(id) on delete cascade,

  utr            text not null check (utr ~ '^[0-9]{12}$'),
  amount_paise   integer not null check (amount_paise > 0),
  value_date     text not null,
  -- Kept verbatim: this is the audit trail back to the bank.
  narration      text not null,

  created_at     timestamptz not null default now()
);

-- Re-uploading an overlapping statement must not duplicate credits.
create unique index statement_rows_unique_credit
  on statement_rows (event_id, utr, amount_paise);

create index statement_rows_event_utr_idx on statement_rows (event_id, utr);

create table reconciliation_runs (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  run_by          uuid references auth.users(id),
  confirmed       integer not null default 0,
  amount_mismatch integer not null default 0,
  duplicate_claim integer not null default 0,
  unmatched       integer not null default 0,
  unclaimed_credits integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Email outbox
-- ---------------------------------------------------------------------------

create type outbox_status as enum ('pending', 'sent', 'failed');

create table email_outbox (
  id                  uuid primary key default gen_random_uuid(),
  registration_id     uuid references registrations(id) on delete cascade,

  -- '<registration id>:<template>' — the guarantee that a member is never told
  -- twice that they are confirmed, however often reconciliation re-runs.
  idempotency_key     text not null unique,

  recipient           text not null,
  template            text not null,
  data                jsonb not null,

  status              outbox_status not null default 'pending',
  attempts            integer not null default 0,
  next_attempt_at     timestamptz not null default now(),
  last_error          text,
  provider            text,
  provider_message_id text,
  sent_at             timestamptz,

  created_at          timestamptz not null default now()
);

create index email_outbox_due_idx
  on email_outbox (next_attempt_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Organisers
-- ---------------------------------------------------------------------------

create table event_organisers (
  event_id  uuid not null references events(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  primary key (event_id, user_id)
);

create or replace function organises_event(target_event uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from event_organisers
    where event_id = target_event and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Default posture is deny. Public registration writes go through server-side
-- code holding the service role key, which bypasses RLS; the anon key can only
-- read the public face of an open event. Organisers read and write their own
-- event and nothing else, so one Division cannot see another Division's
-- registrant list or bank rows.
-- ---------------------------------------------------------------------------

alter table events              enable row level security;
alter table registrations       enable row level security;
alter table payment_claims      enable row level security;
alter table statement_uploads   enable row level security;
alter table statement_rows      enable row level security;
alter table reconciliation_runs enable row level security;
alter table email_outbox        enable row level security;
alter table event_organisers    enable row level security;

create policy events_public_read on events
  for select to anon, authenticated
  using (registration_open);

create policy events_organiser_all on events
  for all to authenticated
  using (organises_event(id))
  with check (organises_event(id));

create policy registrations_organiser_all on registrations
  for all to authenticated
  using (organises_event(event_id))
  with check (organises_event(event_id));

create policy payment_claims_organiser_all on payment_claims
  for all to authenticated
  using (exists (
    select 1 from registrations r
    where r.id = payment_claims.registration_id and organises_event(r.event_id)
  ))
  with check (exists (
    select 1 from registrations r
    where r.id = payment_claims.registration_id and organises_event(r.event_id)
  ));

create policy statement_uploads_organiser_all on statement_uploads
  for all to authenticated
  using (organises_event(event_id))
  with check (organises_event(event_id));

create policy statement_rows_organiser_all on statement_rows
  for all to authenticated
  using (organises_event(event_id))
  with check (organises_event(event_id));

create policy reconciliation_runs_organiser_all on reconciliation_runs
  for all to authenticated
  using (organises_event(event_id))
  with check (organises_event(event_id));

create policy event_organisers_self_read on event_organisers
  for select to authenticated
  using (user_id = auth.uid());

-- email_outbox has no policy at all: only the service role touches it.
