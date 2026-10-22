-- Exuberance'26 tickets. Members pick one.
--
-- Prices are in PAISE: ₹175 = 17500. No early bird for this event.
--
-- "attendeeType" decides which details a ticket asks for: Toastmasters give
-- division, club and role; guests say who invited them. Students have none, so
-- they are asked whether they attend as a Toastmaster or a guest.
--
-- "guest-offer" is a limited-time guest price, sold only while the offer is
-- switched ON from the organiser dashboard (events.offer_active). Run
-- migration 0007 first.
--
-- Safe to re-run. Changes apply to new registrations only; anyone already
-- registered keeps the price they registered at.

update events
set tiers = $json$[
  { "id": "student",     "ticket": "student",     "label": "Student",     "amountPaise": 17500, "endsAt": null,
    "note": "Student ID card is required for approval" },
  { "id": "toastmaster", "ticket": "toastmaster", "label": "Toastmaster", "amountPaise": 34900, "endsAt": null,
    "attendeeType": "toastmaster" },
  { "id": "guest",       "ticket": "guest",       "label": "Guest",       "amountPaise": 47900, "endsAt": null,
    "attendeeType": "guest" },
  { "id": "guest-offer", "ticket": "guest",       "label": "Guest (limited offer)", "amountPaise": 34900, "endsAt": null,
    "attendeeType": "guest", "offer": true }
]$json$::jsonb
where slug = 'exuberance-26';
