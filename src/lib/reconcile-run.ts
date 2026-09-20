import { serviceClient } from "./supabase";
import { reconcile, summarise, type MatchOutcome } from "./reconcile";
import { outboxKey } from "./email/outbox";
import { formatEventDate } from "./events";
import { formatPaise } from "./pricing";
import type { PaymentClaim, StatementRow } from "./types";

export type ReviewItem = {
  outcome: MatchOutcome;
  ticketId: string;
  fullName: string;
  email: string;
  amountDuePaise: number;
};

export type RunResult = {
  summary: ReturnType<typeof summarise>;
  review: ReviewItem[];
  unclaimedCredits: StatementRow[];
};

type StatementRowRecord = {
  id: string;
  utr: string;
  amount_paise: number;
  value_date: string;
  narration: string;
};

type PendingRow = {
  id: string;
  ticket_id: string;
  full_name: string;
  email: string;
  amount_due_paise: number;
  payment_claims: { id: string; utr: string }[] | null;
};

/**
 * Run reconciliation for one event and apply the results.
 *
 * Safe to run repeatedly: only pending registrations that have submitted a
 * reference are considered, confirmation flips a row out of that set, and the
 * outbox idempotency key stops a member being emailed twice even if two runs
 * overlap.
 */
export async function runReconciliation(
  eventId: string,
  runBy: string | null = null,
): Promise<RunResult> {
  const db = serviceClient();

  const [{ data: pendingData, error: pendingError }, { data: rowData, error: rowError }, { data: eventData, error: eventError }] =
    await Promise.all([
      db
        .from("registrations")
        .select("id, ticket_id, full_name, email, amount_due_paise, payment_claims(id, utr)")
        .eq("event_id", eventId)
        .eq("status", "pending"),
      db.from("statement_rows").select("id, utr, amount_paise, value_date, narration").eq("event_id", eventId),
      db.from("events").select("title, venue, starts_at, support_email").eq("id", eventId).single(),
    ]);

  if (pendingError) throw new Error(`Failed to load registrations: ${pendingError.message}`);
  if (rowError) throw new Error(`Failed to load statement rows: ${rowError.message}`);
  if (eventError) throw new Error(`Failed to load event: ${eventError.message}`);

  const pending = (pendingData ?? []) as PendingRow[];
  const byRegistrationId = new Map(pending.map((p) => [p.id, p]));

  // Only registrations that actually submitted a reference can be matched.
  const claims: PaymentClaim[] = pending
    .filter((p) => p.payment_claims?.[0]?.utr)
    .map((p) => ({
      registrationId: p.id,
      utr: p.payment_claims![0].utr,
      expectedAmountPaise: p.amount_due_paise,
    }));

  const rows = (rowData ?? []) as StatementRowRecord[];
  const statement: StatementRow[] = rows.map((r) => ({
    utr: r.utr,
    amountPaise: r.amount_paise,
    valueDate: r.value_date,
    narration: r.narration,
  }));
  const rowIdByUtr = new Map(rows.map((r) => [r.utr, r.id]));

  const result = reconcile({ claims, statement });

  const confirmed = result.outcomes.filter((o) => o.kind === "confirmed");

  if (confirmed.length > 0) {
    const ids = confirmed.map((o) => o.registrationId);
    const now = new Date().toISOString();

    const { error: updateError } = await db
      .from("registrations")
      .update({ status: "confirmed", reviewed_at: now, reviewed_by: runBy })
      .in("id", ids)
      // Guard against a concurrent run having already confirmed these.
      .eq("status", "pending");
    if (updateError) throw new Error(`Failed to confirm registrations: ${updateError.message}`);

    for (const outcome of confirmed) {
      const rowId = rowIdByUtr.get(outcome.utr) ?? null;
      const { error } = await db
        .from("payment_claims")
        .update({ matched_at: now, matched_row_id: rowId })
        .eq("registration_id", outcome.registrationId);
      if (error) {
        console.error(`[reconcile] failed to mark claim matched for ${outcome.registrationId}: ${error.message}`);
      }
    }

    const event = eventData as {
      title: string;
      venue: string | null;
      starts_at: string;
      support_email: string;
    };

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

  const summary = summarise(result);

  const { error: runError } = await db.from("reconciliation_runs").insert({
    event_id: eventId,
    run_by: runBy,
    confirmed: summary.confirmed,
    amount_mismatch: summary.amount_mismatch,
    duplicate_claim: summary.duplicate_claim,
    unmatched: summary.unmatched,
    unclaimed_credits: summary.unclaimedCredits,
  });
  if (runError) console.error(`[reconcile] failed to record run: ${runError.message}`);

  const review: ReviewItem[] = result.outcomes
    .filter((o) => o.kind !== "confirmed")
    .map((outcome) => {
      const reg = byRegistrationId.get(outcome.registrationId)!;
      return {
        outcome,
        ticketId: reg.ticket_id,
        fullName: reg.full_name,
        email: reg.email,
        amountDuePaise: reg.amount_due_paise,
      };
    });

  return { summary, review, unclaimedCredits: result.unclaimedCredits };
}

/** One-line explanation of a review item, for the organiser's queue. */
export function describeOutcome(outcome: MatchOutcome): string {
  switch (outcome.kind) {
    case "confirmed":
      return "Matched and confirmed.";
    case "amount_mismatch":
      return `Paid ${formatPaise(outcome.creditedAmountPaise)} but owes ${formatPaise(outcome.expectedAmountPaise)}.`;
    case "duplicate_claim":
      return `Reference ${outcome.utr} is claimed by ${outcome.claimedBy.length} registrations.`;
    case "unmatched":
      return `Reference ${outcome.utr} does not appear in any uploaded statement.`;
  }
}
