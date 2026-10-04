"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase-server";
import { serviceClient } from "@/lib/supabase";
import { parseStatement } from "@/lib/statements";
import {
  runReconciliation,
  AccountNotConfiguredError,
  type RunSummary,
} from "@/lib/reconcile-run";
import { outboxKey } from "@/lib/email/outbox";
import { formatEventDate, parseContacts, parseInfoSections } from "@/lib/events";

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
    .select("id, title, venue, starts_at, support_email, account_last4, contacts, info_sections")
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

  const accountLast4 = auth.event.account_last4 as string | null;
  if (!accountLast4) {
    return {
      error:
        "This conference has no collecting account set yet. Ask the District admin to add " +
        "the last 4 digits of the bank account before uploading statements.",
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

  const uploadedAt = new Date().toISOString();

  // UTRs are unique, so overlapping date ranges and credits already learned
  // from a bank alert are both skipped rather than duplicated.
  const { error: rowsError } = await db.from("bank_credits").upsert(
    parsed.rows.map((r) => ({
      account_last4: accountLast4,
      utr: r.utr,
      amount_paise: r.amountPaise,
      value_date: r.valueDate,
      narration: r.narration,
      source: "csv",
      source_ref: upload.id,
      seen_in_statement_at: uploadedAt,
    })),
    { onConflict: "utr", ignoreDuplicates: true },
  );

  if (rowsError) return { error: `Could not save the statement rows: ${rowsError.message}` };

  // Credits first learned from a bank alert are now confirmed by the
  // statement too. Any alert credit that never gets this stamp is suspect.
  // Batched: the filter travels in the request URL, and a month's statement
  // can hold far more UTRs than a URL comfortably carries.
  const utrs = parsed.rows.map((r) => r.utr);
  for (let i = 0; i < utrs.length; i += 200) {
    const { error: seenError } = await db
      .from("bank_credits")
      .update({ seen_in_statement_at: uploadedAt })
      .in("utr", utrs.slice(i, i + 200))
      .is("seen_in_statement_at", null);
    if (seenError) {
      console.error(`[admin/${slug}] failed to mark credits seen: ${seenError.message}`);
    }
  }

  const skippedNote = parsed.skipped.length
    ? ` ${parsed.skipped.length} credit${parsed.skipped.length === 1 ? "" : "s"} had no UPI reference and ${parsed.skipped.length === 1 ? "was" : "were"} left out.`
    : "";

  // Matching runs straight away — no second click needed.
  let matchNote = "";
  try {
    const summary = await runReconciliation(auth.event.id, {
      runBy: auth.userId,
      trigger: "statement_upload",
    });
    matchNote = ` ${describeRun(summary)}`;
  } catch (err) {
    console.error(`[admin/${slug}] matching after upload failed:`, err);
    matchNote = " Matching could not run — use \"Match payments now\" to retry.";
  }

  revalidatePath(`/admin/${slug}`);

  return {
    message: `Read ${parsed.rows.length} UPI credit${parsed.rows.length === 1 ? "" : "s"} from ${file.name}.${skippedNote}${matchNote}`,
  };
}

function describeRun(summary: RunSummary): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    `Confirmed ${summary.confirmed}. ` +
    `${plural(summary.needsReview, "needs", "need")} review. ` +
    `${plural(summary.waiting, "is", "are")} still waiting for the bank. ` +
    `${plural(summary.unclaimedCredits, "credit", "credits")} unclaimed.`
  );
}

export async function reconcileAction(slug: string): Promise<ActionState> {
  const auth = await authorise(slug);
  if ("error" in auth) return { error: auth.error };

  try {
    const summary = await runReconciliation(auth.event.id, {
      runBy: auth.userId,
      trigger: "manual",
    });
    revalidatePath(`/admin/${slug}`);
    return { message: describeRun(summary) };
  } catch (err) {
    if (err instanceof AccountNotConfiguredError) return { error: err.message };
    console.error(`[admin/${slug}] reconcile failed:`, err);
    return { error: "Matching failed. Check the logs and try again." };
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
        contacts: parseContacts(auth.event.contacts, slug),
        // Guidelines belong with a confirmation, not a rejection.
        infoSections:
          template === "registration_confirmed" ? parseInfoSections(auth.event.info_sections, slug) : undefined,
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
