# Conference registration

Replaces AllEvents for Division and District conference registration. Members pay **₹300 by UPI and
₹300 arrives in the account** — no 5% platform cut, no 2–3 week payout wait. Payments are verified
against the bank statement automatically instead of by checking Google Pay screenshots by hand.

## How it works

1. A member registers at `/e/<slug>`. The amount is priced on the server from the event's tiers, so
   a stale browser tab cannot lock in yesterday's early-bird price.
2. They get a UPI QR and deep link with the exact amount pre-filled, and pay from their own UPI app.
   Money lands directly in the Division's account, instantly, at zero fee.
3. They enter the 12-digit **UTR/RRN** from their UPI app. The registration sits as `pending`.
4. An organiser uploads the bank statement CSV at `/admin/<slug>` and clicks **Match payments now**.
   Claims whose reference *and* amount match a real credit are confirmed automatically, and the
   member is emailed.
5. Only the exception tail — wrong amount, reused reference, reference not in the statement —
   reaches a human.

The bank statement is the only source of truth. A mistyped or invented reference never clears, with
no organiser judgement required. That is stricter than trusting a screenshot.

## Running it locally

```bash
npm install
npm run dev
```

With no Supabase variables set, registration runs in **demo mode**: a sample conference at `/e/demo`
where the full member flow works and data is held in memory. An amber banner makes sure nobody
mistakes it for the real thing. The organiser dashboard needs a real database and shows a notice
instead.

Tests: `npm test` (126 tests covering pricing, UPI links, payment matching, statement parsing,
CSV export and the email queue).

## Setup

### 1. Database

Create a free Supabase project. In its SQL editor run, in order:

- `supabase/migrations/0001_init.sql`
- `supabase/seed.sql` — edit it first: one block per conference, with the real UPI ID, dates and
  prices.

### 2. Environment variables (Netlify → Site configuration → Environment variables)

See `.env.example` for the full list. `SUPABASE_SERVICE_ROLE_KEY` bypasses all database security —
it must never be given a `NEXT_PUBLIC_` prefix.

Also add `https://<your-domain>/auth/callback` under Supabase → Authentication → URL Configuration,
or organiser sign-in links will bounce.

### 3. Email

`EMAIL_PROVIDER` selects between `resend`, `brevo`, `smtp` and `console`. `console` logs instead of
sending — use it locally so test runs never mail real members. Switching providers is one variable
plus a redeploy; any provider with SMTP credentials works through the `smtp` adapter.

Free tiers cap around 300/day (Brevo) or ~1,200/month (Resend), which covers a 150–200 person
Division conference but **not** the 400–500 person District conference. Pick and pay for a tier
before November, and set up SPF/DKIM early — deliverability on a cold sending domain is the real
risk, not cost.

### 4. Organiser access

Organisers sign in with a magic link; there are no passwords stored. Sign-up is deliberately
disabled — a user must exist in Supabase Auth *and* be listed in `event_organisers`. The commented
block at the bottom of `seed.sql` adds them.

Row level security means an organiser only ever sees their own conference.

## The email queue

Confirmation emails are queued, not sent inline, so a provider outage or a rate limit delays them
rather than losing them or stalling a matching run.

`netlify/functions/outbox-cron.mts` drains the queue every 10 minutes by calling
`/api/cron/outbox`. **Netlify only runs scheduled functions on a deployed production site** — it
never fires locally.

## Before the first conference: the ₹1 smoke test

**Do this before registrations open.** Bank statement CSV formats vary between banks, and the parser
cannot be trusted against a real bank until it has seen one.

1. Register yourself against the real event.
2. Pay ₹1 (temporarily add a `{"id":"test","label":"Test","amountPaise":100,"endsAt":null}` tier).
3. Submit the real UTR.
4. Export the real statement from the real collecting account and upload it.
5. Click **Match payments now** and confirm you are auto-confirmed and emailed.

If the parser cannot read that bank's export, the upload will say so. Column auto-detection covers
common HDFC and ICICI shapes; an unusual bank may need its header patterns added to
`src/lib/statements/index.ts`.

## Things not to change by accident

- **Money is integer paise everywhere.** Never introduce a float for an amount — a half-paise
  rounding error becomes a payment that will not reconcile.
- **The QR code sits on a white tile with no `dark:` variant.** Scanners need dark modules on a
  light background; theming it for dark mode stops phones reading it.
- **The per-event CSV export** (`/admin/<slug>/export`) is the audit trail — every rupee traceable
  to a named registrant and a bank reference. With collection running through individual accounts
  rather than a registered entity, that trail is what makes the money accountable. Export it after
  every conference and keep it.

## Layout

| Path | What |
| --- | --- |
| `src/lib/pricing.ts` | Tier selection by date, money formatting |
| `src/lib/upi.ts` | UPI intent URLs, VPA and UTR validation |
| `src/lib/reconcile.ts` | The matching engine — pure, idempotent, heavily tested |
| `src/lib/reconcile-run.ts` | Applies results: confirms, queues emails, records the run |
| `src/lib/statements/` | Bank CSV reader and column auto-detection |
| `src/lib/email/` | Provider interface, adapters, templates, retrying outbox |
| `src/lib/demo.ts` | In-memory backend for demo mode |
| `src/app/e/[slug]/` | Public registration, payment and confirmation pages |
| `src/app/admin/[slug]/` | Organiser dashboard, statement upload, review queue, export |
| `netlify/functions/` | Scheduled email-queue drain |

## Not built yet

QR ticket emailing and venue check-in scanning. Ticket IDs are already generated and stored, so this
is additive — no migration needed when it lands.
