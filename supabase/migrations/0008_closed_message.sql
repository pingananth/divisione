-- Message shown at the top of the event page once registration is closed,
-- e.g. why it closed early. Empty means the generic "registration is closed".
--
-- Closing only stops NEW registrations. Members who already registered can
-- still submit a payment reference, matching keeps running, and organisers can
-- still confirm or reject from the dashboard.

alter table events
  add column closed_message text;
