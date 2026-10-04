import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getRegistrationByTicket } from "@/lib/registrations";
import { buildUpiIntentUrl, buildReference } from "@/lib/upi";
import { formatPaise } from "@/lib/pricing";
import { formatPhone, registrationContact } from "@/lib/events";
import { UtrForm } from "./UtrForm";

export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
}: {
  params: Promise<{ slug: string; ticketId: string }>;
}) {
  const { slug, ticketId } = await params;
  const registration = await getRegistrationByTicket(slug, ticketId);
  if (!registration) notFound();

  // Already paid or already submitted a reference — nothing to do here.
  if (registration.claimedUtr || registration.status !== "pending") {
    redirect(`/e/${slug}/done/${ticketId}`);
  }

  const { event, amountDuePaise } = registration;
  const reference = buildReference(event.refPrefix, registration.ticketId);
  const upiUrl = buildUpiIntentUrl({
    vpa: event.upiVpa,
    payeeName: event.upiPayeeName,
    amountPaise: amountDuePaise,
    reference,
  });

  const contact = registrationContact(event.contacts);
  const qrDataUrl = await QRCode.toDataURL(upiUrl, { margin: 1, width: 320 });

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        Step 2 of 2 · {event.title}
      </p>
      <h1 className="mt-2 text-2xl font-bold">Pay {formatPaise(amountDuePaise)} by UPI</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-300">
        Your seat is held as <strong>{registration.ticketId}</strong>. It is confirmed once we match
        your payment against our bank statement.
      </p>

      <section className="mt-8 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">1. Pay</h2>

        <a
          href={upiUrl}
          className="mt-4 block w-full rounded-lg bg-ti-blue px-4 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:opacity-90 sm:hidden"
        >
          Open my UPI app
        </a>
        <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400 sm:hidden">
          Opens GPay, PhonePe, Paytm or your bank app with the amount filled in.
        </p>

        <div className="mt-4 flex flex-col items-center">
          {/* White tile is deliberate and must NOT get a dark: variant. Scanners
              need dark modules on a light background with a quiet zone around
              them; inverting this for dark mode stops phones reading the code. */}
          <div className="rounded-xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`UPI QR code to pay ${formatPaise(amountDuePaise)} to ${event.upiPayeeName}`}
              width={240}
              height={240}
            />
          </div>
          <p className="mt-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Scan with any UPI app, or pay directly to
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">{event.upiVpa}</p>
          <p className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/60 px-3 py-2 text-center text-xs text-amber-800 dark:text-amber-200">
            Please pay exactly <strong>{formatPaise(amountDuePaise)}</strong>. A different amount
            has to be checked by hand and will delay your confirmation.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm sm:p-8">
        <h2 className="mb-4 text-lg font-semibold">2. Tell us the reference</h2>
        <UtrForm slug={slug} ticketId={ticketId} />
      </section>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Stuck?{" "}
        {contact ? (
          <>
            Call {contact.name}
            {contact.role ? ` (${contact.role})` : ""} on{" "}
            <a className="text-ti-blue underline" href={`tel:+91${contact.phone}`}>
              {formatPhone(contact.phone)}
            </a>
          </>
        ) : (
          <a className="text-ti-blue underline" href={`mailto:${event.supportEmail}`}>
            {event.supportEmail}
          </a>
        )}
      </p>
    </main>
  );
}
