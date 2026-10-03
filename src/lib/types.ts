/** Shared domain types. Money is always integer paise — never floats. */

export type PriceTier = {
  id: string;
  label: string;
  /** Integer paise. ₹300 => 30000. */
  amountPaise: number;
  /**
   * Instant this tier stops applying, as an ISO-8601 string with offset
   * (e.g. "2026-10-01T23:59:59+05:30"). `null` means "no cutoff" — the
   * fallback tier that applies once every dated tier has lapsed.
   */
  endsAt: string | null;
};

export type CustomFieldKey =
  | "club"
  | "area"
  | "division"
  | "mealPreference"
  | "tshirtSize";

export type EventConfig = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  /** UPI VPA that collects for this event, e.g. "someone@okhdfcbank". */
  upiVpa: string;
  /** Payee name shown in the attendee's UPI app. */
  upiPayeeName: string;
  /** Short code used in the UPI transaction note, e.g. "E" for Division E. */
  refPrefix: string;
  tiers: PriceTier[];
  enabledFields: CustomFieldKey[];
  registrationOpen: boolean;
};

export type RegistrationStatus = "pending" | "confirmed" | "rejected";

export type Registration = {
  id: string;
  eventId: string;
  ticketId: string;
  fullName: string;
  email: string;
  phone: string;
  club: string | null;
  area: string | null;
  division: string | null;
  mealPreference: string | null;
  tshirtSize: string | null;
  tierId: string;
  amountDuePaise: number;
  status: RegistrationStatus;
  createdAt: string;
};

/** A credit row parsed out of a bank statement. */
export type StatementRow = {
  /** 12-digit UPI reference (UTR/RRN), normalised to digits only. */
  utr: string;
  /** Integer paise credited. */
  amountPaise: number;
  /** Value date, ISO-8601. */
  valueDate: string;
  /** Raw narration, kept verbatim for the audit trail. */
  narration: string;
};

/**
 * A credit as the matching rules see it — a statement row plus what we know
 * about where and when it landed. The extra fields are optional because a
 * CSV statement gives a date but no time, while a bank alert gives both.
 */
export type Credit = StatementRow & {
  /** Last 4 digits of the receiving account, when known. */
  accountLast4?: string | null;
  /** Exact instant the bank credited it (ISO-8601), when the source gives one. */
  creditedAt?: string | null;
  source?: "csv" | "email";
};

export type PaymentClaim = {
  registrationId: string;
  /** 12-digit UTR/RRN as submitted by the attendee, already normalised. */
  utr: string;
  /** What this registration owes, integer paise. */
  expectedAmountPaise: number;
  /** Last 4 digits of the account this event collects into. */
  accountLast4?: string | null;
  /** When the registration was created (ISO-8601). Older payments are suspect. */
  registeredAt?: string;
  /** When the member submitted this UTR (ISO-8601). Drives the wait window. */
  claimedAt?: string;
};
