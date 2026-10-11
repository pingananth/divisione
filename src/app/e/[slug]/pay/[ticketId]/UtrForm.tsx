"use client";

import { startTransition, useActionState, useState } from "react";
import { submitUtrAction, type UtrState } from "./actions";
import { findUtrInText } from "@/lib/utr-ocr";

function SubmitButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-lg bg-ti-maroon px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Submitting…" : "I've paid — submit"}
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
  [
    "Bank apps",
    "“UTR”, “RRN” or “UPI Ref No” if shown — otherwise the Transaction ID, plus a screenshot",
  ],
];

type OcrState =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "found"; utr: string }
  | { kind: "not_found" };

/**
 * Shrink a phone screenshot to a few hundred KB before upload. Organisers only
 * need to read it, and full-size PNGs from some phones run to several MB.
 */
async function shrink(file: File): Promise<Blob> {
  const MAX_SIDE = 1600;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.8),
  );
}

/** Read the screenshot on the member's own phone: free, and nothing is sent until they submit. */
async function readUtr(file: File): Promise<string | null> {
  // Loaded only when someone picks an image, so the page itself stays light.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(file);
    return findUtrInText(data.text);
  } finally {
    await worker.terminate();
  }
}

export function UtrForm({ slug, ticketId }: { slug: string; ticketId: string }) {
  const action = submitUtrAction.bind(null, slug, ticketId);
  const [state, formAction, pending] = useActionState<UtrState, FormData>(action, {});
  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState<{ name: string; blob: Blob } | null>(null);
  const [ocr, setOcr] = useState<OcrState>({ kind: "idle" });
  const [pickError, setPickError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    setPickError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPickError("Please choose an image — a screenshot of the payment.");
      return;
    }
    setOcr({ kind: "reading" });
    try {
      setScreenshot({ name: file.name, blob: await shrink(file) });
    } catch {
      setOcr({ kind: "idle" });
      setPickError("Couldn't open that image. Please try another screenshot.");
      return;
    }
    try {
      const found = await readUtr(file);
      if (found) {
        setUtr(found);
        setOcr({ kind: "found", utr: found });
      } else {
        setOcr({ kind: "not_found" });
      }
    } catch (err) {
      // Reading is a convenience; the screenshot alone is still enough.
      console.error("[UtrForm] could not read screenshot", err);
      setOcr({ kind: "not_found" });
    }
  }

  function removeScreenshot() {
    setScreenshot(null);
    setOcr({ kind: "idle" });
  }

  return (
    <form
      action={formAction}
      // Dispatched by hand so the shrunk screenshot is sent instead of the
      // original, and so React's post-action form reset can't wipe the picked
      // image or the reference when the server returns an error.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        data.delete("screenshot");
        if (screenshot) data.set("screenshot", screenshot.blob, "screenshot.jpg");
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
      noValidate
    >
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Payment screenshot</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Can&apos;t copy the reference? Upload a screenshot of the payment and we&apos;ll read it
          for you.
        </p>
        {screenshot ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
            <span className="truncate">{screenshot.name}</span>
            <button
              type="button"
              onClick={removeScreenshot}
              className="shrink-0 text-ti-blue underline dark:text-sky-400"
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-400 px-3 py-3 text-sm font-medium text-ti-blue hover:bg-zinc-50 dark:border-zinc-600 dark:text-sky-400 dark:hover:bg-zinc-900">
            Upload screenshot
            <input
              type="file"
              name="screenshot"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                void onPick(e.target.files?.[0]);
              }}
            />
          </label>
        )}
        <p aria-live="polite" className="mt-2 text-sm">
          {ocr.kind === "reading" ? (
            <span className="text-zinc-500 dark:text-zinc-400">Reading screenshot…</span>
          ) : ocr.kind === "found" ? (
            <span className="text-emerald-700 dark:text-emerald-300">
              Found <span className="font-mono font-semibold">{ocr.utr}</span> — check it matches
              your app.
            </span>
          ) : ocr.kind === "not_found" ? (
            <span className="text-amber-700 dark:text-amber-300">
              Couldn&apos;t read a 12-digit reference. Type it below if you can — or just submit,
              and we&apos;ll check your screenshot by hand.
            </span>
          ) : null}
          {pickError ? <span className="text-red-600 dark:text-red-400">{pickError}</span> : null}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="utr" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          UPI reference number
        </label>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          The <strong className="font-medium text-zinc-700 dark:text-zinc-300">12-digit</strong>{" "}
          reference from your UPI app. If your app shows a different kind of ID, enter that and
          upload a screenshot — we&apos;ll check it by hand.
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
          autoComplete="off"
          placeholder="412345678901"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "utr-error" : undefined}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-lg tracking-wider text-zinc-900 shadow-sm placeholder:text-zinc-400 outline-none focus:border-ti-blue focus:ring-2 focus:ring-ti-blue/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
      </div>

      {state.error ? (
        <p id="utr-error" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pending={pending} disabled={ocr.kind === "reading"} />
    </form>
  );
}
