import { notFound } from "next/navigation";
import { getRegistrationByTicket } from "@/lib/registrations";
import { formatPaise } from "@/lib/pricing";
import { formatEventDate } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function DonePage({
  params,
}: {
  params: Promise<{ slug: string; ticketId: string }>;
}) {
  const { slug, ticketId } = await params;
  const registration = await getRegistrationByTicket(slug, ticketId);
  if (!registration) notFound();

  const { event, status } = registration;

  const headline =
    status === "confirmed"
      ? "You're confirmed"
      : status === "rejected"
        ? "This registration was not confirmed"
        : "Payment is being verified";

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {event.title}
        </p>
        <h1 className="mt-2 text-2xl font-bold">{headline}</h1>

        {status === "pending" ? (
          <p className="mt-3 text-zinc-600 dark:text-zinc-300">
            Thanks, {registration.fullName}. We check every payment against our bank statement, which
            usually takes a day or two. We&apos;ll email {registration.email} the moment it clears —
            no need to do anything else.
          </p>
        ) : null}

        {status === "confirmed" ? (
          <p className="mt-3 text-zinc-600 dark:text-zinc-300">
            Your payment has been matched and your seat is confirmed. Please bring your Ticket ID to
            the registration desk.
          </p>
        ) : null}

        {status === "rejected" ? (
          <p className="mt-3 text-zinc-600 dark:text-zinc-300">
            We could not verify a payment for this registration. Please write to{" "}
            <a className="text-ti-blue underline" href={`mailto:${event.supportEmail}`}>
              {event.supportEmail}
            </a>{" "}
            and we&apos;ll sort it out.
          </p>
        ) : null}

        <dl className="mt-6 space-y-3 border-t border-zinc-200 dark:border-zinc-700 pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Ticket ID</dt>
            <dd className="font-mono text-base font-bold">{registration.ticketId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
            <dd className="font-medium">{registration.fullName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">When</dt>
            <dd className="text-right font-medium">{formatEventDate(event.startsAt)}</dd>
          </div>
          {event.venue ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Where</dt>
              <dd className="text-right font-medium">{event.venue}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500 dark:text-zinc-400">Amount</dt>
            <dd className="font-medium">{formatPaise(registration.amountDuePaise)}</dd>
          </div>
          {registration.claimedUtr ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">UPI reference</dt>
              <dd className="font-mono font-medium">{registration.claimedUtr}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Keep this page or your Ticket ID handy — it&apos;s how we find you at the desk.
      </p>
    </main>
  );
}
