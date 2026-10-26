import { describe, it, expect } from "vitest";
import {
  decisionAt,
  isValidScores,
  pickDecision3,
  pickEnding,
  recapCards,
  seedFor,
  shuffle,
  totalScore,
} from "./engine";
import { DECISION_1, FINAL, GAME_TITLE, OPENING } from "./scenario";

describe("pickDecision3", () => {
  it("shows 3B only when the player skipped the contest", () => {
    expect(pickDecision3(0).id).toBe("d3b");
  });

  it("shows 3A when the player went in any form", () => {
    expect(pickDecision3(1).id).toBe("d3a");
    expect(pickDecision3(2).id).toBe("d3a");
    expect(pickDecision3(3).id).toBe("d3a");
  });
});

describe("decisionAt", () => {
  it("walks the four decisions in order, branching at step 2", () => {
    expect(decisionAt(0, []).id).toBe("d1");
    expect(decisionAt(1, [3]).id).toBe("d2");
    expect(decisionAt(2, [0, 3]).id).toBe("d3b");
    expect(decisionAt(2, [2, 0]).id).toBe("d3a");
    expect(decisionAt(3, [2, 0, 1]).id).toBe("d4");
  });

  it("throws past the last decision", () => {
    expect(() => decisionAt(4, [])).toThrow();
  });
});

describe("pickEnding", () => {
  it.each([
    [0, "comfort"],
    [3, "comfort"],
    [4, "curious"],
    [6, "curious"],
    [7, "connector"],
    [9, "connector"],
    [10, "leader"],
    [12, "leader"],
  ])("total %i → %s", (total, id) => {
    expect(pickEnding(total).id).toBe(id);
  });
});

describe("recapCards", () => {
  it("gives Gained for 2 or 3 and Missed for 0 or 1", () => {
    const cards = recapCards([0, 1, 2, 3]);
    expect(cards.map((c) => c.gained)).toEqual([false, false, true, true]);
    expect(cards[0].text).toMatch(/You'd have met her/);
    expect(cards[3].text).toMatch(/Fresh ears/);
  });
});

describe("totalScore", () => {
  it("adds the four choices", () => {
    expect(totalScore([3, 2, 1, 0])).toBe(6);
  });
});

describe("isValidScores", () => {
  it("accepts four integers in 0–3", () => {
    expect(isValidScores([0, 1, 2, 3])).toBe(true);
  });

  it.each([[[]], [[1, 2, 3]], [[0, 1, 2, 4]], [[0, 1, 2, -1]], [[0, 1, 2, 1.5]], ["0123"], [null]])(
    "rejects %j",
    (value) => {
      expect(isValidScores(value)).toBe(false);
    },
  );
});

describe("shuffle", () => {
  it("keeps every option exactly once", () => {
    const out = shuffle(DECISION_1.options, 12345);
    expect(out).toHaveLength(4);
    expect(out.map((o) => o.score).sort()).toEqual([0, 1, 2, 3]);
  });

  it("is stable for the same seed", () => {
    expect(shuffle([1, 2, 3, 4], 99)).toEqual(shuffle([1, 2, 3, 4], 99));
  });

  it("does not always put the boldest choice first", () => {
    const firsts = new Set(
      Array.from({ length: 50 }, (_, i) => shuffle(DECISION_1.options, seedFor("p", i))[0].score),
    );
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe("theme stays hidden", () => {
  it("never names 'Beyond the Club' before the final screen", () => {
    expect(GAME_TITLE).not.toMatch(/beyond/i);
    expect(OPENING.text).not.toMatch(/beyond the club/i);
    expect(FINAL.title).toBe("Beyond the Club");
  });
});
