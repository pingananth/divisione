import type { EventConfig } from "./types";
import type { RegistrationWithEvent } from "./registrations";
import { toEventConfig } from "./events";

/**
 * Demo mode: run the whole member-facing flow with no database.
 *
 * Active in development whenever Supabase is not configured, so `npm run dev`
 * works on a fresh clone and the UI can be reviewed before anyone signs up for
 * anything. Registrations live in memory and vanish on restart — that is the
 * point, not a limitation.
 *
 * Deliberately NOT active on a production build by default. A live site that
 * quietly fell back to an in-memory store would show a "do not pay" banner on
 * every page of the site, and would take real registrations into nothing. A
 * misconfigured deploy should fail loudly on the registration routes instead,
 * leaving the rest of the site untouched.
 *
 * Set ALLOW_DEMO_MODE=1 to opt a deployed preview in on purpose.
 */
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  if (process.env.NODE_ENV === "production") return process.env.ALLOW_DEMO_MODE === "1";
  return true;
}

export const DEMO_SLUG = "demo";

const demoEventRow = {
  id: "demo-event",
  slug: DEMO_SLUG,
  title: "Division E Annual Conference 2026 (Demo)",
  venue: "Chennai Trade Centre, Nandambakkam",
  starts_at: "2026-10-04T09:00:00+05:30",
  ends_at: "2026-10-04T18:00:00+05:30",
  upi_vpa: "demo@okhdfcbank",
  upi_payee_name: "Division E Conference",
  ref_prefix: "E",
  tiers: [
    { id: "early", label: "Early bird", amountPaise: 25000, endsAt: "2026-09-25T23:59:59+05:30" },
    { id: "regular", label: "Regular", amountPaise: 30000, endsAt: null },
  ],
  enabled_fields: ["club", "area", "division", "mealPreference", "tshirtSize"],
  support_email: "divisione@example.org",
  registration_open: true,
};

export function demoEvent(): EventConfig & { supportEmail: string } {
  return toEventConfig(demoEventRow);
}

type DemoRegistration = {
  id: string;
  ticketId: string;
  fullName: string;
  email: string;
  amountDuePaise: number;
  tierId: string;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
  claimedUtr: string | null;
};

/**
 * Module-level store. Survives hot reloads via globalThis so a registration
 * made before an edit is still there afterwards.
 */
const store: Map<string, DemoRegistration> =
  (globalThis as { __d229Demo?: Map<string, DemoRegistration> }).__d229Demo ??
  ((globalThis as { __d229Demo?: Map<string, DemoRegistration> }).__d229Demo = new Map());

export function demoCreateRegistration(reg: {
  ticketId: string;
  fullName: string;
  email: string;
  tierId: string;
  amountDuePaise: number;
}): void {
  store.set(reg.ticketId, {
    id: `demo-${reg.ticketId}`,
    ticketId: reg.ticketId,
    fullName: reg.fullName,
    email: reg.email,
    amountDuePaise: reg.amountDuePaise,
    tierId: reg.tierId,
    status: "pending",
    createdAt: new Date().toISOString(),
    claimedUtr: null,
  });
}

export function demoGetRegistration(ticketId: string): RegistrationWithEvent | null {
  const reg = store.get(ticketId);
  if (!reg) return null;
  return { ...reg, event: demoEvent() };
}

export type DemoClaimResult = { ok: true } | { ok: false; error: string };

export function demoSubmitUtr(ticketId: string, utr: string): DemoClaimResult {
  const reg = store.get(ticketId);
  if (!reg) return { ok: false, error: "This registration could not be found." };

  // Mirror the real unique-UTR constraint, so the demo shows the same error
  // a member would actually hit.
  for (const other of store.values()) {
    if (other.ticketId !== ticketId && other.claimedUtr === utr) {
      return {
        ok: false,
        error:
          "That UPI reference has already been used for another registration. " +
          "Please check the reference in your UPI app, or contact us if you think this is wrong.",
      };
    }
  }

  reg.claimedUtr = utr;
  return { ok: true };
}
