import { z } from "zod";
import type { CustomFieldKey, EventConfig } from "./types";
import { selectTier } from "./pricing";

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

export const MEAL_PREFERENCES = ["Vegetarian", "Non-vegetarian", "Jain", "Vegan"] as const;
export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

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

/**
 * Build a validator for one event. Fields the organiser enabled become
 * required; fields they did not enable are rejected outright rather than
 * silently stored, so a stale form cannot write data the event does not
 * collect.
 */
export function registrationSchema(enabledFields: CustomFieldKey[]) {
  const enabled = new Set(enabledFields);

  return baseSchema.superRefine((value, ctx) => {
    const check = (key: CustomFieldKey, label: string) => {
      const present = typeof value[key] === "string" && value[key] !== "";
      if (enabled.has(key) && !present) {
        ctx.addIssue({ code: "custom", path: [key], message: `${label} is required` });
      }
      if (!enabled.has(key) && present) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${label} is not collected for this event`,
        });
      }
    };

    check("club", "Club");
    check("area", "Area");
    check("division", "Division");
    check("mealPreference", "Meal preference");
    check("tshirtSize", "T-shirt size");
  });
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
): { ok: true; priced: PricedRegistration } | { ok: false; reason: string } {
  if (!event.registrationOpen) {
    return { ok: false, reason: "Registration for this event is closed." };
  }

  const tier = selectTier(event.tiers, at);
  if (!tier) {
    return { ok: false, reason: "Registration for this event has closed." };
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
