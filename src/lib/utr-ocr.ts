/**
 * Pick the 12-digit UPI reference out of text read from a payment screenshot.
 *
 * Runs in the browser on whatever OCR produced, so it has to cope with misread
 * characters and with screens showing several long numbers (phone numbers,
 * the app's own transaction ID, account numbers). It only ever proposes a
 * number — the member checks it before submitting.
 */

/** Labels apps put next to the UTR. */
const UTR_LABEL = /(upi\s*(transaction|txn|ref(erence)?)\s*(id|no\.?|number)?|\butr\b|\brrn\b|ref(erence)?\s*(no\.?|number))/i;

/** Labels of IDs that are NOT the UTR, so a number right after one is skipped. */
const NOT_UTR_LABEL = /(google\s*transaction|phonepe|mobile|phone|a\/?c|account)/i;

// A digit, or a character OCR commonly reads in place of one.
const D = "[0-9OoIlSB]";

// 12 digits run together, or grouped 4-4-4 as some apps print them. Anything
// alphanumeric right before or after means it is part of a longer ID.
const CANDIDATE = new RegExp(
  `(?<![A-Za-z0-9])(${D}{12}|${D}{4} ${D}{4} ${D}{4})(?![A-Za-z0-9])`,
  "g",
);

const FIXES: Record<string, string> = { O: "0", o: "0", I: "1", l: "1", S: "5", B: "8" };

function toDigits(raw: string): string | null {
  const fixed = raw.replace(/\s/g, "").replace(/[OoIlSB]/g, (c) => FIXES[c]);
  // Mostly real digits, or it's a word like "SOBBOIlOSSBB" read as a number.
  const realDigits = raw.replace(/\D/g, "").length;
  return realDigits >= 10 && /^\d{12}$/.test(fixed) ? fixed : null;
}

export function findUtrInText(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const labelled: string[] = [];
  const unlabelled: string[] = [];

  lines.forEach((line, i) => {
    for (const match of line.matchAll(CANDIDATE)) {
      const utr = toDigits(match[1]);
      if (!utr) continue;
      // The label is on the same line before the number, or on the line above.
      const prefix = line.slice(0, match.index);
      const near = prefix.trim() ? prefix : (lines[i - 1] ?? "");
      if (NOT_UTR_LABEL.test(near) && !UTR_LABEL.test(near)) continue;
      (UTR_LABEL.test(near) ? labelled : unlabelled).push(utr);
    }
  });

  const unique = (xs: string[]) => [...new Set(xs)];
  const named = unique(labelled);
  if (named.length === 1) return named[0];
  if (named.length > 1) return null; // Two different "UTRs" — let the member pick.
  const rest = unique(unlabelled);
  return rest.length === 1 ? rest[0] : null;
}
