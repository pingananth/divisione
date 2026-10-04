-- Richer event pages: a subtitle under the conference name, an intro
-- paragraph, guideline sections (Do's / Don'ts, parking, and so on) and a
-- named contact person members can call.
--
-- All optional — an event without them renders exactly as before.

alter table events
  -- One line under the conference name, e.g. the contest it hosts.
  add column subtitle      text,
  -- Intro paragraph shown above the registration form.
  add column description   text,

  -- [{ "heading": "Do's", "tone": "do",
  --    "items": [{ "title": "Credentials & ID", "text": "Carry a Government ID." }] }]
  -- "tone" is "do", "dont" or "info" and only changes the styling.
  -- Structured rather than free text so it renders cleanly and can never
  -- inject markup into the page.
  add column info_sections jsonb not null default '[]'::jsonb,

  add column contact_name  text,
  -- 10-digit Indian mobile, digits only. Formatted for display by the app.
  add column contact_phone text check (contact_phone is null or contact_phone ~ '^[6-9][0-9]{9}$'),

  add constraint events_info_sections_is_array check (jsonb_typeof(info_sections) = 'array');
