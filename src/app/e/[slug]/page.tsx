import { notFound } from "next/navigation";
import { getEventBySlug, formatEventDate } from "@/lib/events";
import { selectTier, formatPaise } from "@/lib/pricing";
import { RegistrationForm } from "./RegistrationForm";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const tier = selectTier(event.tiers);
  const closed = !event.registrationOpen || !tier;

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Toastmasters District 229
        </p>
        {/* Maroon on near-black is only 1.96:1 — below the 3:1 minimum for large
            text. Dark mode uses the brand gold instead, which clears 14:1. */}
        <h1 className="mt-2 text-3xl font-bold text-ti-maroon dark:text-ti-yellow">
          {event.title}
        </h1>
        <dl className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          <div>
            <dt className="sr-only">When</dt>
            <dd>{formatEventDate(event.startsAt)}</dd>
          </div>
          {event.venue ? (
            <div>
              <dt className="sr-only">Where</dt>
              <dd>{event.venue}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <div className="mt-8 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 shadow-sm sm:p-8">
        {closed ? (
          <div>
            <h2 className="text-lg font-semibold">Registration is closed</h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-300">
              Registration for this conference is no longer open. Please contact{" "}
              <a className="text-ti-blue underline" href={`mailto:${event.supportEmail}`}>
                {event.supportEmail}
              </a>{" "}
              if you think this is a mistake.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-baseline justify-between border-b border-zinc-200 dark:border-zinc-700 pb-4">
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{tier.label}</p>
                <p className="text-2xl font-bold">{formatPaise(tier.amountPaise)}</p>
              </div>
              <p className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                Paid by UPI.
                <br />
                No booking fee.
              </p>
            </div>
            <RegistrationForm slug={slug} enabledFields={event.enabledFields} />
          </>
        )}
      </div>
    </main>
  );
}
