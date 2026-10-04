-- Exuberance'26 — Division A Humorous Speech & Evaluation Contest.
--
-- Run AFTER migrations 0003, 0004 and 0005.
--
-- Payment setup (UPI ID, payee name, account last 4, support email) is copied
-- from the existing 'division-e-2026' event so nothing needs re-entering.
-- Change them afterwards if Division A collects into a different account.
--
-- Safe to re-run: the page content below is refreshed, while price and
-- payment settings are left alone once the event exists.

insert into events (
  slug, title, subtitle, description, venue, starts_at, ends_at,
  upi_vpa, upi_payee_name, ref_prefix, account_last4, support_email,
  tiers, enabled_fields, info_sections, contacts,
  registration_open
)
select
  'exuberance-26',
  'Exuberance''26',
  'Division A Humorous Speech & Evaluation Contest',
  'We’re excited to host the Division A Humorous Speech & Evaluation Contest, and we look forward to welcoming Contestants, Role Players, and Guests to this vibrant event.',
  'Lennox India Technology Centre | Capital Land Phase 3 - Zenith - 10th floor | CSIR Road, Tharamani, Chennai',
  '2026-10-31T09:00:00+05:30',
  -- No end time was given ("9:00 AM onwards"). Only used internally to know
  -- when to stop checking for late payments; never shown to members.
  '2026-10-31T18:00:00+05:30',

  e.upi_vpa, e.upi_payee_name, 'A', e.account_last4, e.support_email,

  -- ASSUMED ₹300 (30000 paise). Change if the fee is different.
  $json$[{"id":"regular","label":"Registration","amountPaise":30000,"endsAt":null}]$json$::jsonb,

  -- Every field listed here is mandatory. Club, area, division and T-shirt
  -- size are not collected for this event.
  array['attendeeType','mealPreference','vehicle','governmentId'],

  $json$[
    {
      "heading": "Do's",
      "tone": "do",
      "items": [
        { "title": "Credentials & ID",
          "text": "Kindly carry your Government ID with you while attending the conference." },
        { "title": "Escort & Support",
          "text": "Request a Lennox employee to escort you when visiting vending machines or navigating between floors." }
      ]
    },
    {
      "heading": "Don'ts",
      "tone": "dont",
      "items": [
        { "title": "Prohibited Items",
          "text": "Do not bring unapproved electronics (laptops, power banks, non-mobile cameras, USB drives, or HDMI cables) or flammable materials into the facility." },
        { "title": "Photography & Media",
          "text": "Do not record any video footage on office grounds or take photos that capture Lennox logos." }
      ]
    }
  ]$json$::jsonb,

  $json$[
    { "name": "TM Kowsalya", "role": "Conference Chair",   "phone": "7010737617" },
    { "name": "TM Rajan",    "role": "Registration Chair", "phone": "8883388222" }
  ]$json$::jsonb,
  true
from events e
where e.slug = 'division-e-2026'
on conflict (slug) do update set
  title          = excluded.title,
  subtitle       = excluded.subtitle,
  description    = excluded.description,
  venue          = excluded.venue,
  starts_at      = excluded.starts_at,
  ends_at        = excluded.ends_at,
  enabled_fields = excluded.enabled_fields,
  info_sections  = excluded.info_sections,
  contacts       = excluded.contacts;

-- Give the current organisers access to the new event too.
insert into event_organisers (event_id, user_id)
select n.id, o.user_id
from events n
join events old on old.slug = 'division-e-2026'
join event_organisers o on o.event_id = old.id
where n.slug = 'exuberance-26'
on conflict do nothing;
