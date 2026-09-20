import { serviceClient } from "./supabase";
import { isDemoMode } from "./demo";
import { toEventConfig } from "./events";
import type { RegistrationStatus } from "./types";

export type RegistrationWithEvent = {
  id: string;
  ticketId: string;
  fullName: string;
  email: string;
  amountDuePaise: number;
  tierId: string;
  status: RegistrationStatus;
  createdAt: string;
  claimedUtr: string | null;
  event: ReturnType<typeof toEventConfig>;
};

/**
 * Load a registration by its ticket ID, scoped to the event slug in the URL so
 * a ticket from one Division cannot be viewed through another Division's page.
 */
export async function getRegistrationByTicket(
  slug: string,
  ticketId: string,
): Promise<RegistrationWithEvent | null> {
  if (isDemoMode()) {
    const { demoGetRegistration, DEMO_SLUG } = await import("./demo");
    return slug === DEMO_SLUG ? demoGetRegistration(ticketId) : null;
  }

  const { data, error } = await serviceClient()
    .from("registrations")
    .select("*, events!inner(*), payment_claims(utr)")
    .eq("ticket_id", ticketId)
    .eq("events.slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load registration ${ticketId}: ${error.message}`);
  if (!data) return null;

  const row = data as Record<string, unknown> & {
    events: Parameters<typeof toEventConfig>[0];
    payment_claims: { utr: string }[] | null;
  };

  return {
    id: row.id as string,
    ticketId: row.ticket_id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    amountDuePaise: row.amount_due_paise as number,
    tierId: row.tier_id as string,
    status: row.status as RegistrationStatus,
    createdAt: row.created_at as string,
    claimedUtr: row.payment_claims?.[0]?.utr ?? null,
    event: toEventConfig(row.events),
  };
}
