import { randomBytes } from "node:crypto";

/**
 * Crockford-style alphabet with I, L, O and U removed. Ticket IDs get read
 * aloud at a noisy registration desk and copied off phone screens, so
 * characters that are confusable with 1/0 are simply not in the set.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TICKET_LENGTH = 6;

export function generateTicketId(length = TICKET_LENGTH): string {
  // Rejection-free: 32 divides 256 evenly, so masking to 5 bits is unbiased.
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] & 31];
  return out;
}

/**
 * Normalise a ticket ID as typed by a human: uppercase, and fold the
 * confusable characters onto what they were meant to be.
 */
export function normaliseTicketId(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V")
    .replace(/[^0-9A-Z]/g, "");
}

export function isValidTicketId(input: string): boolean {
  const t = normaliseTicketId(input);
  return t.length === TICKET_LENGTH && [...t].every((c) => ALPHABET.includes(c));
}
