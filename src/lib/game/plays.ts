import { serviceClient } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo";
import { DECISION_COUNT, gained, pickEnding, totalScore } from "./engine";
import { ENDING_ORDER, type EndingId, type Score } from "./scenario";

export const DEFAULT_ROUND = "live";

/** Round tags come from the URL, so keep them to a safe, short slug. */
export function normaliseRound(raw: string | null | undefined): string {
  const r = (raw ?? "").trim().toLowerCase();
  return /^[a-z0-9-]{1,32}$/.test(r) ? r : DEFAULT_ROUND;
}

type PlayRow = { play_id: string; scores: Score[]; ending: EndingId };

/** Demo store. Survives hot reloads via globalThis, like lib/demo.ts. */
const demoPlays: Map<string, PlayRow[]> =
  (globalThis as { __d229GamePlays?: Map<string, PlayRow[]> }).__d229GamePlays ??
  ((globalThis as { __d229GamePlays?: Map<string, PlayRow[]> }).__d229GamePlays = new Map());

/** Records a finished play. Idempotent per (round, playId). */
export async function recordPlay(round: string, playId: string, scores: Score[]): Promise<void> {
  const ending = pickEnding(totalScore(scores)).id;

  if (isDemoMode()) {
    const rows = demoPlays.get(round) ?? [];
    if (!rows.some((r) => r.play_id === playId)) rows.push({ play_id: playId, scores, ending });
    demoPlays.set(round, rows);
    return;
  }

  const { error } = await serviceClient()
    .from("game_plays")
    .upsert(
      {
        round,
        play_id: playId,
        d1: scores[0],
        d2: scores[1],
        d3: scores[2],
        d4: scores[3],
        ending,
      },
      { onConflict: "round,play_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

export type Tally = {
  total: number;
  endings: Record<EndingId, number>;
  /** Per decision, how many players went outside (scored 2 or 3). */
  outside: number[];
};

export async function tallyRound(round: string): Promise<Tally> {
  let rows: { scores: Score[]; ending: EndingId }[];

  if (isDemoMode()) {
    rows = demoPlays.get(round) ?? [];
  } else {
    const { data, error } = await serviceClient()
      .from("game_plays")
      .select("d1, d2, d3, d4, ending")
      .eq("round", round)
      .limit(5000);
    if (error) throw new Error(error.message);
    rows = (data ?? []).map((r) => ({
      scores: [r.d1, r.d2, r.d3, r.d4] as Score[],
      ending: r.ending as EndingId,
    }));
  }

  const endings = Object.fromEntries(ENDING_ORDER.map((id) => [id, 0])) as Record<EndingId, number>;
  const outside = Array<number>(DECISION_COUNT).fill(0);
  for (const row of rows) {
    endings[row.ending] += 1;
    row.scores.forEach((s, i) => {
      if (gained(s)) outside[i] += 1;
    });
  }
  return { total: rows.length, endings, outside };
}
