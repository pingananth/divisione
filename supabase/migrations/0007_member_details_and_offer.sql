-- Toastmaster details (division, club, role), who invited a guest, and an
-- on/off switch for limited-time offer tickets.
--
-- Club and division reuse the existing columns. New columns stay nullable so
-- rows from before this change remain valid; the app makes them required on
-- new registrations.

alter table events
  -- When true, tiers marked "offer": true are sold in place of their ticket's
  -- normal price. Flipped from the organiser dashboard.
  add column offer_active boolean not null default false;

alter table registrations
  add column tm_role    text check (tm_role in ('district_officer', 'excomm', 'member', 'others')),
  -- Guests: the club or person who invited them. Free text.
  add column invited_by text check (invited_by is null or char_length(invited_by) <= 120);
