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

export function UtrForm({ slug, ticketId }: { slug: string; ticketId: string }) {
  const action = submitUtrAction.bind(null, slug, ticketId);
  const [state, formAction] = useActionState<UtrState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <label htmlFor="utr" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        UPI reference number
      </label>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Open the payment in your UPI app and look for the 12-digit{" "}
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">UTR</strong>,{" "}
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">RRN</strong> or{" "}
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">transaction reference</strong>.
      </p>
      <input
        id="utr"
        name="utr"
        required
        inputMode="numeric"
        autoComplete="off"
        placeholder="412345678901"
        aria-invalid={!!state.error}
        aria-describedby={state.error ? "utr-error" : undefined}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 px-3 py-2 font-mono text-lg tracking-wider text-zinc-900 shadow-sm placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:text-zinc-300 outline-none focus:border-ti-blue focus:ring-2 focus:ring-ti-blue/20"
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
