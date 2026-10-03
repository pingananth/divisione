import { NextResponse, type NextRequest } from "next/server";
import { rejectUnlessCron } from "@/lib/cron-auth";
import { runReconciliationForActiveEvents } from "@/lib/reconcile-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Re-run payment matching for every active conference.
 *
 * Matching already runs when a member submits a UTR and when a statement is
 * uploaded. This catches what those cannot: a claim crossing the 24-hour line
 * from "waiting" to "needs review", and (once bank alerts are connected)
 * credits arriving with nobody on the page.
 */
export async function GET(request: NextRequest) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;

  try {
    const results = await runReconciliationForActiveEvents("schedule");
    return NextResponse.json({
      events: results.length,
      failed: results.filter((r) => !r.ok).length,
      confirmed: results.reduce((n, r) => n + (r.summary?.confirmed ?? 0), 0),
    });
  } catch (err) {
    console.error("[cron/reconcile] failed:", err);
    return NextResponse.json({ error: "Matching run failed" }, { status: 500 });
  }
}
