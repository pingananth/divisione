import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";
import { csvDocument } from "@/lib/csv-export";
import { optionLabel, ATTENDEE_TYPES, VEHICLE_TYPES, GOV_ID_TYPES } from "@/lib/registration";

export const dynamic = "force-dynamic";

type Row = {
  ticket_id: string;
  full_name: string;
  email: string;
  phone: string;
  club: string | null;
  area: string | null;
  division: string | null;
  meal_preference: string | null;
  tshirt_size: string | null;
  attendee_type: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  gov_id_type: string | null;
  gov_id_number: string | null;
  tier_id: string;
  amount_due_paise: number;
  status: string;
  review_note: string | null;
  created_at: string;
  payment_claims: { utr: string; matched_at: string | null }[] | null;
};

const HEADER = [
  "Ticket ID",
  "Name",
  "Email",
  "Phone",
  "Club",
  "Area",
  "Division",
  "Meal",
  "T-shirt",
  "Attending as",
  "Travelling by",
  "Vehicle number",
  "ID type",
  "ID number",
  "Ticket",
  "Amount (INR)",
  "Status",
  "UPI reference",
  "Matched at",
  "Review note",
  "Registered at",
];

/**
 * Per-event registration export.
 *
 * This is the audit trail: every rupee collected, traceable to a named
 * registrant and a bank reference. With collection running through individual
 * accounts rather than a registered entity, that trail is what makes the money
 * accountable, so it exports in full rather than as a summary.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // RLS scopes this to events the organiser actually runs.
  const { data: event, error: eventError } = await db
    .from("events")
    .select("id, title, tiers")
    .eq("slug", slug)
    .maybeSingle();

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await db
    .from("registrations")
    .select(
      "ticket_id, full_name, email, phone, club, area, division, meal_preference, tshirt_size, attendee_type, vehicle_type, vehicle_number, gov_id_type, gov_id_number, tier_id, amount_due_paise, status, review_note, created_at, payment_claims(utr, matched_at)",
    )
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ticketLabel = new Map(
    ((event.tiers ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
  );

  const rows = ((data ?? []) as Row[]).map((r) => {
    const claim = r.payment_claims?.[0];
    return [
      r.ticket_id,
      r.full_name,
      r.email,
      r.phone,
      r.club,
      r.area,
      r.division,
      r.meal_preference,
      r.tshirt_size,
      optionLabel(ATTENDEE_TYPES, r.attendee_type),
      optionLabel(VEHICLE_TYPES, r.vehicle_type),
      r.vehicle_number,
      optionLabel(GOV_ID_TYPES, r.gov_id_type),
      r.gov_id_number,
      ticketLabel.get(r.tier_id) ?? r.tier_id,
      (r.amount_due_paise / 100).toFixed(2),
      r.status,
      claim?.utr ?? "",
      claim?.matched_at ?? "",
      r.review_note,
      r.created_at,
    ];
  });

  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(csvDocument(HEADER, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-registrations-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
