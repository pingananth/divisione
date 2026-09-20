import { serviceClient } from "./supabase";
import { isDemoMode } from "./demo";
import type { EventConfig, CustomFieldKey, PriceTier } from "./types";

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
};

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
  };
}

export async function getEventBySlug(slug: string) {
  if (isDemoMode()) {
    const { demoEvent, DEMO_SLUG } = await import("./demo");
    return slug === DEMO_SLUG ? demoEvent() : null;
  }

  const { data, error } = await serviceClient()
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

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
