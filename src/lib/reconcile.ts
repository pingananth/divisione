import type { Credit, PaymentClaim } from "./types";

/**
 * How long a submitted UTR may go unmatched before a human is asked to look.
 * Bank alerts land in minutes and statements daily, so a day covers both.
 */
export const WAIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Tolerance for clock differences between the bank and our server. A credit
 * this far before the registration was created is still treated as fresh.
 */
export const CLOCK_SKEW_MS = 15 * 60 * 1000;

export type MatchOutcome =
  | {
      kind: "confirmed";
      registrationId: string;
      utr: string;
      row: Credit;
    }
  | {
      kind: "amount_mismatch";
      registrationId: string;
      utr: string;
      expectedAmountPaise: number;
      creditedAmountPaise: number;
      row: Credit;
    }
  | {
      kind: "duplicate_claim";
      registrationId: string;
      utr: string;
      /** Every registration claiming this same UTR, including this one. */
      claimedBy: string[];
    }
  | {
      kind: "wrong_account";
      registrationId: string;
      utr: string;
      expectedAccount: string;
      creditedAccount: string;
      row: Credit;
    }
  | {
      kind: "stale_payment";
      registrationId: string;
      utr: string;
      creditedAt: string;
      registeredAt: string;
      row: Credit;
    }
  | {
      /** UTR submitted, bank has not reported it yet, still inside the window. */
      kind: "waiting";
      registrationId: string;
      utr: string;
    }
  | {
      /** UTR submitted and the window has passed with no matching credit. */
      kind: "unmatched";
      registrationId: string;
      utr: string;
    };

export type OutcomeKind = MatchOutcome["kind"];

/** Outcomes a human must look at. `waiting` and `confirmed` are not here. */
export const REVIEW_KINDS: ReadonlySet<OutcomeKind> = new Set<OutcomeKind>([
  "amount_mismatch",
  "duplicate_claim",
  "wrong_account",
  "stale_payment",
  "unmatched",
]);

export type ReconcileResult = {
  outcomes: MatchOutcome[];
  /** Credits that no registration claimed. */
  unclaimedCredits: Credit[];
};

export type ReconcileInput = {
  /** Claims from registrations that are still pending. */
  claims: PaymentClaim[];
  /** Credits from bank statements and/or bank alerts. */
  statement: Credit[];
  /**
   * UTRs already claimed anywhere — including registrations already confirmed,
   * or belonging to another event on the same account. Excluded from
   * `unclaimedCredits`, which would otherwise fill with money that is
   * perfectly well accounted for.
   */
  knownClaimedUtrs?: ReadonlySet<string>;
  /** Reference time for the wait window. Defaults to now. */
  now?: Date;
};

/**
 * Decide what happens to each pending payment claim.
 *
 * Plain rules, checked in this order — the first that applies wins:
 *
 *   1. Same UTR claimed by 2+ registrations      → duplicate_claim (review)
 *   2. No credit for the UTR yet:
 *        claimed under 24 h ago                  → waiting
 *        claimed 24 h+ ago (or time unknown)     → unmatched (review)
 *   3. Credit went to a different account        → wrong_account (review)
 *   4. Credited amount ≠ amount due              → amount_mismatch (review)
 *   5. Credited before the registration existed  → stale_payment (review)
 *   6. Everything matches                        → confirmed
 *
 * The bank is the only source of truth. A claim confirms only when its UTR is a
 * real credit, to the right account, for exactly the amount due, made after
 * the member registered — so an invented, mistyped or recycled UTR never
 * clears on its own.
 *
 * Checks that need data a source does not provide are skipped rather than
 * failed: a CSV statement has no credit time, so rule 5 only applies to
 * sources that give one. Every other rule always applies.
 *
 * Pure and idempotent: pass only still-pending claims and running it
 * repeatedly over the same inputs yields the same outcomes.
 */
export function reconcile({
  claims,
  statement,
  knownClaimedUtrs,
  now = new Date(),
}: ReconcileInput): ReconcileResult {
  const byUtr = new Map<string, Credit>();
  for (const row of statement) {
    // UTRs are unique across the UPI network; a repeat is the same credit
    // reported twice (an alert and a statement row), so keep the first.
    if (!byUtr.has(row.utr)) byUtr.set(row.utr, row);
  }

  // Claims sharing a UTR are all suspect, so index them before deciding anything.
  const claimantsByUtr = new Map<string, string[]>();
  for (const claim of claims) {
    const existing = claimantsByUtr.get(claim.utr);
    if (existing) existing.push(claim.registrationId);
    else claimantsByUtr.set(claim.utr, [claim.registrationId]);
  }

  const outcomes: MatchOutcome[] = claims.map((claim) =>
    decide(claim, claimantsByUtr.get(claim.utr) ?? [claim.registrationId], byUtr, now),
  );

  const claimedUtrs = new Set(claims.map((c) => c.utr));
  const unclaimedCredits = [...byUtr.values()].filter(
    (row) => !claimedUtrs.has(row.utr) && !knownClaimedUtrs?.has(row.utr),
  );

  return { outcomes, unclaimedCredits };
}

function decide(
  claim: PaymentClaim,
  claimants: string[],
  byUtr: Map<string, Credit>,
  now: Date,
): MatchOutcome {
  const base = { registrationId: claim.registrationId, utr: claim.utr };

  // Rule 1
  if (claimants.length > 1) {
    return { ...base, kind: "duplicate_claim", claimedBy: [...claimants] };
  }

  // Rule 2
  const row = byUtr.get(claim.utr);
  if (!row) {
    const claimedAt = claim.claimedAt ? Date.parse(claim.claimedAt) : NaN;
    const stillWaiting =
      Number.isFinite(claimedAt) && now.getTime() - claimedAt < WAIT_WINDOW_MS;
    return { ...base, kind: stillWaiting ? "waiting" : "unmatched" };
  }

  // Rule 3
  if (claim.accountLast4 && row.accountLast4 && claim.accountLast4 !== row.accountLast4) {
    return {
      ...base,
      kind: "wrong_account",
      expectedAccount: claim.accountLast4,
      creditedAccount: row.accountLast4,
      row,
    };
  }

  // Rule 4
  if (row.amountPaise !== claim.expectedAmountPaise) {
    return {
      ...base,
      kind: "amount_mismatch",
      expectedAmountPaise: claim.expectedAmountPaise,
      creditedAmountPaise: row.amountPaise,
      row,
    };
  }

  // Rule 5
  if (row.creditedAt && claim.registeredAt) {
    const credited = Date.parse(row.creditedAt);
    const registered = Date.parse(claim.registeredAt);
    if (
      Number.isFinite(credited) &&
      Number.isFinite(registered) &&
      credited < registered - CLOCK_SKEW_MS
    ) {
      return {
        ...base,
        kind: "stale_payment",
        creditedAt: row.creditedAt,
        registeredAt: claim.registeredAt,
        row,
      };
    }
  }

  // Rule 6
  return { ...base, kind: "confirmed", row };
}

/** Convenience counts for the organiser dashboard. */
export function summarise(result: ReconcileResult) {
  const counts: Record<OutcomeKind, number> = {
    confirmed: 0,
    amount_mismatch: 0,
    duplicate_claim: 0,
    wrong_account: 0,
    stale_payment: 0,
    waiting: 0,
    unmatched: 0,
  };
  for (const o of result.outcomes) counts[o.kind]++;

  let needsReview = 0;
  for (const kind of REVIEW_KINDS) needsReview += counts[kind];

  return {
    ...counts,
    needsReview,
    unclaimedCredits: result.unclaimedCredits.length,
  };
}
