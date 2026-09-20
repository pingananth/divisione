import type { PaymentClaim, StatementRow } from "./types";

export type MatchOutcome =
  | {
      kind: "confirmed";
      registrationId: string;
      utr: string;
      row: StatementRow;
    }
  | {
      kind: "amount_mismatch";
      registrationId: string;
      utr: string;
      expectedAmountPaise: number;
      creditedAmountPaise: number;
      row: StatementRow;
    }
  | {
      kind: "duplicate_claim";
      registrationId: string;
      utr: string;
      /** Every registration claiming this same UTR, including this one. */
      claimedBy: string[];
    }
  | {
      kind: "unmatched";
      registrationId: string;
      utr: string;
    };

export type ReconcileResult = {
  outcomes: MatchOutcome[];
  /** Credits present in the statement that no registration claimed. */
  unclaimedCredits: StatementRow[];
};

export type ReconcileInput = {
  /** Claims from registrations that are still pending. */
  claims: PaymentClaim[];
  /** Credit rows parsed from one or more bank statement uploads. */
  statement: StatementRow[];
};

/**
 * Match pending payment claims against bank statement credits.
 *
 * The bank statement is the only source of truth. A claim confirms only when
 * its UTR appears as a real credit for exactly the expected amount — so a
 * mistyped or invented UTR simply never clears, with no organiser judgement
 * required.
 *
 * Two registrations claiming the same UTR are both held for review rather than
 * one being confirmed arbitrarily. That is the shape of both an honest mistake
 * (a member registering twice) and the obvious abuse (sharing one payment
 * reference), and a human should decide which it is.
 *
 * Pure and idempotent: pass only still-pending claims and running it repeatedly
 * over the same statement yields the same outcomes and confirms nothing twice.
 */
export function reconcile({ claims, statement }: ReconcileInput): ReconcileResult {
  const byUtr = new Map<string, StatementRow[]>();
  for (const row of statement) {
    const existing = byUtr.get(row.utr);
    if (existing) existing.push(row);
    else byUtr.set(row.utr, [row]);
  }

  // Claims sharing a UTR are all suspect, so index them before deciding anything.
  const claimantsByUtr = new Map<string, string[]>();
  for (const claim of claims) {
    const existing = claimantsByUtr.get(claim.utr);
    if (existing) existing.push(claim.registrationId);
    else claimantsByUtr.set(claim.utr, [claim.registrationId]);
  }

  const outcomes: MatchOutcome[] = [];
  const claimedUtrs = new Set<string>();

  for (const claim of claims) {
    const claimants = claimantsByUtr.get(claim.utr) ?? [claim.registrationId];

    if (claimants.length > 1) {
      outcomes.push({
        kind: "duplicate_claim",
        registrationId: claim.registrationId,
        utr: claim.utr,
        claimedBy: [...claimants],
      });
      claimedUtrs.add(claim.utr);
      continue;
    }

    const rows = byUtr.get(claim.utr);
    if (!rows || rows.length === 0) {
      outcomes.push({
        kind: "unmatched",
        registrationId: claim.registrationId,
        utr: claim.utr,
      });
      continue;
    }

    claimedUtrs.add(claim.utr);
    const row = rows[0];

    if (row.amountPaise === claim.expectedAmountPaise) {
      outcomes.push({
        kind: "confirmed",
        registrationId: claim.registrationId,
        utr: claim.utr,
        row,
      });
    } else {
      outcomes.push({
        kind: "amount_mismatch",
        registrationId: claim.registrationId,
        utr: claim.utr,
        expectedAmountPaise: claim.expectedAmountPaise,
        creditedAmountPaise: row.amountPaise,
        row,
      });
    }
  }

  const unclaimedCredits = statement.filter((row) => !claimedUtrs.has(row.utr));

  return { outcomes, unclaimedCredits };
}

/** Convenience counts for the organiser dashboard. */
export function summarise(result: ReconcileResult) {
  const counts = { confirmed: 0, amount_mismatch: 0, duplicate_claim: 0, unmatched: 0 };
  for (const o of result.outcomes) counts[o.kind]++;
  return {
    ...counts,
    needsReview: counts.amount_mismatch + counts.duplicate_claim + counts.unmatched,
    unclaimedCredits: result.unclaimedCredits.length,
  };
}
