-- Exuberance'26 tickets. Members pick one.
--
-- Prices are in PAISE: ₹175 = 17500. No early bird for this event.
--
-- Safe to re-run. Changes apply to new registrations only; anyone already
-- registered keeps the price they registered at.

update events
set tiers = $json$[
  { "id": "student",     "ticket": "student",     "label": "Student",     "amountPaise": 17500, "endsAt": null },
  { "id": "toastmaster", "ticket": "toastmaster", "label": "Toastmaster", "amountPaise": 34900, "endsAt": null },
  { "id": "guest",       "ticket": "guest",       "label": "Guest",       "amountPaise": 47900, "endsAt": null }
]$json$::jsonb
where slug = 'exuberance-26';
