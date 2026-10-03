import { describe, it, expect } from "vitest";
import { reconcile, summarise, WAIT_WINDOW_MS, CLOCK_SKEW_MS } from "./reconcile";
import type { Credit, PaymentClaim, StatementRow } from "./types";

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
      wrong_account: 0,
      stale_payment: 0,
      waiting: 0,
      unmatched: 1,
      needsReview: 4,
      unclaimedCredits: 1,
    });
  });
});

describe("decision rules", () => {
  const NOW = new Date("2026-10-03T12:00:00+05:30");
  const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  const HOUR = 60 * 60 * 1000;

  const fullClaim = (over: Partial<PaymentClaim> = {}): PaymentClaim => ({
    registrationId: "r1",
    utr: "100000000001",
    expectedAmountPaise: 30000,
    accountLast4: "1234",
    registeredAt: ago(2 * HOUR),
    claimedAt: ago(1 * HOUR),
    ...over,
  });

  const credit = (over: Partial<Credit> = {}): Credit => ({
    utr: "100000000001",
    amountPaise: 30000,
    valueDate: "03/10/2026",
    narration: "UPI credit",
    accountLast4: "1234",
    creditedAt: ago(90 * 60 * 1000),
    source: "email",
    ...over,
  });

  const kindOf = (claims: PaymentClaim[], statement: Credit[]) =>
    reconcile({ claims, statement, now: NOW }).outcomes.map((o) => o.kind);

  it("rule 6: confirms when UTR, account, amount and timing all match", () => {
    expect(kindOf([fullClaim()], [credit()])).toEqual(["confirmed"]);
  });

  it("rule 2: waits when no credit yet and the claim is under 24 h old", () => {
    expect(kindOf([fullClaim({ claimedAt: ago(23 * HOUR) })], [])).toEqual(["waiting"]);
  });

  it("rule 2: escalates to review once the claim is 24 h old with no credit", () => {
    expect(kindOf([fullClaim({ claimedAt: ago(WAIT_WINDOW_MS) })], [])).toEqual(["unmatched"]);
  });

  it("rule 2: escalates immediately when the claim time is unknown", () => {
    expect(kindOf([fullClaim({ claimedAt: undefined })], [])).toEqual(["unmatched"]);
  });

  it("rule 3: holds a credit that landed in a different account", () => {
    const [o] = reconcile({
      claims: [fullClaim()],
      statement: [credit({ accountLast4: "9999" })],
      now: NOW,
    }).outcomes;
    expect(o.kind).toBe("wrong_account");
    if (o.kind === "wrong_account") {
      expect(o.expectedAccount).toBe("1234");
      expect(o.creditedAccount).toBe("9999");
    }
  });

  it("rule 3: skips the account check when either side does not say", () => {
    expect(kindOf([fullClaim({ accountLast4: null })], [credit()])).toEqual(["confirmed"]);
    expect(kindOf([fullClaim()], [credit({ accountLast4: null })])).toEqual(["confirmed"]);
  });

  it("rule 4: holds a short payment", () => {
    expect(kindOf([fullClaim()], [credit({ amountPaise: 25000 })])).toEqual(["amount_mismatch"]);
  });

  it("rule 5: holds a payment made before the member registered", () => {
    const [o] = reconcile({
      claims: [fullClaim({ registeredAt: ago(2 * HOUR) })],
      statement: [credit({ creditedAt: ago(30 * 24 * HOUR) })],
      now: NOW,
    }).outcomes;
    expect(o.kind).toBe("stale_payment");
  });

  it("rule 5: allows a credit inside the clock-skew tolerance", () => {
    const registeredAt = ago(2 * HOUR);
    const creditedAt = new Date(Date.parse(registeredAt) - CLOCK_SKEW_MS + 1000).toISOString();
    expect(kindOf([fullClaim({ registeredAt })], [credit({ creditedAt })])).toEqual(["confirmed"]);
  });

  it("rule 5: is skipped for sources with no credit time, such as a CSV statement", () => {
    expect(kindOf([fullClaim()], [credit({ creditedAt: null, source: "csv" })])).toEqual([
      "confirmed",
    ]);
  });

  describe("rule order", () => {
    it("a duplicate claim beats every other problem", () => {
      const claims = [fullClaim({ registrationId: "a" }), fullClaim({ registrationId: "b" })];
      const bad = credit({ accountLast4: "9999", amountPaise: 100 });
      expect(kindOf(claims, [bad])).toEqual(["duplicate_claim", "duplicate_claim"]);
    });

    it("a wrong account beats a wrong amount", () => {
      expect(kindOf([fullClaim()], [credit({ accountLast4: "9999", amountPaise: 100 })])).toEqual([
        "wrong_account",
      ]);
    });

    it("a wrong amount beats a stale payment", () => {
      const old = credit({ amountPaise: 100, creditedAt: ago(30 * 24 * HOUR) });
      expect(kindOf([fullClaim()], [old])).toEqual(["amount_mismatch"]);
    });
  });

  it("treats the same UTR reported twice (alert + statement) as one credit", () => {
    const result = reconcile({
      claims: [fullClaim()],
      statement: [credit({ source: "email" }), credit({ source: "csv", creditedAt: null })],
      now: NOW,
    });
    expect(result.outcomes.map((o) => o.kind)).toEqual(["confirmed"]);
    expect(result.unclaimedCredits).toHaveLength(0);
  });

  it("does not report already-accounted-for credits as unclaimed", () => {
    const result = reconcile({
      claims: [],
      statement: [credit({ utr: "100000000001" }), credit({ utr: "100000000002" })],
      knownClaimedUtrs: new Set(["100000000001"]),
      now: NOW,
    });
    expect(result.unclaimedCredits.map((r) => r.utr)).toEqual(["100000000002"]);
  });

  it("counts waiting separately from items needing review", () => {
    const summary = summarise(
      reconcile({
        claims: [
          fullClaim({ registrationId: "w", utr: "200000000001", claimedAt: ago(HOUR) }),
          fullClaim({ registrationId: "u", utr: "200000000002", claimedAt: ago(30 * HOUR) }),
        ],
        statement: [],
        now: NOW,
      }),
    );
    expect(summary.waiting).toBe(1);
    expect(summary.unmatched).toBe(1);
    expect(summary.needsReview).toBe(1);
  });
});
