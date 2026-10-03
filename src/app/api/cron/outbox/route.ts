import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { createEmailProvider } from "@/lib/email";
import { supabaseOutboxStore } from "@/lib/email/supabase-store";
import { processOutbox } from "@/lib/email/outbox";
import { rejectUnlessCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Drain the email outbox. Invoked on a schedule (Netlify scheduled function) and also by the
 * admin "send now" button, so a confirmation never waits on the next tick.
 */
export async function GET(request: NextRequest) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;

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
