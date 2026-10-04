import { z } from "zod";
import type { CustomFieldKey, EventConfig } from "./types";
import { availableTickets } from "./pricing";

/**
 * Indian mobile numbers, tolerant of the ways people type them:
 * "+91 98765 43210", "098765 43210", "9876543210" all normalise to 10 digits
 * starting 6-9.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith("0") && digits.length === 11
      ? digits.slice(1)
      : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export const MEAL_PREFERENCES = ["Vegetarian", "Non-vegetarian"] as const;
export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

type Option<V extends string> = { value: V; label: string };

export const ATTENDEE_TYPES = [
  { value: "toastmaster", label: "Toastmaster" },
  { value: "guest", label: "Guest" },
] as const satisfies readonly Option<string>[];

export const VEHICLE_TYPES = [
  { value: "four_wheeler", label: "4-wheeler (own)" },
  { value: "two_wheeler", label: "2-wheeler (own)" },
  { value: "public", label: "Public transport" },
] as const satisfies readonly Option<string>[];

/** Vehicle types that need a number plate recorded for parking. */
export const OWN_VEHICLES: readonly string[] = ["four_wheeler", "two_wheeler"];

export const GOV_ID_TYPES = [
  { value: "aadhaar", label: "Aadhaar", placeholder: "1234 5678 9012" },
  { value: "pan", label: "PAN", placeholder: "ABCDE1234F" },
  { value: "driving_licence", label: "Driving licence", placeholder: "TN09 20201234567" },
  { value: "passport", label: "Passport", placeholder: "A1234567" },
  { value: "voter_id", label: "Voter ID", placeholder: "ABC1234567" },
] as const;

export type GovIdType = (typeof GOV_ID_TYPES)[number]["value"];

const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];

/** Look up the human label for a stored option value, e.g. "public" → "Public transport". */
export function optionLabel(
  opts: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  return opts.find((o) => o.value === value)?.label ?? value ?? "";
}

/** Uppercase and strip spaces, hyphens and dots — how plates and IDs get typed. */
const compact = (v: string) => v.toUpperCase().replace(/[\s\-./]/g, "");

/**
 * Indian number plates: state code, district, optional series, number —
 * "TN 09 AB 1234" — plus the Bharat series, "22 BH 1234 AA".
 */
export function normaliseVehicleNumber(input: string): string | null {
  const v = compact(input);
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(v) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(v)
    ? v
    : null;
}

const GOV_ID_RULES: Record<GovIdType, { pattern: RegExp; message: string }> = {
  aadhaar: { pattern: /^[2-9]\d{11}$/, message: "Enter a valid 12-digit Aadhaar number" },
  pan: { pattern: /^[A-Z]{5}\d{4}[A-Z]$/, message: "A PAN looks like ABCDE1234F" },
  // Formats differ by state and year, so only the state prefix and length are checked.
  driving_licence: {
    pattern: /^[A-Z]{2}[0-9A-Z]{8,18}$/,
    message: "Enter the licence number as printed, starting with the state code",
  },
  passport: { pattern: /^[A-Z]\d{7}$/, message: "A passport number is one letter and 7 digits" },
  voter_id: { pattern: /^[A-Z]{3}\d{7}$/, message: "A Voter ID looks like ABC1234567" },
};

/** Normalised ID number, or null when it does not fit the chosen ID type. */
export function normaliseGovId(type: GovIdType, input: string): string | null {
  const v = compact(input);
  return GOV_ID_RULES[type].pattern.test(v) ? v : null;
}

/**
 * Form input names behind each organiser-facing field. Most fields are one
 * input; vehicle and government ID are a pair.
 */
export const FIELD_INPUTS: Record<CustomFieldKey, string[]> = {
  club: ["club"],
  area: ["area"],
  division: ["division"],
  mealPreference: ["mealPreference"],
  tshirtSize: ["tshirtSize"],
  attendeeType: ["attendeeType"],
  vehicle: ["vehicleType", "vehicleNumber"],
  governmentId: ["govIdType", "govIdNumber"],
};

const baseSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const normalised = normalisePhone(v);
      if (!normalised) {
        ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number" });
        return z.NEVER;
      }
      return normalised;
    }),
  club: z.string().trim().max(120).optional().or(z.literal("")),
  area: z.string().trim().max(40).optional().or(z.literal("")),
  division: z.string().trim().max(40).optional().or(z.literal("")),
  mealPreference: z.enum(MEAL_PREFERENCES).optional().or(z.literal("")),
  tshirtSize: z.enum(TSHIRT_SIZES).optional().or(z.literal("")),
});

export type RegistrationInput = z.infer<typeof baseSchema>;

const FIELD_LABELS: Record<CustomFieldKey, string> = {
  club: "Club",
  area: "Area",
  division: "Division",
  mealPreference: "Food preference",
  tshirtSize: "T-shirt size",
  attendeeType: "Attending as",
  vehicle: "How you are travelling",
  governmentId: "Government ID",
};

/** Values a field may take when the organiser has turned it on. */
const FIELD_VALUES: Record<CustomFieldKey, z.ZodType<string, string>> = {
  club: z.string().trim().max(120),
  area: z.string().trim().max(40),
  division: z.string().trim().max(40),
  mealPreference: z.enum(MEAL_PREFERENCES),
  tshirtSize: z.enum(TSHIRT_SIZES),
  attendeeType: z.enum(values(ATTENDEE_TYPES)),
  vehicle: z.enum(values(VEHICLE_TYPES)),
  governmentId: z.enum(values(GOV_ID_TYPES)),
};

/**
 * Build a validator for one event. Fields the organiser enabled become
 * required; fields they did not enable are rejected outright rather than
 * silently stored, so a stale form cannot write data the event does not
 * collect.
 *
 * Each field carries its own rule, so every problem is reported in one go.
 * (A whole-form refinement only runs once the basic fields pass, which made
 * members fix name/email/phone, resubmit, and only then hear about the rest.)
 */
export function registrationSchema(enabledFields: CustomFieldKey[]) {
  const enabled = new Set(enabledFields);

  const field = (key: CustomFieldKey): z.ZodType<string | undefined, unknown> => {
    const label = FIELD_LABELS[key];
    if (!enabled.has(key)) {
      return z
        .string()
        .optional()
        .refine((v) => v === undefined || v.trim() === "", `${label} is not collected for this event`);
    }
    return z.preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z
        .string({ error: `${label} is required` })
        .min(1, `${label} is required`)
        .pipe(FIELD_VALUES[key]),
    );
  };

  const vehicleOn = enabled.has("vehicle");
  const idOn = enabled.has("governmentId");

  // Paired inputs whose rules depend on each other. `when` lets these run even
  // if other fields failed, so every problem still shows in one submit.
  const clearOf = (...paths: string[]) => (payload: { issues: { path?: PropertyKey[] }[] }) =>
    payload.issues.every((i) => !paths.includes(String(i.path?.[0])));

  let schema = baseSchema
    .extend({
      club: field("club"),
      area: field("area"),
      division: field("division"),
      mealPreference: field("mealPreference"),
      tshirtSize: field("tshirtSize"),
      attendeeType: field("attendeeType"),
      vehicleType: field("vehicle"),
      vehicleNumber: z.string().optional(),
      govIdType: field("governmentId"),
      govIdNumber: idOn
        ? z.preprocess(
            (v) => (typeof v === "string" ? v.trim() : v),
            z.string({ error: "ID number is required" }).min(1, "ID number is required"),
          )
        : z.string().optional(),
    })
    .refine(
      (v) => !vehicleOn || !OWN_VEHICLES.includes(v.vehicleType ?? "") || !!v.vehicleNumber?.trim(),
      { path: ["vehicleNumber"], message: "Vehicle number is required", when: clearOf("vehicleType", "vehicleNumber") },
    )
    .refine(
      (v) =>
        !vehicleOn ||
        !OWN_VEHICLES.includes(v.vehicleType ?? "") ||
        !v.vehicleNumber?.trim() ||
        normaliseVehicleNumber(v.vehicleNumber) !== null,
      {
        path: ["vehicleNumber"],
        message: "Enter the number as on the plate, e.g. TN 09 AB 1234",
        when: clearOf("vehicleType", "vehicleNumber"),
      },
    );

  // One rule per ID type so each gets a message describing its own format.
  for (const { value: type } of GOV_ID_TYPES) {
    schema = schema.refine(
      (v) => !idOn || v.govIdType !== type || normaliseGovId(type, v.govIdNumber ?? "") !== null,
      { path: ["govIdNumber"], message: GOV_ID_RULES[type].message, when: clearOf("govIdType", "govIdNumber") },
    );
  }

  // Store plates and IDs in one canonical form, and never keep a plate for
  // someone coming by public transport.
  return schema.transform((v) => ({
    ...v,
    vehicleNumber:
      vehicleOn && OWN_VEHICLES.includes(v.vehicleType ?? "") && v.vehicleNumber
        ? normaliseVehicleNumber(v.vehicleNumber)
        : null,
    govIdNumber:
      idOn && v.govIdType && v.govIdNumber ? normaliseGovId(v.govIdType as GovIdType, v.govIdNumber) : null,
  }));
}

export type PricedRegistration = {
  tierId: string;
  tierLabel: string;
  amountDuePaise: number;
};

/**
 * Price a registration at submission time.
 *
 * The amount is always recomputed on the server from the event's tiers — never
 * taken from the submitted form — so a stale tab open across an early-bird
 * cutoff cannot lock in yesterday's price.
 */
export function priceRegistration(
  event: Pick<EventConfig, "tiers" | "registrationOpen">,
  at: Date = new Date(),
  /** Tier id of the ticket the member picked; ignored when there is only one. */
  chosenTierId?: string,
): { ok: true; priced: PricedRegistration } | { ok: false; reason: string; field?: "ticket" } {
  if (!event.registrationOpen) {
    return { ok: false, reason: "Registration for this event is closed." };
  }

  const tickets = availableTickets(event.tiers, at);
  if (tickets.length === 0) {
    return { ok: false, reason: "Registration for this event has closed." };
  }

  let tier = tickets[0];
  if (tickets.length > 1) {
    const chosen = tickets.find((t) => t.id === chosenTierId);
    if (!chosen) {
      // Also covers a stale page offering an early-bird price that has since
      // ended: its tier id is no longer on the list.
      return {
        ok: false,
        field: "ticket",
        reason: chosenTierId
          ? "That ticket's price has changed. Please choose your ticket again."
          : "Please choose a ticket",
      };
    }
    tier = chosen;
  }

  return {
    ok: true,
    priced: { tierId: tier.id, tierLabel: tier.label, amountDuePaise: tier.amountPaise },
  };
}

/**
 * Explain why a pasted value is not a UTR, naming the specific app ID people
 * most often copy by mistake. Returns null when the value looks like a UTR.
 *
 * UPI apps show more than one ID per payment and the wrong one is usually more
 * prominent: PhonePe leads with its own "Transaction ID" (T + ~20 digits) and
 * Google Pay shows a "Google transaction ID" (starts CIC...). Neither appears
 * in the bank's records, so they can never be matched.
 */
export function explainBadUtr(input: string): string | null {
  const trimmed = input.trim();
  const compact = trimmed.replace(/\s+/g, "");

  // App-specific IDs first: a real UTR never starts with T or CIC, so these are
  // rejected even in the unlucky case their digits happen to total twelve.
  if (/^T\d{15,}$/i.test(compact)) {
    return "That's PhonePe's Transaction ID. Please enter the 12-digit UTR shown just below it.";
  }
  if (/^CIC/i.test(compact)) {
    return "That's the Google transaction ID. Please enter the 12-digit UPI transaction ID instead.";
  }

  // Accept anything that reduces to exactly 12 digits, so "UTR: 4123 4567 8901"
  // still works.
  if (trimmed.replace(/\D/g, "").length === 12) return null;

  if (/[a-z]/i.test(compact.replace(/^(utr|rrn|upi\s*ref(\s*no)?)[:.\-\s]*/i, ""))) {
    return "A UPI reference has only numbers — 12 digits. Check the payment details in your UPI app.";
  }
  return "A UPI reference is exactly 12 digits — check your UPI app's transaction details.";
}

export const utrSchema = z.object({
  utr: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const problem = explainBadUtr(v);
      if (problem) {
        ctx.addIssue({ code: "custom", message: problem });
        return z.NEVER;
      }
      return v.replace(/\D/g, "");
    }),
});
