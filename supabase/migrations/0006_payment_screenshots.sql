-- Payment proof without a 12-digit UTR.
--
-- Some UPI apps make the UTR hard to copy, and some (an ICICI member's, for
-- one) show only their own alphanumeric transaction ID. Members can now send a
-- screenshot, that app's ID, or both. Only a 12-digit UTR can be matched
-- against the bank statement automatically; everything else goes to an
-- organiser to check by hand.

alter table payment_claims
  alter column utr drop not null,
  -- The app's own transaction ID when it isn't a UTR. Shown to organisers only.
  add column app_ref text
    check (app_ref is null or char_length(app_ref) between 4 and 40),
  -- A claim must carry something an organiser can check.
  add constraint payment_claims_has_proof
    check (utr is not null or app_ref is not null or screenshot_path is not null);

-- 'manual_check': no 12-digit UTR, so the rules cannot decide.
alter table registrations drop constraint registrations_match_status_check;
alter table registrations add constraint registrations_match_status_check
  check (match_status is null or match_status in (
    'waiting', 'unmatched', 'amount_mismatch', 'duplicate_claim',
    'wrong_account', 'stale_payment', 'manual_check'
  ));

-- Private: screenshots hold names, UPI IDs and sometimes balances. No policies,
-- so only server code holding the service role key can read or write them;
-- organisers view them through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-screenshots', 'payment-screenshots', false, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
