"use server";

import { redirect } from "next/navigation";
import { getRegistrationByTicket } from "@/lib/registrations";
import { parsePaymentReference } from "@/lib/registration";
import { serviceClient } from "@/lib/supabase";
import { outboxKey } from "@/lib/email/outbox";
import { formatEventDate } from "@/lib/events";
import { isDemoMode } from "@/lib/demo";
import { runReconciliation } from "@/lib/reconcile-run";
import { MAX_SCREENSHOT_BYTES, SCREENSHOT_BUCKET, SCREENSHOT_TYPES } from "@/lib/screenshots";

export type UtrState = { error?: string };

export async function submitUtrAction(
  slug: string,
  ticketId: string,
  _prev: UtrState,
  formData: FormData,
): Promise<UtrState> {
  const registration = await getRegistrationByTicket(slug, ticketId);
  if (!registration) return { error: "This registration could not be found." };

  if (registration.hasClaim) {
    // Already submitted — send them on rather than showing a confusing error.
    redirect(`/e/${slug}/done/${ticketId}`);
  }

  const reference = parsePaymentReference(String(formData.get("utr") ?? ""));
  if (!reference.ok) return { error: reference.error };
  const { utr, appRef } = reference;

  const file = formData.get("screenshot");
  const screenshot = file instanceof File && file.size > 0 ? file : null;
  if (screenshot) {
    if (!SCREENSHOT_TYPES[screenshot.type]) {
      return { error: "The screenshot must be a JPG, PNG or WebP image." };
    }
    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return { error: "That screenshot is too large. Please crop it or take a new one." };
    }
  }

  if (!utr && !appRef && !screenshot) {
    return { error: "Enter the UPI reference, or upload a screenshot of the payment." };
  }

  if (isDemoMode()) {
    const { demoSubmitUtr } = await import("@/lib/demo");
    const result = await demoSubmitUtr(ticketId, { utr, appRef });
    if (!result.ok) return { error: result.error };
    redirect(`/e/${slug}/done/${ticketId}`);
  }

  const db = serviceClient();

  let screenshotPath: string | null = null;
  if (screenshot) {
    // Timestamped so a retry after a failed insert never collides.
    const path = `${slug}/${ticketId}-${Date.now()}.${SCREENSHOT_TYPES[screenshot.type]}`;
    const { error: uploadError } = await db.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, screenshot, { contentType: screenshot.type, upsert: false });
    if (uploadError) {
      console.error(`[submitUtr] screenshot upload failed for ${ticketId}: ${uploadError.message}`);
      // A typed reference still stands on its own; without one the screenshot
      // is the only proof, so the member has to try again.
      if (!utr && !appRef) {
        return { error: "We couldn't save your screenshot. Please try again." };
      }
    } else {
      screenshotPath = path;
    }
  }

  const { error } = await db.from("payment_claims").insert({
    registration_id: registration.id,
    utr,
    app_ref: appRef,
    screenshot_path: screenshotPath,
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

  let confirmedNow = false;
  if (utr) {
    // Match straight away: if the bank has already reported this payment, the
    // member is confirmed before the page even loads. A failure here must never
    // cost the member their submission — the scheduled run will pick it up.
    try {
      await runReconciliation(registration.event.id, { trigger: "utr_submitted" });
      const { data: after } = await db
        .from("registrations")
        .select("status")
        .eq("id", registration.id)
        .single();
      confirmedNow = after?.status === "confirmed";
    } catch (err) {
      console.error(`[submitUtr] immediate matching failed for ${ticketId}:`, err);
    }
  } else {
    // Without a UTR the rules can never decide, so send it straight to an
    // organiser instead of leaving it looking unpaid.
    const { error: flagError } = await db
      .from("registrations")
      .update({
        match_status: "manual_check",
        match_detail: appRef
          ? `No 12-digit UTR. Their app shows ${appRef}${screenshotPath ? " — see the screenshot" : ""}.`
          : "No UTR given — check the screenshot against the bank.",
        match_checked_at: new Date().toISOString(),
      })
      .eq("id", registration.id)
      .eq("status", "pending");
    if (flagError) {
      console.error(`[submitUtr] failed to flag ${ticketId} for review: ${flagError.message}`);
    }
  }

  // Already confirmed means the confirmation email is queued; a "we're
  // checking your payment" email on top of it would only confuse.
  if (confirmedNow) redirect(`/e/${slug}/done/${ticketId}`);

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
      utr: utr ?? appRef ?? undefined,
      supportEmail: registration.event.supportEmail,
      contacts: registration.event.contacts,
    },
  });

  // A duplicate key here just means the acknowledgement is already queued.
  if (outboxError && outboxError.code !== "23505") {
    console.error(`[submitUtr] outbox enqueue failed for ${ticketId}: ${outboxError.message}`);
  }

  redirect(`/e/${slug}/done/${ticketId}`);
}
