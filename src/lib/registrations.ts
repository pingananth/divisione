import { serviceClient } from "./supabase";
import { isDemoMode } from "./demo";
import { retryRead } from "./retry";
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
  /** The app's own ID, when the member had no 12-digit UTR to give. */
  claimedAppRef: string | null;
  /** Submitted proof of payment of any kind: UTR, app ID or screenshot. */
  hasClaim: boolean;
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
    return slug === DEMO_SLUG ? await demoGetRegistration(ticketId) : null;
  }

  const { data, error } = await retryRead((signal) =>
    serviceClient()
      .from("registrations")
      .select("*, events!inner(*), payment_claims(utr, app_ref)")
      .eq("ticket_id", ticketId)
      .eq("events.slug", slug)
      .abortSignal(signal)
      .maybeSingle(),
  );

  if (error) throw new Error(`Failed to load registration ${ticketId}: ${error.message}`);
  if (!data) return null;

  const row = data as Record<string, unknown> & {
    events: Parameters<typeof toEventConfig>[0];
    payment_claims: { utr: string | null; app_ref: string | null }[] | null;
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
    claimedAppRef: row.payment_claims?.[0]?.app_ref ?? null,
    hasClaim: (row.payment_claims?.length ?? 0) > 0,
    event: toEventConfig(row.events),
  };
}
