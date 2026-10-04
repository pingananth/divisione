-- Several named contacts per event, each with a role, e.g.
--   [{ "name": "TM Rajan", "role": "Registration Chair", "phone": "8883388222" }]
-- Phones are 10-digit Indian mobiles, digits only. Replaces the single
-- contact_name / contact_phone pair, which is copied across and dropped.

alter table events
  add column contacts jsonb not null default '[]'::jsonb,
  add constraint events_contacts_is_array check (jsonb_typeof(contacts) = 'array');

update events
set contacts = jsonb_build_array(jsonb_build_object('name', contact_name, 'role', 'Registration Chair', 'phone', contact_phone))
where contact_phone is not null;

alter table events
  drop column contact_name,
  drop column contact_phone;
