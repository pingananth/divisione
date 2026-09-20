-- Seed one conference. Copy this block per Division, changing the slug, title,
-- dates, VPA and ref_prefix.
--
-- Amounts are INTEGER PAISE: 30000 = ₹300.
-- Cutoffs are ISO-8601 with the IST offset, so they mean what an organiser
-- sitting in India thinks they mean.

insert into events (
  slug, title, venue, starts_at, ends_at,
  upi_vpa, upi_payee_name, ref_prefix,
  tiers, enabled_fields, support_email, registration_open
) values (
  'division-e-2026',
  'Division E Annual Conference 2026',
  'Chennai Trade Centre, Nandambakkam',
  '2026-10-04T09:00:00+05:30',
  '2026-10-04T18:00:00+05:30',

  'CHANGE-ME@okhdfcbank',
  'Division E Conference',
  'E',

  '[
    {"id":"early","label":"Early bird","amountPaise":25000,"endsAt":"2026-09-25T23:59:59+05:30"},
    {"id":"regular","label":"Regular","amountPaise":30000,"endsAt":null}
  ]'::jsonb,

  array['club','area','division','mealPreference','tshirtSize'],
  'divisione@d229.org',
  true
)
on conflict (slug) do nothing;

-- Grant an organiser access. The user must already have signed up in Supabase
-- Auth (Authentication → Users → Add user, or one magic-link sign-in with
-- shouldCreateUser temporarily enabled).
--
-- insert into event_organisers (event_id, user_id)
-- select e.id, u.id
-- from events e, auth.users u
-- where e.slug = 'division-e-2026' and u.email = 'organiser@example.com'
-- on conflict do nothing;
