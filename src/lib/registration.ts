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

export const utrSchema = z.object({
  utr: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const digits = v.replace(/\D/g, "");
      if (digits.length !== 12) {
        ctx.addIssue({
          code: "custom",
          message: "A UPI reference is exactly 12 digits — check your UPI app's transaction details",
        });
        return z.NEVER;
      }
      return digits;
    }),
});
