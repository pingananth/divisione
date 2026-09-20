"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  uploadStatementAction,
  reconcileAction,
  reviewRegistrationAction,
  type ActionState,
} from "./actions";

function Notice({ state }: { state: ActionState }) {
  if (state.error) {
    return <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/60 px-4 py-3 text-sm text-red-700 dark:text-red-300">{state.error}</p>;
  }
  if (state.message) {
    return (
      <p className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
        {state.message}
      </p>
    );
  }
  return null;
}

function Submit({ idle, busy, className }: { idle: string; busy: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? busy : idle}
    </button>
  );
}

const primaryButton =
  "rounded-lg bg-ti-maroon px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60";
const secondaryButton =
  "rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-60";

export function UploadStatementForm({ slug }: { slug: string }) {
  const action = uploadStatementAction.bind(null, slug);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction}>
      <label htmlFor="statement" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Bank statement (CSV)
      </label>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Export the collecting account from your bank&apos;s net banking as CSV. Overlapping date
        ranges are safe — duplicate credits are ignored.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          id="statement"
          name="statement"
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full max-w-sm text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 dark:file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:hover:file:bg-zinc-600"
        />
        <Submit idle="Upload" busy="Reading…" className={primaryButton} />
      </div>
      <Notice state={state} />
    </form>
  );
}

export function ReconcileButton({ slug }: { slug: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    async () => reconcileAction(slug),
    {},
  );

  return (
    <form action={formAction}>
      <Submit idle="Match payments now" busy="Matching…" className={primaryButton} />
      <Notice state={state} />
    </form>
  );
}

export function ReviewForm({
  slug,
  registrationId,
  ticketId,
}: {
  slug: string;
  registrationId: string;
  ticketId: string;
}) {
  const action = reviewRegistrationAction.bind(null, slug);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="registrationId" value={registrationId} />
      <label htmlFor={`note-${registrationId}`} className="sr-only">
        Note for {ticketId}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`note-${registrationId}`}
          name="note"
          placeholder="Note (emailed to the member if you reject)"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 px-3 py-1.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:text-zinc-400 outline-none focus:border-ti-blue focus:ring-2 focus:ring-ti-blue/20"
        />
        <button
          type="submit"
          name="decision"
          value="confirmed"
          className={`${secondaryButton} text-emerald-700 dark:text-emerald-300`}
        >
          Confirm
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          className={`${secondaryButton} text-red-700 dark:text-red-300`}
        >
          Reject
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}
