import { NextResponse } from "next/server";
import { normaliseRound, tallyRound } from "@/lib/game/plays";

export const dynamic = "force-dynamic";

/** Live counts for the projector. Anonymous aggregates only. */
export async function GET(request: Request) {
  const round = normaliseRound(new URL(request.url).searchParams.get("r"));
  try {
    return NextResponse.json(await tallyRound(round), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(`[play] tally failed: ${(err as Error).message}`);
    return NextResponse.json({ error: "tally unavailable" }, { status: 503 });
  }
}
