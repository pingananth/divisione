import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase-server";
import { isDemoMode } from "@/lib/demo";
import { DemoAdminNotice } from "@/components/DemoAdminNotice";
import { formatPaise } from "@/lib/pricing";
import { formatEventDate } from "@/lib/events";
import { UploadStatementForm, ReconcileButton, ReviewForm } from "./AdminForms";

export const dynamic = "force-dynamic";

type RegistrationRow = {
  id: string;
  ticket_id: string;
  full_name: string;
  email: string;
  phone: string;
  club: string | null;
  amount_due_paise: number;
  status: "pending" | "confirmed" | "rejected";
  review_note: string | null;
  created_at: string;
  payment_claims: { utr: string; matched_at: string | null }[] | null;
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

const statusStyles: Record<RegistrationRow["status"], string> = {
  confirmed: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  pending: "bg-amber-50 dark:bg-amber-950/60 text-amber-700",
  rejected: "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300",
};

export default async function EventAdminPage({ params }: { params: Promise<{ slug: string }> }) {
  if (isDemoMode()) return <DemoAdminNotice />;

  const { slug } = await params;
  const { db, user } = await requireUser();
  if (!user) redirect("/admin/login");

  // RLS returns nothing unless this organiser runs this event.
  const { data: event, error: eventError } = await db
    .from("events")
    .select("id, title, venue, starts_at, upi_vpa, registration_open")
    .eq("slug", slug)
    .maybeSingle();

  if (eventError) throw new Error(`Failed to load conference: ${eventError.message}`);
  if (!event) notFound();

  const [{ data: regData, error: regError }, { count: creditCount }] = await Promise.all([
    db
      .from("registrations")
      .select(
        "id, ticket_id, full_name, email, phone, club, amount_due_paise, status, review_note, created_at, payment_claims(utr, matched_at)",
      )
      .eq("event_id", event.id)
      .order("created_at", { ascending: false }),
    db
      .from("statement_rows")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id),
  ]);

  if (regError) throw new Error(`Failed to load registrations: ${regError.message}`);
  const registrations = (regData ?? []) as RegistrationRow[];

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const pending = registrations.filter((r) => r.status === "pending");
  // Pending registrations that submitted a reference are the ones reconciliation
  // could not clear — the exception tail an organiser actually has to work.
  const awaitingReview = pending.filter((r) => r.payment_claims?.[0]?.utr);
  const awaitingPayment = pending.filter((r) => !r.payment_claims?.[0]?.utr);
  const collectedPaise = confirmed.reduce((sum, r) => sum + r.amount_due_paise, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-ti-blue hover:underline">
            ← All conferences
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{event.title}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {formatEventDate(event.starts_at)}
            {event.venue ? ` · ${event.venue}` : ""} · collecting to{" "}
            <span className="font-mono">{event.upi_vpa}</span>
          </p>
        </div>
        <a href={`/admin/${slug}/export`} className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-700">
          Export CSV
        </a>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Confirmed" value={String(confirmed.length)} tone="text-emerald-700 dark:text-emerald-300" />
        <Stat label="Needs review" value={String(awaitingReview.length)} tone="text-amber-700" />
        <Stat label="Awaiting payment" value={String(awaitingPayment.length)} />
        <Stat label="Collected" value={formatPaise(collectedPaise)} />
      </section>

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Reconcile</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {creditCount ?? 0} bank credit{creditCount === 1 ? "" : "s"} loaded so far.
        </p>
        <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <UploadStatementForm slug={slug} />
        </div>
        <div className="mt-6 border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            Matches submitted references against loaded credits and confirms the exact matches.
            Safe to run as often as you like.
          </p>
          <ReconcileButton slug={slug} />
        </div>
      </section>

      {awaitingReview.length > 0 ? (
        <section className="mt-6 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Needs review ({awaitingReview.length})</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            These submitted a reference that did not match a credit exactly. Check the reference
            against your bank before confirming.
          </p>
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-700">
            {awaitingReview.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {r.full_name}{" "}
                    <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">{r.ticket_id}</span>
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    owes {formatPaise(r.amount_due_paise)} · ref{" "}
                    <span className="font-mono">{r.payment_claims?.[0]?.utr}</span>
                  </span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {r.email} · {r.phone}
                </p>
                <ReviewForm slug={slug} registrationId={r.id} ticketId={r.ticket_id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold">All registrations ({registrations.length})</h2>
        {registrations.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No registrations yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-700 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">Ticket</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Club</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Reference</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 font-mono">{r.ticket_id}</td>
                    <td className="py-2 pr-4">
                      <span className="block font-medium">{r.full_name}</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">{r.email}</span>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">{r.club ?? "—"}</td>
                    <td className="py-2 pr-4">{formatPaise(r.amount_due_paise)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {r.payment_claims?.[0]?.utr ?? "—"}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
