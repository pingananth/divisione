-- Attendee details for venue entry and parking: attending as Toastmaster or
-- guest, how they are travelling (with a plate number for own vehicles),
-- and a government ID for the venue's security desk.
--
-- Values are stored as codes; the app shows the labels.

alter table registrations
  add column attendee_type  text check (attendee_type in ('toastmaster', 'guest')),
  add column vehicle_type   text check (vehicle_type in ('four_wheeler', 'two_wheeler', 'public')),
  -- Normalised: uppercase, no spaces ("TN09AB1234"). Only kept for own vehicles.
  add column vehicle_number text,
  add column gov_id_type    text check (gov_id_type in ('aadhaar', 'pan', 'driving_licence', 'passport', 'voter_id')),
  -- Sensitive personal data. Readable only by the event's organisers (row
  -- level security on registrations) and never included in emails. Clear it
  -- once the event is over:
  --   update registrations set gov_id_type = null, gov_id_number = null
  --   where event_id = (select id from events where slug = '<slug>');
  add column gov_id_number  text,

  add constraint registrations_plate_for_own_vehicle
    check (vehicle_type is null or vehicle_type = 'public' or vehicle_number is not null),
  add constraint registrations_no_plate_for_public
    check (vehicle_type is distinct from 'public' or vehicle_number is null),
  add constraint registrations_id_type_and_number_together
    check ((gov_id_type is null) = (gov_id_number is null));
