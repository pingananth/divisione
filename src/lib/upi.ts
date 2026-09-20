import { paiseToUpiAmount } from "./pricing";

/**
 * VPA shape per NPCI: <identifier>@<handle>. Deliberately permissive on the
 * identifier (banks allow dots, hyphens and underscores) but strict about
 * having exactly one "@" and a plausible handle.
 */
const VPA_RE = /^[a-zA-Z0-9.\-_]{2,60}@[a-zA-Z][a-zA-Z0-9.\-_]{1,30}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_RE.test(vpa.trim());
}

/**
 * UPI transaction notes are truncated hard by some PSP apps and reject
 * punctuation in others, so we keep references short and alphanumeric.
 */
export function buildReference(refPrefix: string, ticketId: string): string {
  const clean = `D229${refPrefix}${ticketId}`.replace(/[^a-zA-Z0-9]/g, "");
  return clean.slice(0, 30).toUpperCase();
}

export type UpiIntentParams = {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  reference: string;
};

/**
 * Build a UPI deep link. On Android/iOS this opens the attendee's UPI app with
 * payee and amount pre-filled; on desktop we render it as a QR instead.
 *
 * Note that the amount in a UPI intent is a *request*, not a guarantee — the
 * payer's app can let them edit it, and some PSPs ignore `tn` entirely. That is
 * exactly why reconciliation matches on the UTR from the bank statement rather
 * than trusting anything encoded here.
 */
export function buildUpiIntentUrl({
  vpa,
  payeeName,
  amountPaise,
  reference,
}: UpiIntentParams): string {
  if (!isValidVpa(vpa)) {
    throw new Error(`Invalid UPI VPA: ${vpa}`);
  }
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error(`Amount must be a positive integer number of paise, got ${amountPaise}`);
  }

  const params = new URLSearchParams({
    pa: vpa.trim(),
    pn: payeeName.trim(),
    am: paiseToUpiAmount(amountPaise),
    cu: "INR",
    tn: reference,
  });

  // URLSearchParams encodes spaces as "+", which several UPI apps render
  // literally in the payee name. Percent-encoding is understood universally.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/**
 * Normalise a UTR/RRN as typed by an attendee. They copy these out of their UPI
 * app, so expect stray spaces, hyphens, and a "UTR:" prefix. Returns null when
 * what is left is not a 12-digit reference.
 */
export function normaliseUtr(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 12 ? digits : null;
}

export function isValidUtr(input: string): boolean {
  return normaliseUtr(input) !== null;
}
