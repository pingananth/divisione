import type { PriceTier } from "./types";

type QueryValue = string | string[] | undefined;

const first = (v: QueryValue) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Starting values for the registration form from a shared link, e.g. a QR code
 * on an ad: `/e/<slug>?type=guest&ref=mall-campaign`.
 *
 * `type` names the ticket kind ("guest"), not a tier id, so one printed link
 * keeps working whether the guest offer is on ("guest-offer") or off
 * ("guest"). `ref` pre-fills "who invited you". Both are only a starting
 * point: the member can change them, and the server still prices the ticket.
 */
export function prefillFromQuery(
  tickets: Pick<PriceTier, "id" | "ticket">[],
  query: Record<string, QueryValue>,
): Record<string, string> {
  const out: Record<string, string> = {};

  const type = first(query.type).trim().toLowerCase();
  const ticket = type ? tickets.find((t) => t.ticket === type) : undefined;
  if (ticket) out.ticket = ticket.id;

  const ref = first(query.ref).trim().slice(0, 120);
  if (ref) out.invitedBy = ref;

  return out;
}
