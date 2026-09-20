import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase";
import { createEmailProvider } from "@/lib/email";
import { supabaseOutboxStore } from "@/lib/email/supabase-store";
import { processOutbox } from "@/lib/email/outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Constant-time comparison, so the secret cannot be recovered by timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Drain the email outbox. Invoked on a schedule (Vercel Cron) and also by the
 * admin "send now" button, so a confirmation never waits on the next tick.
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const provider = createEmailProvider();
    const store = supabaseOutboxStore(serviceClient(), provider.name);
    const summary = await processOutbox(store, provider, { limit: 100 });
    return NextResponse.json({ provider: provider.name, ...summary });
  } catch (err) {
    console.error("[cron/outbox] failed:", err);
    return NextResponse.json({ error: "Outbox run failed" }, { status: 500 });
  }
}
