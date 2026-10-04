import { serviceClient } from "./supabase";
import { isDemoMode } from "./demo";
import { retryRead } from "./retry";
import { z } from "zod";
import type { EventConfig, CustomFieldKey, PriceTier, InfoSection, EventContact } from "./types";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  starts_at: string;
  ends_at: string;
  upi_vpa: string;
  upi_payee_name: string;
  ref_prefix: string;
  tiers: PriceTier[];
  enabled_fields: string[];
  support_email: string;
  registration_open: boolean;
  subtitle?: string | null;
  description?: string | null;
  info_sections?: unknown;
  contacts?: unknown;
};

const contactsSchema = z.array(
  z.object({
    name: z.string().min(1),
    role: z.string().optional(),
    // Accept "+91 88833 88222" as typed, keep the 10 digits.
    phone: z
      .string()
      .transform((v) => v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))
      .pipe(z.string().regex(/^[6-9]\d{9}$/)),
  }),
);

/** Contacts typed by hand into the database; a malformed list is dropped and logged. */
export function parseContacts(raw: unknown, slug = "?"): EventContact[] {
  if (raw === null || raw === undefined) return [];
  const parsed = contactsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[events] ignoring malformed contacts for "${slug}": ${parsed.error.message}`);
    return [];
  }
  return parsed.data;
}

/** The person to call about a stuck payment: the registration chair, else the first contact. */
export function registrationContact(contacts: EventContact[] = []): EventContact | undefined {
  return contacts.find((c) => /registration/i.test(c.role ?? "")) ?? contacts[0];
}

const infoSectionsSchema = z.array(
  z.object({
    heading: z.string().min(1),
    tone: z.enum(["do", "dont", "info"]).catch("info"),
    items: z.array(z.object({ title: z.string().optional(), text: z.string().min(1) })),
  }),
);

/**
 * Read guideline sections typed by hand into the database. A mistake there
 * (a missing heading, a misspelt key) drops the sections and logs it, rather
 * than taking the whole registration page down.
 */
export function parseInfoSections(raw: unknown, slug = "?"): InfoSection[] {
  if (raw === null || raw === undefined) return [];
  const parsed = infoSectionsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[events] ignoring malformed info_sections for "${slug}": ${parsed.error.message}`);
    return [];
  }
  return parsed.data;
}

export function toEventConfig(row: EventRow): EventConfig & { supportEmail: string } {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    venue: row.venue,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    upiVpa: row.upi_vpa,
    upiPayeeName: row.upi_payee_name,
    refPrefix: row.ref_prefix,
    tiers: row.tiers ?? [],
    enabledFields: (row.enabled_fields ?? []) as CustomFieldKey[],
    registrationOpen: row.registration_open,
    supportEmail: row.support_email,
    subtitle: row.subtitle ?? null,
    description: row.description ?? null,
    infoSections: parseInfoSections(row.info_sections, row.slug),
    contacts: parseContacts(row.contacts, row.slug),
  };
}

export async function getEventBySlug(slug: string) {
  if (isDemoMode()) {
    const { demoEvent, DEMO_SLUG } = await import("./demo");
    return slug === DEMO_SLUG ? demoEvent() : null;
  }

  const { data, error } = await retryRead((signal) =>
    serviceClient().from("events").select("*").eq("slug", slug).abortSignal(signal).maybeSingle(),
  );

  if (error) throw new Error(`Failed to load event "${slug}": ${error.message}`);
  return data ? toEventConfig(data as EventRow) : null;
}

/** Format an event datetime for display, always in IST. */
export function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** Event date only, in IST, e.g. "Saturday, 31 October 2026". */
export function formatEventDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** Start time only, in IST, e.g. "9:00 AM". */
export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
    .format(new Date(iso))
    .toUpperCase();
}

/** Format a 10-digit Indian mobile the way people write it: "70107 37617". */
export function formatPhone(digits: string): string {
  return /^\d{10}$/.test(digits) ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}
