"use client";

/**
 * Shown instead of a crash when a registration page cannot load — usually a
 * brief database hiccup. Covers every page under /e: the form, the payment
 * page and the confirmation page.
 *
 * Deliberately says nothing about whether a payment went through. If a member
 * already paid, the reassurance that matters is that their money is safe and
 * they should not pay again.
 */
export default function RegistrationError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:p-8 dark:bg-zinc-800 dark:ring-zinc-700">
        <h1 className="text-2xl font-bold">This page didn&apos;t load</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          Something went wrong on our side for a moment. Please try again.
        </p>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          <strong className="font-medium text-zinc-800 dark:text-zinc-100">Already paid?</strong>{" "}
          Your money is safe. Please don&apos;t pay again — reload this page in a minute.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 w-full rounded-lg bg-ti-maroon px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
