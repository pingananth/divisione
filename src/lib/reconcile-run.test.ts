import { describe, it, expect } from "vitest";
import { toClaims, matchStatusChanges, describeOutcome } from "./reconcile-run";
import type { MatchOutcome } from "./reconcile";

const pendingRow = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  ticket_id: "ABC123",
  full_name: "Asha Rao",
  email: "asha@example.com",
  amount_due_paise: 30000,
  created_at: "2026-10-03T09:00:00Z",
  match_status: null,
  match_detail: null,
  payment_claims: [{ id: "c1", utr: "412345678901", created_at: "2026-10-03T09:05:00Z" }],
  ...over,
});

describe("toClaims", () => {
  it("carries account, registration time and claim time into each claim", () => {
    expect(toClaims([pendingRow()], "1234")).toEqual([
      {
        registrationId: "r1",
        utr: "412345678901",
        expectedAmountPaise: 30000,
        accountLast4: "1234",
        registeredAt: "2026-10-03T09:00:00Z",
        claimedAt: "2026-10-03T09:05:00Z",
      },
    ]);
  });

  it("skips registrations that have not submitted a reference", () => {
    expect(toClaims([pendingRow({ payment_claims: [] }), pendingRow({ payment_claims: null })], "1234")).toEqual([]);
  });
});

describe("matchStatusChanges", () => {
  const waiting: MatchOutcome = { kind: "waiting", registrationId: "r1", utr: "412345678901" };

  it("records a decision the first time it is made", () => {
    const changes = matchStatusChanges([waiting], new Map());
    expect(changes).toEqual([
      { id: "r1", match_status: "waiting", match_detail: describeOutcome(waiting) },
    ]);
  });

  it("writes nothing when the stored decision is unchanged", () => {
    const current = new Map([
      ["r1", { match_status: "waiting", match_detail: describeOutcome(waiting) }],
    ]);
    expect(matchStatusChanges([waiting], current)).toEqual([]);
  });

  it("writes when a claim moves from waiting to needing review", () => {
    const current = new Map([
      ["r1", { match_status: "waiting", match_detail: describeOutcome(waiting) }],
    ]);
    const unmatched: MatchOutcome = { kind: "unmatched", registrationId: "r1", utr: "412345678901" };
    expect(matchStatusChanges([unmatched], current)).toEqual([
      { id: "r1", match_status: "unmatched", match_detail: describeOutcome(unmatched) },
    ]);
  });

  it("never stores a decision for confirmed registrations", () => {
    const confirmed: MatchOutcome = {
      kind: "confirmed",
      registrationId: "r1",
      utr: "412345678901",
      row: { utr: "412345678901", amountPaise: 30000, valueDate: "", narration: "" },
    };
    expect(matchStatusChanges([confirmed], new Map())).toEqual([]);
  });
});

describe("describeOutcome", () => {
  it("explains every kind in plain English", () => {
    const row = { utr: "412345678901", amountPaise: 25000, valueDate: "", narration: "" };
    const outcomes: MatchOutcome[] = [
      { kind: "confirmed", registrationId: "r", utr: "412345678901", row },
      { kind: "waiting", registrationId: "r", utr: "412345678901" },
      { kind: "unmatched", registrationId: "r", utr: "412345678901" },
      { kind: "amount_mismatch", registrationId: "r", utr: "412345678901", expectedAmountPaise: 30000, creditedAmountPaise: 25000, row },
      { kind: "duplicate_claim", registrationId: "r", utr: "412345678901", claimedBy: ["a", "b"] },
      { kind: "wrong_account", registrationId: "r", utr: "412345678901", expectedAccount: "1234", creditedAccount: "9999", row },
      { kind: "stale_payment", registrationId: "r", utr: "412345678901", creditedAt: "x", registeredAt: "y", row },
    ];
    const text = outcomes.map(describeOutcome);
    expect(text.every((t) => t.length > 10)).toBe(true);
    expect(text[3]).toBe("Paid ₹250 but owes ₹300.");
    expect(text[5]).toBe("Paid into account ending 9999, not 1234.");
  });
});
