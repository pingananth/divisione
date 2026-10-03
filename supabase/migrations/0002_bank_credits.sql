-- Automatic payment matching.
--
-- Credits move from per-event statement rows to a per-account table. A bank
-- alert names the receiving account, not a conference, so credits have to be
-- stored against the account and matched to events through it. UTRs are
-- unique across the UPI network, so one table keyed by UTR is safe.

-- ---------------------------------------------------------------------------
-- Which account each event collects into
-- ---------------------------------------------------------------------------

-- Last 4 digits only: that is all a bank alert shows, and all we need.
-- Required before an event's statement can be uploaded or matched.
alter table events
  add column account_last4 text
    check (account_last4 is null or account_last4 ~ '^[0-9]{4}$');

-- ---------------------------------------------------------------------------
-- Credits, from any source
-- ---------------------------------------------------------------------------

create type credit_source as enum ('csv', 'email');

create table bank_credits (
  id                    uuid primary key default gen_random_uuid(),

  account_last4         text check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),

  -- One row per real payment, however many times it is reported.
  utr                   text not null unique check (utr ~ '^[0-9]{12}$'),
  amount_paise          integer not null check (amount_paise > 0),

  -- Exact credit time when the source gives one (alerts do, CSVs do not).
  credited_at           timestamptz,
  value_date            text not null,

  payer_vpa             text,
  payer_name            text,
  -- Kept verbatim: this is the audit trail back to the bank.
  narration             text not null,

  -- Where we first learned of this credit: a statement upload id, or an
  -- alert email's Message-ID.
  source                credit_source not null,
  source_ref            text not null,

  -- Set when the credit appears in an uploaded statement. A credit learned
  -- from an alert that never shows up here is a "phantom" worth flagging.
  seen_in_statement_at  timestamptz,

  created_at            timestamptz not null default now()
);

create index bank_credits_account_idx on bank_credits (account_last4, created_at desc);

-- Carry over anything already uploaded. The old table stays for history and
-- is no longer written to.
insert into bank_credits (
  account_last4, utr, amount_paise, value_date, narration,
  source, source_ref, seen_in_statement_at, created_at
)
select
  e.account_last4, sr.utr, sr.amount_paise, sr.value_date, sr.narration,
  'csv', sr.upload_id::text, sr.created_at, sr.created_at
from statement_rows sr
join events e on e.id = sr.event_id
on conflict (utr) do nothing;

-- payment_claims.matched_row_id now points at bank_credits.id. It never had
-- a foreign key, so no constraint needs moving.
comment on column payment_claims.matched_row_id is 'bank_credits.id of the matched credit';

-- ---------------------------------------------------------------------------
-- The latest automatic decision for each pending registration
-- ---------------------------------------------------------------------------

-- Lets the dashboard separate "still waiting for the bank" from "needs a
-- human", and show the reason, without re-running the rules to find out.
alter table registrations
  add column match_status text
    check (match_status is null or match_status in (
      'waiting', 'unmatched', 'amount_mismatch', 'duplicate_claim',
      'wrong_account', 'stale_payment'
    )),
  add column match_detail text,
  add column match_checked_at timestamptz;

create index registrations_match_status_idx
  on registrations (event_id, match_status)
  where status = 'pending';

alter table reconciliation_runs
  add column wrong_account integer not null default 0,
  add column stale_payment integer not null default 0,
  add column waiting       integer not null default 0,
  -- What caused the run: utr_submitted | statement_upload | schedule | manual.
  add column trigger       text not null default 'manual';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- Organisers can read credits for accounts their events collect into. All
-- writes go through server code holding the service role key.
--
-- Known limit: the account is identified by its last 4 digits, so two
-- Divisions whose accounts share those digits would see each other's credits.
-- Acceptable at this scale; revisit with a proper accounts table if needed.
alter table bank_credits enable row level security;

create policy bank_credits_organiser_read on bank_credits
  for select to authenticated
  using (exists (
    select 1 from events e
    where e.account_last4 = bank_credits.account_last4
      and organises_event(e.id)
  ));
