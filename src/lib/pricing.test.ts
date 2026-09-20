import { describe, it, expect } from "vitest";
import { selectTier, formatPaise, paiseToUpiAmount, toPaise } from "./pricing";
import type { PriceTier } from "./types";

const earlyBird: PriceTier = {
  id: "early",
  label: "Early bird",
  amountPaise: 25000,
  endsAt: "2026-10-01T23:59:59+05:30",
};
const regular: PriceTier = {
  id: "regular",
  label: "Regular",
  amountPaise: 30000,
  endsAt: "2026-10-15T23:59:59+05:30",
};
const late: PriceTier = { id: "late", label: "Late", amountPaise: 35000, endsAt: null };

const all = [regular, earlyBird, late]; // deliberately unsorted

describe("selectTier", () => {
  it("returns null when an event has no tiers", () => {
    expect(selectTier([], new Date())).toBeNull();
  });

  it("picks the earliest unlapsed tier regardless of input order", () => {
    const at = new Date("2026-09-20T12:00:00+05:30");
    expect(selectTier(all, at)?.id).toBe("early");
  });

  it("falls through to the next tier once early bird lapses", () => {
    const at = new Date("2026-10-02T00:00:00+05:30");
    expect(selectTier(all, at)?.id).toBe("regular");
  });

  it("falls back to the undated tier once every dated tier lapses", () => {
    const at = new Date("2026-11-01T00:00:00+05:30");
    expect(selectTier(all, at)?.id).toBe("late");
  });

  it("treats the cutoff instant as still inside the tier", () => {
    const at = new Date("2026-10-01T23:59:59+05:30");
    expect(selectTier(all, at)?.id).toBe("early");
  });

  it("moves to the next tier one second after the cutoff", () => {
    const at = new Date("2026-10-02T00:00:00+05:30");
    expect(selectTier(all, at)?.id).toBe("regular");
  });

  it("compares as instants, not wall clocks, across timezones", () => {
    // 18:29:59Z is 23:59:59 IST — still early bird.
    expect(selectTier(all, new Date("2026-10-01T18:29:59Z"))?.id).toBe("early");
    // 18:30:00Z is 00:00:00 IST the next day — no longer early bird.
    expect(selectTier(all, new Date("2026-10-01T18:30:00Z"))?.id).toBe("regular");
  });

  it("returns null when all dated tiers lapsed and there is no undated tier", () => {
    const at = new Date("2026-11-01T00:00:00+05:30");
    expect(selectTier([earlyBird, regular], at)).toBeNull();
  });

  it("throws on an unparseable cutoff rather than silently mispricing", () => {
    const bad: PriceTier = { id: "bad", label: "Bad", amountPaise: 100, endsAt: "not-a-date" };
    expect(() => selectTier([bad], new Date())).toThrow(/unparseable/);
  });
});

describe("money formatting", () => {
  it("formats whole rupees without decimals", () => {
    expect(formatPaise(30000)).toBe("₹300");
  });

  it("formats part-rupee amounts with two decimals", () => {
    expect(formatPaise(30050)).toBe("₹300.50");
  });

  it("uses the Indian grouping convention", () => {
    expect(formatPaise(10000000)).toBe("₹1,00,000");
  });

  it("renders UPI amounts with exactly two decimals", () => {
    expect(paiseToUpiAmount(30000)).toBe("300.00");
    expect(paiseToUpiAmount(30050)).toBe("300.50");
  });

  it("round-trips rupees to paise without float drift", () => {
    expect(toPaise(300.1)).toBe(30010);
    expect(toPaise(0.07)).toBe(7);
  });
});
