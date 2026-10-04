import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase-server";
import { isDemoMode } from "@/lib/demo";
import { DemoAdminNotice } from "@/components/DemoAdminNotice";
import { formatPaise } from "@/lib/pricing";
import { REVIEW_KINDS, type OutcomeKind } from "@/lib/reconcile";
import { optionLabel, ATTENDEE_TYPES } from "@/lib/registration";
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
  attendee_type: string | null;
  tier_id: string;
  amount_due_paise: number;
  status: "pending" | "confirmed" | "rejected";
  review_note: string | null;
  created_at: string;
  match_status: OutcomeKind | null;
  match_detail: string | null;
  payment_claims: { utr: string; matched_at: string | null; created_at: string }[] | null;
};

/** "3 h ago" / "2 d ago" — how long a registration has been waiting. */
function ago(iso: string): string {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 3_600_000));
  return hours < 48 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
}

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
    .select("id, title, venue, starts_at, upi_vpa, registration_open, account_last4, tiers")
    .eq("slug", slug)
    .maybeSingle();

  if (eventError) throw new Error(`Failed to load conference: ${eventError.message}`);
  if (!event) notFound();

  const [{ data: regData, error: regError }, { count: creditCount }] = await Promise.all([
    db
      .from("registrations")
      .select(
        "id, ticket_id, full_name, email, phone, club, attendee_type, tier_id, amount_due_paise, status, review_note, created_at, match_status, match_detail, payment_claims(utr, matched_at, created_at)",
      )
      .eq("event_id", event.id)
      .order("created_at", { ascending: false }),
    event.account_last4
      ? db
          .from("bank_credits")
          .select("id", { count: "exact", head: true })
          .eq("account_last4", event.account_last4)
      : Promise.resolve({ count: 0 }),
  ]);

  if (regError) throw new Error(`Failed to load registrations: ${regError.message}`);
  const registrations = (regData ?? []) as RegistrationRow[];

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const pending = registrations.filter((r) => r.status === "pending");
  const submitted = pending.filter((r) => r.payment_claims?.[0]?.utr);
  // Only decisions the rules refused to make reach a human. Everything else
  // that has a reference is simply waiting for the bank to report it.
  const awaitingReview = submitted.filter(
    (r) => r.match_status !== null && REVIEW_KINDS.has(r.match_status),
  );
  const waitingForBank = submitted.filter(
    (r) => r.match_status === null || !REVIEW_KINDS.has(r.match_status),
  );
  const awaitingPayment = pending.filter((r) => !r.payment_claims?.[0]?.utr);
  // Main table: anyone with a decision or a payment reference. Registrations
  // that never paid get their own list, so they don't crowd out real payments.
  const withPayment = registrations.filter(
    (r) => r.status !== "pending" || r.payment_claims?.[0]?.utr,
  );
  const ticketLabel = new Map(
    ((event.tiers ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
  );
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

      {!event.account_last4 ? (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          No collecting account is set for this conference, so payments cannot be matched. Ask the
          District admin to add the last 4 digits of the bank account.
        </p>
      ) : null}

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Confirmed" value={String(confirmed.length)} tone="text-emerald-700 dark:text-emerald-300" />
        <Stat label="Needs review" value={String(awaitingReview.length)} tone="text-amber-700 dark:text-amber-300" />
        <Stat label="Waiting for bank" value={String(waitingForBank.length)} />
        <Stat label="Not paid yet" value={String(awaitingPayment.length)} />
        <Stat label="Collected" value={formatPaise(collectedPaise)} />
      </section>

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Payments</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {creditCount ?? 0} bank credit{creditCount === 1 ? "" : "s"} loaded
          {event.account_last4 ? ` for the account ending ${event.account_last4}` : ""}. Matching
          runs on its own whenever a member submits a reference, after every upload, and every few
          minutes.
        </p>
        <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <UploadStatementForm slug={slug} />
        </div>
        <div className="mt-6 border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
            You should rarely need this — it runs the same matching on demand.
          </p>
          <ReconcileButton slug={slug} />
        </div>
      </section>

      {awaitingReview.length > 0 ? (
        <section className="mt-6 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Needs review ({awaitingReview.length})</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            The rules would not confirm these on their own. The reason is shown on each — check it
            against your bank before deciding.
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
                {r.match_detail ? (
                  <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-200">
                    {r.match_detail}
                  </p>
                ) : null}
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {r.email} · {r.phone}
                </p>
                <ReviewForm slug={slug} registrationId={r.id} ticketId={r.ticket_id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Collapsed by default so "Needs review" stays the focus, but an organiser
          can still confirm a payment they can already see in the bank app, or
          someone who paid cash at the desk. */}
      {waitingForBank.length > 0 ? (
        <details className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
          <summary className="cursor-pointer text-lg font-semibold">
            Waiting for bank ({waitingForBank.length})
          </summary>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Reference submitted, not in the bank records yet. These confirm on their own once the
            statement arrives — confirm early only if you can see the money in your bank app.
          </p>
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-700">
            {waitingForBank.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {r.full_name}{" "}
                    <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">{r.ticket_id}</span>
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    owes {formatPaise(r.amount_due_paise)} · ref{" "}
                    <span className="font-mono">{r.payment_claims?.[0]?.utr}</span> · submitted{" "}
                    {r.payment_claims?.[0]?.created_at ? ago(r.payment_claims[0].created_at) : "—"}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {r.email} · {r.phone}
                </p>
                <ReviewForm slug={slug} registrationId={r.id} ticketId={r.ticket_id} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {awaitingPayment.length > 0 ? (
        <details className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
          <summary className="cursor-pointer text-lg font-semibold">
            Not paid yet ({awaitingPayment.length})
          </summary>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Registered but never entered a UPI reference. To confirm one — for example, cash paid
            at the desk — write how they paid in the note.
          </p>
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-700">
            {awaitingPayment.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {r.full_name}{" "}
                    <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">{r.ticket_id}</span>
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    owes {formatPaise(r.amount_due_paise)} · registered {ago(r.created_at)}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {r.email} · {r.phone}
                </p>
                <ReviewForm slug={slug} registrationId={r.id} ticketId={r.ticket_id} noUtr />
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Registrations ({withPayment.length})</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Confirmed, rejected, and everyone who has submitted a payment reference. People who
          registered but never paid are in &ldquo;Not paid yet&rdquo; above.
        </p>
        {withPayment.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No registrations yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 dark:border-zinc-700 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">Ticket</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Club / attending as</th>
                  <th className="py-2 pr-4 font-medium">Ticket</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Reference</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {withPayment.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 font-mono">{r.ticket_id}</td>
                    <td className="py-2 pr-4">
                      <span className="block font-medium">{r.full_name}</span>
                      <span className="block text-xs text-zinc-500 dark:text-zinc-400">{r.email}</span>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">
                      {r.club ?? (r.attendee_type ? optionLabel(ATTENDEE_TYPES, r.attendee_type) : "—")}
                    </td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">
                      {ticketLabel.get(r.tier_id) ?? r.tier_id}
                    </td>
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
