"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitUtrAction, type UtrState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-ti-maroon px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Submitting…" : "I've paid — submit reference"}
    </button>
  );
}

/**
 * Each app labels the bank reference differently, and PhonePe and Google Pay
 * also show their own internal IDs more prominently. Naming the right field
 * per app is what stops members pasting an ID that can never be matched.
 */
const APP_HINTS: [string, string][] = [
  ["Google Pay", "“UPI transaction ID” (not the Google transaction ID)"],
  ["PhonePe", "“UTR” (not the Transaction ID starting with T)"],
  ["Paytm", "“UPI Ref No”"],
  ["BHIM", "“UPI Ref No”"],
  ["Bank apps", "“UTR”, “RRN” or “UPI Ref No”"],
];

export function UtrForm({ slug, ticketId }: { slug: string; ticketId: string }) {
  const action = submitUtrAction.bind(null, slug, ticketId);
  const [state, formAction] = useActionState<UtrState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <label htmlFor="utr" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        UPI reference number
      </label>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Open this payment in your UPI app and copy the{" "}
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">12-digit</strong> reference
        number.
      </p>
      <details className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
        <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
          Where do I find it?
        </summary>
        <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
          {APP_HINTS.map(([app, label]) => (
            <li key={app}>
              <span className="font-medium">{app}:</span> {label}
            </li>
          ))}
        </ul>
      </details>
      <input
        id="utr"
        name="utr"
        required
        inputMode="numeric"
        autoComplete="off"
        placeholder="412345678901"
        aria-invalid={!!state.error}
        aria-describedby={state.error ? "utr-error" : undefined}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-lg tracking-wider text-zinc-900 shadow-sm placeholder:text-zinc-400 outline-none focus:border-ti-blue focus:ring-2 focus:ring-ti-blue/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
      />
      {state.error ? (
        <p id="utr-error" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
