import { describe, it, expect } from "vitest";
import { CLUBS, searchClubs, findClub } from "./clubs";
import { DIVISIONS } from "./registration";

const names = (q: string, limit?: number) => searchClubs(q, limit).map((c) => c.name);

describe("D229 club list", () => {
  it("has every club from the dashboard, each once", () => {
    expect(CLUBS).toHaveLength(160);
    expect(new Set(CLUBS.map((c) => c.id)).size).toBe(160);
  });

  it("only uses divisions offered on the form", () => {
    for (const c of CLUBS) expect(DIVISIONS as readonly string[]).toContain(c.division);
  });

  it("keeps names clean of the dashboard's charter-date notes", () => {
    for (const c of CLUBS) expect(c.name).not.toMatch(/charter \d/i);
  });
});

describe("searchClubs", () => {
  it("finds a club by any word in its name, ignoring punctuation", () => {
    expect(names("verizon")).toEqual(["Toastmasters @ Verizon Chennai - Olympia"]);
    expect(names("l&t")).toContain("L&T ECC Toastmasters Club");
  });

  it("needs every typed word, in any order", () => {
    expect(names("chennai verizon")).toEqual(["Toastmasters @ Verizon Chennai - Olympia"]);
    expect(names("verizon pune")).toEqual([]);
  });

  it("ranks names that start with the query first", () => {
    expect(names("chennai", 3)[0]).toMatch(/^Chennai/);
  });

  it("ranks a word match above a match inside a word", () => {
    const results = names("speak", 50);
    expect(results.slice(0, 2)).toEqual(["Speak Magic Toastmasters Club", "Speak To Lead Toastmasters Club"]);
    expect(results.indexOf("Chennai Speakers Forum")).toBeLessThan(results.indexOf("iSpeakers"));
  });

  it("finds a club by its number", () => {
    expect(names("02188218")).toEqual(["L&T ECC Toastmasters Club"]);
  });

  it("returns nothing for a blank query and respects the limit", () => {
    expect(searchClubs("   ")).toEqual([]);
    expect(searchClubs("toastmasters", 5)).toHaveLength(5);
  });
});

describe("findClub", () => {
  it("matches a listed name exactly, ignoring case and punctuation", () => {
    expect(findClub("madras toastmasters club")?.division).toBe("C");
    expect(findClub("Madras Toastmasters")).toBeUndefined();
  });
});
