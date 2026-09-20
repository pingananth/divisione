import { describe, it, expect } from "vitest";
import { reconcile, summarise } from "./reconcile";
import type { PaymentClaim, StatementRow } from "./types";

const row = (utr: string, amountPaise: number): StatementRow => ({
  utr,
  amountPaise,
  valueDate: "2026-09-20",
  narration: `UPI/${utr}/CONF`,
});

const claim = (registrationId: string, utr: string, expectedAmountPaise = 30000): PaymentClaim => ({
  registrationId,
  utr,
  expectedAmountPaise,
});

describe("reconcile", () => {
  it("confirms a claim whose UTR and amount both match a credit", () => {
    const result = reconcile({
      claims: [claim("r1", "100000000001")],
      statement: [row("100000000001", 30000)],
    });
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].kind).toBe("confirmed");
    expect(result.unclaimedCredits).toHaveLength(0);
  });

  it("holds a claim for review when the credited amount is short", () => {
    const result = reconcile({
      claims: [claim("r1", "100000000001", 30000)],
      statement: [row("100000000001", 25000)],
    });
    const [outcome] = result.outcomes;
    expect(outcome.kind).toBe("amount_mismatch");
    if (outcome.kind === "amount_mismatch") {
      expect(outcome.expectedAmountPaise).toBe(30000);
      expect(outcome.creditedAmountPaise).toBe(25000);
    }
  });

  it("holds a claim for review when the attendee overpaid", () => {
    const result = reconcile({
      claims: [claim("r1", "100000000001", 30000)],
      statement: [row("100000000001", 60000)],
    });
    expect(result.outcomes[0].kind).toBe("amount_mismatch");
  });

  it("leaves an invented UTR unmatched rather than confirming it", () => {
    const result = reconcile({
      claims: [claim("r1", "999999999999")],
      statement: [row("100000000001", 30000)],
    });
    expect(result.outcomes[0].kind).toBe("unmatched");
  });

  it("flags every registration sharing one UTR and confirms none of them", () => {
    const result = reconcile({
      claims: [claim("r1", "100000000001"), claim("r2", "100000000001")],
      statement: [row("100000000001", 30000)],
    });
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes.every((o) => o.kind === "duplicate_claim")).toBe(true);
    for (const o of result.outcomes) {
      if (o.kind === "duplicate_claim") expect(o.claimedBy.sort()).toEqual(["r1", "r2"]);
    }
  });

  it("does not treat a shared UTR as an unclaimed credit", () => {
    const result = reconcile({
      claims: [claim("r1", "100000000001"), claim("r2", "100000000001")],
      statement: [row("100000000001", 30000)],
    });
    expect(result.unclaimedCredits).toHaveLength(0);
  });

  it("reports credits that nobody claimed", () => {
    const result = reconcile({
      claims: [claim("r1", "100000000001")],
      statement: [row("100000000001", 30000), row("100000000002", 30000)],
    });
    expect(result.unclaimedCredits).toHaveLength(1);
    expect(result.unclaimedCredits[0].utr).toBe("100000000002");
  });

  it("is idempotent across repeated runs over the same statement", () => {
    const input = {
      claims: [claim("r1", "100000000001"), claim("r2", "999999999999")],
      statement: [row("100000000001", 30000)],
    };
    expect(reconcile(input)).toEqual(reconcile(input));
  });

  it("confirms nothing on a re-run once confirmed claims are excluded", () => {
    const statement = [row("100000000001", 30000)];
    const first = reconcile({ claims: [claim("r1", "100000000001")], statement });
    expect(first.outcomes[0].kind).toBe("confirmed");
    // Second run: r1 is no longer pending, so it is not passed back in.
    const second = reconcile({ claims: [], statement });
    expect(second.outcomes).toHaveLength(0);
    expect(second.unclaimedCredits).toHaveLength(1);
  });

  it("handles an empty statement without confirming anything", () => {
    const result = reconcile({ claims: [claim("r1", "100000000001")], statement: [] });
    expect(result.outcomes[0].kind).toBe("unmatched");
  });

  it("handles no claims at all", () => {
    const result = reconcile({ claims: [], statement: [row("100000000001", 30000)] });
    expect(result.outcomes).toHaveLength(0);
    expect(result.unclaimedCredits).toHaveLength(1);
  });

  it("matches different registrations against their own distinct credits", () => {
    const result = reconcile({
      claims: [claim("r1", "100000000001"), claim("r2", "100000000002", 25000)],
      statement: [row("100000000001", 30000), row("100000000002", 25000)],
    });
    expect(result.outcomes.every((o) => o.kind === "confirmed")).toBe(true);
    expect(result.unclaimedCredits).toHaveLength(0);
  });
});

describe("summarise", () => {
  it("counts outcomes and totals what needs a human", () => {
    const result = reconcile({
      claims: [
        claim("r1", "100000000001"),
        claim("r2", "100000000002", 30000),
        claim("r3", "999999999999"),
        claim("r4", "100000000004"),
        claim("r5", "100000000004"),
      ],
      statement: [
        row("100000000001", 30000),
        row("100000000002", 10000),
        row("100000000004", 30000),
        row("100000000009", 30000),
      ],
    });
    expect(summarise(result)).toEqual({
      confirmed: 1,
      amount_mismatch: 1,
      duplicate_claim: 2,
      unmatched: 1,
      needsReview: 4,
      unclaimedCredits: 1,
    });
  });
});
