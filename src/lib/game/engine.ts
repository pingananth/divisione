import {
  DECISION_1,
  DECISION_2,
  DECISION_3A,
  DECISION_3B,
  DECISION_4,
  ENDINGS,
  RECAP,
  type Decision,
  type Ending,
  type EndingId,
  type Score,
} from "./scenario";

export const DECISION_COUNT = 4;

/** Decision 3 is the only branch: 3A if they went to the contest at all, else 3B. */
export function pickDecision3(d1Score: Score): Decision {
  return d1Score >= 1 ? DECISION_3A : DECISION_3B;
}

/** The decision shown at `step` (0–3), given the scores chosen so far. */
export function decisionAt(step: number, scores: Score[]): Decision {
  switch (step) {
    case 0:
      return DECISION_1;
    case 1:
      return DECISION_2;
    case 2:
      return pickDecision3(scores[0] ?? 0);
    case 3:
      return DECISION_4;
    default:
      throw new Error(`No decision at step ${step}`);
  }
}

export function totalScore(scores: Score[]): number {
  return scores.reduce<number>((sum, s) => sum + s, 0);
}

export function pickEnding(total: number): Ending {
  const id: EndingId =
    total <= 3 ? "comfort" : total <= 6 ? "curious" : total <= 9 ? "connector" : "leader";
  return ENDINGS[id];
}

/** "Went outside" on a decision means scoring 2 or 3: a Gained card. */
export function gained(score: Score): boolean {
  return score >= 2;
}

export function recapCards(scores: Score[]) {
  return RECAP.map((card, i) => {
    const won = gained(scores[i] ?? 0);
    return { title: card.title, gained: won, text: won ? card.gained : card.missed };
  });
}

/** Server-side guard: exactly four integer scores, each 0–3. */
export function isValidScores(value: unknown): value is Score[] {
  return (
    Array.isArray(value) &&
    value.length === DECISION_COUNT &&
    value.every((s) => Number.isInteger(s) && s >= 0 && s <= 3)
  );
}

/**
 * Deterministic shuffle, so a refresh mid-game shows the same order while each
 * screen (and each player) still gets a different one. Mulberry32 + Fisher–Yates.
 */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Turns a play ID and step into a shuffle seed. */
export function seedFor(playId: string, step: number): number {
  let h = 2166136261;
  for (const ch of `${playId}:${step}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
