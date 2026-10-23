import data from "@/data/d229-clubs.json";

/**
 * District 229 clubs, as listed on the Toastmasters dashboard
 * (https://dashboards.toastmasters.org/district.aspx?id=229). A snapshot, not
 * a live feed: re-extract it when clubs charter or close. `asOf` says when.
 */
export type Club = {
  /** Toastmasters club number, e.g. "02188218". */
  id: string;
  name: string;
  /** "A".."H". */
  division: string;
  area: string;
};

export const CLUBS: readonly Club[] = data.clubs;
export const CLUBS_AS_OF: string = data.asOf;

/** Lowercase, punctuation to spaces: "Toastmasters @ Verizon" → "toastmasters verizon". */
const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const indexed = CLUBS.map((club) => {
  const name = normalise(club.name);
  return { club, name, words: name.split(" ") };
});

/**
 * Clubs matching what a member has typed, best first.
 *
 * Every typed word must appear in the club name, so "verizon chennai" and
 * "chennai verizon" both find the Verizon club. Names that start with the
 * query rank first, then names where each typed word starts a word, then any
 * other match. A club number (or its start) also finds the club.
 */
export function searchClubs(query: string, limit = 8): Club[] {
  const q = normalise(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const digits = query.replace(/\D/g, "");

  const scored: { club: Club; score: number }[] = [];
  for (const { club, name, words } of indexed) {
    let score: number | null = null;
    if (name.startsWith(q)) score = 0;
    else if (tokens.every((t) => words.some((w) => w.startsWith(t)))) score = 1;
    else if (tokens.every((t) => name.includes(t))) score = 2;
    else if (digits.length >= 3 && digits === query.trim() && club.id.startsWith(digits)) score = 3;
    if (score !== null) scored.push({ club, score });
  }

  return scored
    .sort((a, b) => a.score - b.score || a.club.name.localeCompare(b.club.name))
    .slice(0, limit)
    .map((s) => s.club);
}

/** The listed club with exactly this name, ignoring case and punctuation. */
export function findClub(name: string): Club | undefined {
  const n = normalise(name);
  return n ? indexed.find((c) => c.name === n)?.club : undefined;
}
