import { notFound } from "next/navigation";
import { CalendarDays, CircleCheck, CircleX, Clock, Info, MapPin, Phone } from "lucide-react";
import { getEventBySlug, formatEventDay, formatEventTime, formatPhone } from "@/lib/events";
import { selectTier, formatPaise } from "@/lib/pricing";
import type { InfoSection } from "@/lib/types";
import { RegistrationForm } from "./RegistrationForm";

export const dynamic = "force-dynamic";

const card =
  "rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8 dark:bg-zinc-800 dark:ring-zinc-700";

const toneStyles: Record<InfoSection["tone"], { icon: typeof Info; iconClass: string }> = {
  do: { icon: CircleCheck, iconClass: "text-emerald-600 dark:text-emerald-400" },
  dont: { icon: CircleX, iconClass: "text-red-600 dark:text-red-400" },
  info: { icon: Info, iconClass: "text-ti-blue dark:text-sky-300" },
};

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Info;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-ti-maroon dark:text-ti-yellow" />
      <div>
        <dt className="sr-only">{label}</dt>
        <dd className="text-zinc-700 dark:text-zinc-200">{children}</dd>
      </div>
    </div>
  );
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const tier = selectTier(event.tiers);
  const closed = !event.registrationOpen || !tier;
  const venueLines =
    event.venue
      ?.split("|")
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
  const sections = event.infoSections ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Toastmasters District 229
        </p>
        {/* Maroon on near-black is only 1.96:1 — below the 3:1 minimum for large
            text. Dark mode uses the brand gold instead, which clears 14:1.
            Sized per screen: at 48px "Exuberance'26" is 351px wide, more than a
            320-375px phone has room for. break-words guards longer names. */}
        <h1 className="mt-2 break-words text-4xl font-extrabold tracking-tight text-ti-maroon min-[400px]:text-5xl sm:text-6xl dark:text-ti-yellow">
          {event.title}
        </h1>
        {event.subtitle ? (
          <p className="mt-3 text-lg font-semibold text-zinc-800 sm:text-xl dark:text-zinc-100">
            {event.subtitle}
          </p>
        ) : null}
        {event.description ? (
          <p className="mt-4 leading-relaxed text-zinc-600 dark:text-zinc-300">
            {event.description}
          </p>
        ) : null}

        <dl className="mt-6 space-y-3">
          <Fact icon={CalendarDays} label="Date">
            {formatEventDay(event.startsAt)}
          </Fact>
          <Fact icon={Clock} label="Time">
            {formatEventTime(event.startsAt)} onwards
          </Fact>
          {venueLines.length > 0 ? (
            <Fact icon={MapPin} label="Venue">
              <span className="font-medium">{venueLines[0]}</span>
              {venueLines.slice(1).map((line) => (
                <span key={line} className="block text-zinc-600 dark:text-zinc-300">
                  {line}
                </span>
              ))}
            </Fact>
          ) : null}
        </dl>
      </header>

      <section className={`mt-8 ${card}`} aria-label="Registration">
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
            <div className="mb-6 flex items-baseline justify-between border-b border-zinc-200 pb-4 dark:border-zinc-700">
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
      </section>

      {sections.length > 0 ? (
        <section className="mt-8" aria-labelledby="guidelines-heading">
          <h2 id="guidelines-heading" className="text-xl font-bold">
            Before you come
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {sections.map((section) => {
              const { icon: Icon, iconClass } = toneStyles[section.tone];
              return (
                <div
                  key={section.heading}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
                >
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <Icon aria-hidden className={`size-5 ${iconClass}`} />
                    {section.heading}
                  </h3>
                  <ul className="mt-3 space-y-3 text-sm">
                    {section.items.map((item, i) => (
                      <li key={i}>
                        {item.title ? (
                          <span className="block font-medium text-zinc-800 dark:text-zinc-100">
                            {item.title}
                          </span>
                        ) : null}
                        <span className="text-zinc-600 dark:text-zinc-300">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {event.contactPhone ? (
        <section className={`mt-8 ${card}`} aria-label="Contact">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Any queries? Reach out to our registration chair
          </p>
          <p className="mt-1 text-lg font-semibold">{event.contactName ?? "Registration desk"}</p>
          <a
            href={`tel:+91${event.contactPhone}`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-ti-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <Phone aria-hidden className="size-4" />
            {formatPhone(event.contactPhone)}
          </a>
        </section>
      ) : null}
    </main>
  );
}
