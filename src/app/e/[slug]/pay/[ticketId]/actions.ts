"use server";

import { redirect } from "next/navigation";
import { getRegistrationByTicket } from "@/lib/registrations";
import { utrSchema } from "@/lib/registration";
import { serviceClient } from "@/lib/supabase";
import { outboxKey } from "@/lib/email/outbox";
import { formatEventDate } from "@/lib/events";
import { isDemoMode } from "@/lib/demo";

export type UtrState = { error?: string };

export async function submitUtrAction(
  slug: string,
  ticketId: string,
  _prev: UtrState,
  formData: FormData,
): Promise<UtrState> {
  const registration = await getRegistrationByTicket(slug, ticketId);
  if (!registration) return { error: "This registration could not be found." };

  if (registration.claimedUtr) {
    // Already submitted — send them on rather than showing a confusing error.
    redirect(`/e/${slug}/done/${ticketId}`);
  }

  const parsed = utrSchema.safeParse({ utr: String(formData.get("utr") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (isDemoMode()) {
    const { demoSubmitUtr } = await import("@/lib/demo");
    const result = await demoSubmitUtr(ticketId, parsed.data.utr);
    if (!result.ok) return { error: result.error };
    redirect(`/e/${slug}/done/${ticketId}`);
  }

  const db = serviceClient();

  const { error } = await db.from("payment_claims").insert({
    registration_id: registration.id,
    utr: parsed.data.utr,
  });

  if (error) {
    // 23505 on the UTR index means this reference already backs another
    // registration. That is either a typo or someone reusing a payment, and
    // both deserve the same clear message rather than a silent acceptance.
    if (error.code === "23505") {
      return {
        error:
          "That UPI reference has already been used for another registration. " +
          "Please check the reference in your UPI app, or contact us if you think this is wrong.",
      };
    }
    console.error(`[submitUtr] insert failed for ${ticketId}: ${error.message}`);
    return { error: "Something went wrong saving your reference. Please try again." };
  }

  // Queue the acknowledgement. Enqueuing rather than sending inline means a
  // provider outage cannot cost the member their submission.
  const { error: outboxError } = await db.from("email_outbox").insert({
    registration_id: registration.id,
    idempotency_key: outboxKey(registration.id, "registration_received"),
    recipient: registration.email,
    template: "registration_received",
    data: {
      fullName: registration.fullName,
      eventTitle: registration.event.title,
      eventVenue: registration.event.venue,
      eventStartsAt: formatEventDate(registration.event.startsAt),
      ticketId: registration.ticketId,
      amountPaise: registration.amountDuePaise,
      utr: parsed.data.utr,
      supportEmail: registration.event.supportEmail,
    },
  });

  // A duplicate key here just means the acknowledgement is already queued.
  if (outboxError && outboxError.code !== "23505") {
    console.error(`[submitUtr] outbox enqueue failed for ${ticketId}: ${outboxError.message}`);
  }

  redirect(`/e/${slug}/done/${ticketId}`);
}
