import { cookies } from "next/headers";
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

/**
 * Mirrors a real event's shape, including the optional page content, so the
 * full page layout can be reviewed without a database.
 */
const demoEventRow = {
  id: "demo-event",
  slug: DEMO_SLUG,
  title: "Exuberance'26 (Demo)",
  subtitle: "Division A Humorous Speech & Evaluation Contest",
  description:
    "We’re excited to host the Division A Humorous Speech & Evaluation Contest, and we look forward to welcoming Contestants, Role Players, and Guests to this vibrant event.",
  venue:
    "Lennox India Technology Centre | Capital Land Phase 3 - Zenith - 10th floor | CSIR Road, Tharamani, Chennai",
  starts_at: "2026-10-31T09:00:00+05:30",
  ends_at: "2026-10-31T18:00:00+05:30",
  upi_vpa: "demo@okhdfcbank",
  upi_payee_name: "Division A Contest",
  ref_prefix: "A",
  tiers: [{ id: "regular", label: "Registration", amountPaise: 30000, endsAt: null }],
  enabled_fields: ["attendeeType", "mealPreference", "vehicle", "governmentId"],
  support_email: "demo@example.org",
  registration_open: true,
  info_sections: [
    {
      heading: "Do's",
      tone: "do",
      items: [
        {
          title: "Credentials & ID",
          text: "Kindly carry your Government ID with you while attending the conference.",
        },
        {
          title: "Escort & Support",
          text: "Request a Lennox employee to escort you when visiting vending machines or navigating between floors.",
        },
      ],
    },
    {
      heading: "Don'ts",
      tone: "dont",
      items: [
        {
          title: "Prohibited Items",
          text: "Do not bring unapproved electronics (laptops, power banks, non-mobile cameras, USB drives, or HDMI cables) or flammable materials into the facility.",
        },
        {
          title: "Photography & Media",
          text: "Do not record any video footage on office grounds or take photos that capture Lennox logos.",
        },
      ],
    },
  ],
  contacts: [
    { name: "TM Kowsalya", role: "Conference Chair", phone: "7010737617" },
    { name: "TM Rajan", role: "Registration Chair", phone: "8883388222" },
  ],
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
 * Demo registrations live in the viewer's own cookie, not in server memory.
 *
 * A module-level Map works on a laptop but not on serverless hosting, where
 * consecutive requests can land on different instances — a member would
 * register and then get a 404 on the payment page. A cookie follows the
 * viewer, so the flow holds together wherever this is deployed, and each
 * visitor gets their own sandbox rather than seeing other people's test data.
 */
const COOKIE = "d229_demo";
const MAX_KEPT = 10;

async function read(): Promise<DemoRegistration[]> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DemoRegistration[]) : [];
  } catch {
    // A malformed cookie is a demo inconvenience, never an error worth showing.
    return [];
  }
}

/**
 * Only callable from a Server Action or Route Handler — Server Components
 * cannot set cookies.
 */
async function write(rows: DemoRegistration[]): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(rows.slice(-MAX_KEPT)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function demoCreateRegistration(reg: {
  ticketId: string;
  fullName: string;
  email: string;
  tierId: string;
  amountDuePaise: number;
}): Promise<void> {
  const rows = await read();
  rows.push({
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
  await write(rows);
}

export async function demoGetRegistration(
  ticketId: string,
): Promise<RegistrationWithEvent | null> {
  const reg = (await read()).find((r) => r.ticketId === ticketId);
  return reg ? { ...reg, event: demoEvent() } : null;
}

export type DemoClaimResult = { ok: true } | { ok: false; error: string };

export async function demoSubmitUtr(ticketId: string, utr: string): Promise<DemoClaimResult> {
  const rows = await read();
  const reg = rows.find((r) => r.ticketId === ticketId);
  if (!reg) return { ok: false, error: "This registration could not be found." };

  // Mirror the real unique-UTR constraint, so the demo shows the same error a
  // member would actually hit.
  if (rows.some((r) => r.ticketId !== ticketId && r.claimedUtr === utr)) {
    return {
      ok: false,
      error:
        "That UPI reference has already been used for another registration. " +
        "Please check the reference in your UPI app, or contact us if you think this is wrong.",
    };
  }

  reg.claimedUtr = utr;
  await write(rows);
  return { ok: true };
}
