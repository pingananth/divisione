"use server";

import { isValidScores } from "@/lib/game/engine";
import { normaliseRound, recordPlay } from "@/lib/game/plays";

/**
 * Sends a finished play to the projector tally. The ending is worked out again
 * on the server from the raw choices, so a tampered request cannot pick one.
 */
export async function submitPlay(
  round: string,
  playId: string,
  scores: unknown,
): Promise<{ ok: boolean }> {
  if (!isValidScores(scores)) return { ok: false };
  if (typeof playId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(playId)) return { ok: false };

  try {
    await recordPlay(normaliseRound(round), playId, scores);
    return { ok: true };
  } catch (err) {
    // The game must keep working on the phone even if the tally is down.
    console.error(`[play] could not record play: ${(err as Error).message}`);
    return { ok: false };
  }
}
