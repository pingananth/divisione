"use server";

import { redirect } from "next/navigation";
import { getEventBySlug } from "@/lib/events";
import { registrationSchema, priceRegistration, FIELD_INPUTS } from "@/lib/registration";
import { generateTicketId } from "@/lib/ticket";
import { serviceClient } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo";

export type RegisterState = {
  errors?: Record<string, string>;
  formError?: string;
  /**
   * What the member submitted, echoed back on any error. React 19 resets a
   * form after its action runs; without this, one typo in the email wiped
   * every field they had filled in.
   */
  values?: Record<string, string>;
};

export async function registerAction(
  slug: string,
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const event = await getEventBySlug(slug);
  if (!event) return { formError: "This event could not be found." };

  // Only read inputs for fields this event collects, so a tampered form body
  // cannot smuggle in values the organiser disabled.
  const raw: Record<string, string> = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };
  for (const [field, inputs] of Object.entries(FIELD_INPUTS)) {
    const on = event.enabledFields.includes(field as keyof typeof FIELD_INPUTS);
    for (const input of inputs) raw[input] = on ? String(formData.get(input) ?? "") : "";
  }

  // Price on the server from the event's own tiers — never from the form.
  // The form only says which ticket was picked; its price is looked up here.
  // Checked before the other fields so a missing ticket is reported together
  // with every other problem, not on a second submit.
  const ticket = String(formData.get("ticket") ?? "");
  const pricing = priceRegistration(event, new Date(), ticket);
  const values = { ...raw, ticket };
  if (!pricing.ok && !pricing.field) return { formError: pricing.reason, values };

  const parsed = registrationSchema(event.enabledFields).safeParse(raw);
  if (!parsed.success || !pricing.ok) {
    const errors: Record<string, string> = {};
    if (!pricing.ok) errors.ticket = pricing.reason;
    for (const issue of parsed.success ? [] : parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { errors, values };
  }



  const data = parsed.data;

  if (isDemoMode()) {
    const { demoCreateRegistration } = await import("@/lib/demo");
    const ticketId = generateTicketId();
    await demoCreateRegistration({
      ticketId,
      fullName: data.fullName,
      email: data.email,
      tierId: pricing.priced.tierId,
      amountDuePaise: pricing.priced.amountDuePaise,
    });
    redirect(`/e/${slug}/pay/${ticketId}`);
  }

  const db = serviceClient();

  // Ticket IDs are random, so a collision is possible but vanishingly rare;
  // retry rather than failing the member's registration over it.
  let ticketId = "";
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    ticketId = generateTicketId();
    const { error } = await db.from("registrations").insert({
      event_id: event.id,
      ticket_id: ticketId,
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      club: data.club || null,
      area: data.area || null,
      division: data.division || null,
      meal_preference: data.mealPreference || null,
      tshirt_size: data.tshirtSize || null,
      attendee_type: data.attendeeType || null,
      vehicle_type: data.vehicleType || null,
      vehicle_number: data.vehicleNumber,
      gov_id_type: data.govIdType || null,
      gov_id_number: data.govIdNumber,
      tier_id: pricing.priced.tierId,
      amount_due_paise: pricing.priced.amountDuePaise,
    });

    if (!error) {
      redirect(`/e/${slug}/pay/${ticketId}`);
    }

    // 23505 is unique_violation; on ticket_id it is a collision worth retrying.
    if (error.code !== "23505") {
      lastError = error.message;
      break;
    }
    lastError = error.message;
  }

  console.error(`[register] insert failed for ${slug}: ${lastError}`);
  return {
    formError: "Something went wrong saving your registration. Please try again.",
    values,
  };
}
