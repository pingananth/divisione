import { serviceClient } from "./supabase";
import { reconcile, summarise, type MatchOutcome } from "./reconcile";
import { outboxKey } from "./email/outbox";
import { formatEventDate, parseContacts, parseInfoSections } from "./events";
import { formatPaise } from "./pricing";
import type { Credit, PaymentClaim } from "./types";

/** What caused a matching run. Recorded on every run for the audit trail. */
export type RunTrigger = "utr_submitted" | "statement_upload" | "schedule" | "manual";

export type RunSummary = ReturnType<typeof summarise>;

/** Thrown when an event has no collecting account configured yet. */
export class AccountNotConfiguredError extends Error {
  constructor(eventTitle: string) {
    super(
      `"${eventTitle}" has no collecting account set. Add the last 4 digits of ` +
        "the bank account (events.account_last4) before matching payments.",
    );
    this.name = "AccountNotConfiguredError";
  }
}

type PendingRow = {
  id: string;
  ticket_id: string;
  full_name: string;
  email: string;
  amount_due_paise: number;
  created_at: string;
  match_status: string | null;
  match_detail: string | null;
  payment_claims: { id: string; utr: string; created_at: string }[] | null;
};

type CreditRow = {
  id: string;
  utr: string;
  amount_paise: number;
  value_date: string;
  narration: string;
  account_last4: string | null;
  credited_at: string | null;
  source: "csv" | "email";
};

type EventRow = {
  title: string;
  venue: string | null;
  starts_at: string;
  support_email: string;
  account_last4: string | null;
  slug: string;
  contacts: unknown;
  info_sections: unknown;
};

/** Pending registrations that submitted a UTR, as the rules expect them. */
export function toClaims(pending: PendingRow[], accountLast4: string): PaymentClaim[] {
  return pending
    .filter((p) => p.payment_claims?.[0]?.utr)
    .map((p) => {
      const claim = p.payment_claims![0];
      return {
        registrationId: p.id,
        utr: claim.utr,
        expectedAmountPaise: p.amount_due_paise,
        accountLast4,
        registeredAt: p.created_at,
        claimedAt: claim.created_at,
      };
    });
}

/**
 * Work out which pending registrations need their stored decision changed.
 *
 * Only returns rows whose status or reason actually differs, so a scheduled
 * run every few minutes does not rewrite hundreds of unchanged rows.
 */
export function matchStatusChanges(
  outcomes: MatchOutcome[],
  current: Map<string, { match_status: string | null; match_detail: string | null }>,
): { id: string; match_status: string; match_detail: string }[] {
  const changes: { id: string; match_status: string; match_detail: string }[] = [];
  for (const outcome of outcomes) {
    if (outcome.kind === "confirmed") continue;
    const detail = describeOutcome(outcome);
    const before = current.get(outcome.registrationId);
    if (before?.match_status === outcome.kind && before?.match_detail === detail) continue;
    changes.push({ id: outcome.registrationId, match_status: outcome.kind, match_detail: detail });
  }
  return changes;
}

/** Split a list for `.in()` filters, which travel in the request URL. */
function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Run the matching rules for one event and apply the results.
 *
 * Safe to run as often as anything likes — after every UTR submission, every
 * statement upload, and on a schedule. Only pending registrations are
 * considered, confirmation flips a row out of that set under a status guard,
 * and the outbox idempotency key stops a member being emailed twice even if
 * two runs overlap.
 */
export async function runReconciliation(
  eventId: string,
  options: { runBy?: string | null; trigger: RunTrigger; now?: Date },
): Promise<RunSummary> {
  const db = serviceClient();
  const now = options.now ?? new Date();
  const runBy = options.runBy ?? null;

  const { data: eventData, error: eventError } = await db
    .from("events")
    .select("title, venue, starts_at, support_email, account_last4, slug, contacts, info_sections")
    .eq("id", eventId)
    .single();
  if (eventError) throw new Error(`Failed to load event: ${eventError.message}`);

  const event = eventData as EventRow;
  if (!event.account_last4) throw new AccountNotConfiguredError(event.title);

  const [{ data: pendingData, error: pendingError }, { data: creditData, error: creditError }] =
    await Promise.all([
      db
        .from("registrations")
        .select(
          "id, ticket_id, full_name, email, amount_due_paise, created_at, match_status, match_detail, payment_claims(id, utr, created_at)",
        )
        .eq("event_id", eventId)
        .eq("status", "pending"),
      db
        .from("bank_credits")
        .select("id, utr, amount_paise, value_date, narration, account_last4, credited_at, source")
        .eq("account_last4", event.account_last4),
    ]);

  if (pendingError) throw new Error(`Failed to load registrations: ${pendingError.message}`);
  if (creditError) throw new Error(`Failed to load bank credits: ${creditError.message}`);

  const pending = (pendingData ?? []) as PendingRow[];
  const byRegistrationId = new Map(pending.map((p) => [p.id, p]));
  const creditRows = (creditData ?? []) as CreditRow[];

  const statement: Credit[] = creditRows.map((r) => ({
    utr: r.utr,
    amountPaise: r.amount_paise,
    valueDate: r.value_date,
    narration: r.narration,
    accountLast4: r.account_last4,
    creditedAt: r.credited_at,
    source: r.source,
  }));
  const creditIdByUtr = new Map(creditRows.map((r) => [r.utr, r.id]));

  // Credits already claimed by any registration — confirmed ones, or another
  // event on the same account — are accounted for, not "unclaimed money".
  const knownClaimedUtrs = new Set<string>();
  for (const batch of chunks([...creditIdByUtr.keys()], 200)) {
    const { data, error } = await db.from("payment_claims").select("utr").in("utr", batch);
    if (error) throw new Error(`Failed to load existing claims: ${error.message}`);
    for (const row of data ?? []) knownClaimedUtrs.add((row as { utr: string }).utr);
  }

  const result = reconcile({
    claims: toClaims(pending, event.account_last4),
    statement,
    knownClaimedUtrs,
    now,
  });

  const confirmed = result.outcomes.filter((o) => o.kind === "confirmed");

  if (confirmed.length > 0) {
    const stamp = now.toISOString();

    const { error: updateError } = await db
      .from("registrations")
      .update({
        status: "confirmed",
        reviewed_at: stamp,
        reviewed_by: runBy,
        match_status: null,
        match_detail: null,
        match_checked_at: stamp,
      })
      .in(
        "id",
        confirmed.map((o) => o.registrationId),
      )
      // Guard against a concurrent run having already confirmed these.
      .eq("status", "pending");
    if (updateError) throw new Error(`Failed to confirm registrations: ${updateError.message}`);

    for (const outcome of confirmed) {
      const { error } = await db
        .from("payment_claims")
        .update({ matched_at: stamp, matched_row_id: creditIdByUtr.get(outcome.utr) ?? null })
        .eq("registration_id", outcome.registrationId);
      if (error) {
        console.error(
          `[reconcile] failed to mark claim matched for ${outcome.registrationId}: ${error.message}`,
        );
      }
    }

    const entries = confirmed.map((outcome) => {
      const reg = byRegistrationId.get(outcome.registrationId)!;
      return {
        registration_id: reg.id,
        idempotency_key: outboxKey(reg.id, "registration_confirmed"),
        recipient: reg.email,
        template: "registration_confirmed",
        data: {
          fullName: reg.full_name,
          eventTitle: event.title,
          eventVenue: event.venue,
          eventStartsAt: formatEventDate(event.starts_at),
          ticketId: reg.ticket_id,
          amountPaise: reg.amount_due_paise,
          utr: outcome.utr,
          supportEmail: event.support_email,
          contacts: parseContacts(event.contacts, event.slug),
          infoSections: parseInfoSections(event.info_sections, event.slug),
        },
      };
    });

    // ignoreDuplicates: a key already present means this member has already
    // been told, which is exactly the outcome we want.
    const { error: outboxError } = await db
      .from("email_outbox")
      .upsert(entries, { onConflict: "idempotency_key", ignoreDuplicates: true });
    if (outboxError) {
      console.error(`[reconcile] failed to queue confirmations: ${outboxError.message}`);
    }
  }

  // Store the latest decision for everything still pending, so the dashboard
  // can tell "waiting for the bank" apart from "needs a human".
  const changes = matchStatusChanges(result.outcomes, byRegistrationId);
  for (const change of changes) {
    const { error } = await db
      .from("registrations")
      .update({
        match_status: change.match_status,
        match_detail: change.match_detail,
        match_checked_at: now.toISOString(),
      })
      .eq("id", change.id)
      .eq("status", "pending");
    if (error) {
      console.error(`[reconcile] failed to store decision for ${change.id}: ${error.message}`);
    }
  }

  const summary = summarise(result);

  const { error: runError } = await db.from("reconciliation_runs").insert({
    event_id: eventId,
    run_by: runBy,
    trigger: options.trigger,
    confirmed: summary.confirmed,
    amount_mismatch: summary.amount_mismatch,
    duplicate_claim: summary.duplicate_claim,
    wrong_account: summary.wrong_account,
    stale_payment: summary.stale_payment,
    waiting: summary.waiting,
    unmatched: summary.unmatched,
    unclaimed_credits: summary.unclaimedCredits,
  });
  if (runError) console.error(`[reconcile] failed to record run: ${runError.message}`);

  return summary;
}

/**
 * Run matching for every event that could still have payments arriving.
 * Used by the scheduled job; one event failing does not stop the others.
 */
export async function runReconciliationForActiveEvents(
  trigger: RunTrigger,
  now: Date = new Date(),
): Promise<{ eventId: string; ok: boolean; summary?: RunSummary; error?: string }[]> {
  const db = serviceClient();

  // Two days of grace after an event ends, for late statements.
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("events")
    .select("id")
    .not("account_last4", "is", null)
    .gte("ends_at", cutoff);
  if (error) throw new Error(`Failed to list active events: ${error.message}`);

  const results = [];
  for (const { id } of (data ?? []) as { id: string }[]) {
    try {
      results.push({ eventId: id, ok: true, summary: await runReconciliation(id, { trigger, now }) });
    } catch (err) {
      console.error(`[reconcile] scheduled run failed for ${id}:`, err);
      results.push({ eventId: id, ok: false, error: String(err) });
    }
  }
  return results;
}

/** One-line, plain-English reason for a decision, shown to organisers. */
export function describeOutcome(outcome: MatchOutcome): string {
  switch (outcome.kind) {
    case "confirmed":
      return "Matched and confirmed.";
    case "waiting":
      return `Waiting for the bank to report reference ${outcome.utr}.`;
    case "unmatched":
      return `Reference ${outcome.utr} has not reached the bank records after 24 hours.`;
    case "amount_mismatch":
      return `Paid ${formatPaise(outcome.creditedAmountPaise)} but owes ${formatPaise(outcome.expectedAmountPaise)}.`;
    case "duplicate_claim":
      return `Reference ${outcome.utr} is claimed by ${outcome.claimedBy.length} registrations.`;
    case "wrong_account":
      return `Paid into account ending ${outcome.creditedAccount}, not ${outcome.expectedAccount}.`;
    case "stale_payment":
      return `Payment was made before this registration existed — possibly a reused reference.`;
  }
}
