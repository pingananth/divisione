"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase-server";
import { serviceClient } from "@/lib/supabase";
import { parseStatement } from "@/lib/statements";
import { runReconciliation } from "@/lib/reconcile-run";
import { outboxKey } from "@/lib/email/outbox";
import { formatEventDate } from "@/lib/events";

export type ActionState = { error?: string; message?: string };

/**
 * Resolve the event for a slug and prove this organiser runs it.
 *
 * Every action starts here. The RLS-scoped client is what does the proving:
 * if the organiser is not in event_organisers for this event, the select
 * simply returns nothing.
 */
async function authorise(slug: string) {
  const { db, user } = await requireUser();
  if (!user) return { error: "You are not signed in." } as const;

  const { data, error } = await db
    .from("events")
    .select("id, title, venue, starts_at, support_email")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { error: `Could not load this conference: ${error.message}` } as const;
  if (!data) return { error: "You do not have access to this conference." } as const;

  return { event: data, userId: user.id } as const;
}

export async function uploadStatementAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorise(slug);
  if ("error" in auth) return { error: auth.error };

  const file = formData.get("statement");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV statement to upload." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "That file is larger than 10 MB. Export a narrower date range." };
  }

  let parsed;
  try {
    parsed = parseStatement(await file.text());
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not read that file." };
  }

  if (parsed.rows.length === 0) {
    return {
      error:
        "No UPI credits were found in that file. Check you exported the right account and date range.",
    };
  }

  const db = serviceClient();

  const { data: upload, error: uploadError } = await db
    .from("statement_uploads")
    .insert({
      event_id: auth.event.id,
      filename: file.name,
      uploaded_by: auth.userId,
      row_count: parsed.rows.length,
      skipped_count: parsed.skipped.length,
    })
    .select("id")
    .single();

  if (uploadError) return { error: `Could not record the upload: ${uploadError.message}` };

  // Re-uploading an overlapping date range is normal and must not duplicate
  // credits, so conflicting rows are ignored rather than rejected.
  const { error: rowsError } = await db.from("statement_rows").upsert(
    parsed.rows.map((r) => ({
      upload_id: upload.id,
      event_id: auth.event.id,
      utr: r.utr,
      amount_paise: r.amountPaise,
      value_date: r.valueDate,
      narration: r.narration,
    })),
    { onConflict: "event_id,utr,amount_paise", ignoreDuplicates: true },
  );

  if (rowsError) return { error: `Could not save the statement rows: ${rowsError.message}` };

  revalidatePath(`/admin/${slug}`);

  const skippedNote = parsed.skipped.length
    ? ` ${parsed.skipped.length} credit${parsed.skipped.length === 1 ? "" : "s"} had no UPI reference and ${parsed.skipped.length === 1 ? "was" : "were"} left out.`
    : "";

  return {
    message: `Read ${parsed.rows.length} UPI credit${parsed.rows.length === 1 ? "" : "s"} from ${file.name}.${skippedNote}`,
  };
}

export async function reconcileAction(slug: string): Promise<ActionState> {
  const auth = await authorise(slug);
  if ("error" in auth) return { error: auth.error };

  try {
    const { summary } = await runReconciliation(auth.event.id, auth.userId);
    revalidatePath(`/admin/${slug}`);
    return {
      message:
        `Confirmed ${summary.confirmed}. ` +
        `${summary.needsReview} need${summary.needsReview === 1 ? "s" : ""} review. ` +
        `${summary.unclaimedCredits} credit${summary.unclaimedCredits === 1 ? "" : "s"} unclaimed.`,
    };
  } catch (err) {
    console.error(`[admin/${slug}] reconcile failed:`, err);
    return { error: "Reconciliation failed. Check the logs and try again." };
  }
}

/**
 * Confirm or reject a registration by hand, for the exception tail that
 * reconciliation deliberately refuses to decide on its own.
 */
export async function reviewRegistrationAction(
  slug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await authorise(slug);
  if ("error" in auth) return { error: auth.error };

  const registrationId = String(formData.get("registrationId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (decision !== "confirmed" && decision !== "rejected") {
    return { error: "Choose confirm or reject." };
  }

  const db = serviceClient();

  const { data: reg, error: regError } = await db
    .from("registrations")
    .select("id, ticket_id, full_name, email, amount_due_paise, event_id")
    .eq("id", registrationId)
    .eq("event_id", auth.event.id)
    .maybeSingle();

  if (regError) return { error: `Could not load that registration: ${regError.message}` };
  if (!reg) return { error: "That registration is not part of this conference." };

  const { error } = await db
    .from("registrations")
    .update({
      status: decision,
      review_note: note || null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reg.id);

  if (error) return { error: `Could not update that registration: ${error.message}` };

  const template = decision === "confirmed" ? "registration_confirmed" : "payment_needs_attention";

  const { error: outboxError } = await db.from("email_outbox").upsert(
    {
      registration_id: reg.id,
      idempotency_key: outboxKey(reg.id, template),
      recipient: reg.email,
      template,
      data: {
        fullName: reg.full_name,
        eventTitle: auth.event.title,
        eventVenue: auth.event.venue,
        eventStartsAt: formatEventDate(auth.event.starts_at),
        ticketId: reg.ticket_id,
        amountPaise: reg.amount_due_paise,
        reason: note || undefined,
        supportEmail: auth.event.support_email,
      },
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );

  if (outboxError) {
    console.error(`[admin/${slug}] failed to queue review email: ${outboxError.message}`);
  }

  revalidatePath(`/admin/${slug}`);
  return { message: `${reg.ticket_id} marked ${decision}.` };
}
