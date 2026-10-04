-- Exuberance'26 tickets. Members pick one; the Toastmaster ticket is early
-- bird until the cutoff, then regular.
--
-- FILL IN the four prices (in PAISE: ₹300 = 30000) and the early-bird cutoff
-- before running. The placeholders are deliberately invalid, so running this
-- unfilled fails instead of selling tickets at a wrong price.
--
-- Safe to re-run. Changes apply to new registrations only; anyone already
-- registered keeps the price they registered at.

update events
set tiers = $json$[
  { "id": "student",           "ticket": "student",     "label": "Student",
    "amountPaise": __STUDENT_PRICE__,     "endsAt": null },
  { "id": "toastmaster-early", "ticket": "toastmaster", "label": "Toastmaster (early bird)",
    "amountPaise": __EARLY_BIRD_PRICE__,  "endsAt": "__CUTOFF__" },
  { "id": "toastmaster",       "ticket": "toastmaster", "label": "Toastmaster",
    "amountPaise": __TOASTMASTER_PRICE__, "endsAt": null },
  { "id": "guest",             "ticket": "guest",       "label": "Guest",
    "amountPaise": __GUEST_PRICE__,       "endsAt": null }
]$json$::jsonb
where slug = 'exuberance-26';

-- __CUTOFF__ example: 2026-10-20T23:59:59+05:30 (India time; that second still counts)
