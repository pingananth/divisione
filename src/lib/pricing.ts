import type { PriceTier } from "./types";

/**
 * Pick the tier that applies at `at`.
 *
 * Dated tiers are considered in cutoff order; the first one that has not yet
 * lapsed wins. If every dated tier has lapsed we fall back to the undated
 * tier. An event with no undated tier simply stops selling once its last
 * dated tier lapses, which is what an organiser means by a hard close.
 */
export function selectTier(tiers: PriceTier[], at: Date = new Date()): PriceTier | null {
  if (tiers.length === 0) return null;

  const now = at.getTime();

  const dated = tiers
    .filter((t) => t.endsAt !== null)
    .map((t) => ({ tier: t, ends: Date.parse(t.endsAt as string) }))
    .sort((a, b) => a.ends - b.ends);

  for (const { tier, ends } of dated) {
    if (Number.isNaN(ends)) {
      throw new Error(`Tier "${tier.id}" has an unparseable endsAt: ${tier.endsAt}`);
    }
    // Cutoffs are inclusive: a tier ending at 23:59:59 still applies at 23:59:59.
    if (now <= ends) return tier;
  }

  return tiers.find((t) => t.endsAt === null) ?? null;
}

/** Format integer paise as a rupee string for display, e.g. 30000 => "₹300". */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  const hasPaise = paise % 100 !== 0;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Render integer paise as the decimal string a UPI `am` parameter expects. */
export function paiseToUpiAmount(paise: number): string {
  return (paise / 100).toFixed(2);
}

/** Parse a rupee string/number into integer paise, rounding to the nearest paise. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
