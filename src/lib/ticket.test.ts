import { describe, it, expect } from "vitest";
import { generateTicketId, normaliseTicketId, isValidTicketId } from "./ticket";

describe("generateTicketId", () => {
  it("produces a six-character id by default", () => {
    expect(generateTicketId()).toHaveLength(6);
  });

  it("never emits characters confusable at a registration desk", () => {
    const joined = Array.from({ length: 500 }, () => generateTicketId()).join("");
    expect(joined).not.toMatch(/[ILOU]/);
  });

  it("only emits characters from its own alphabet", () => {
    const joined = Array.from({ length: 200 }, () => generateTicketId()).join("");
    expect(joined).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
  });

  it("does not collide across a realistic conference volume", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => generateTicketId()));
    expect(ids.size).toBe(5000);
  });

  it("honours a requested length", () => {
    expect(generateTicketId(10)).toHaveLength(10);
  });
});

describe("normaliseTicketId", () => {
  it("uppercases and trims", () => {
    expect(normaliseTicketId("  ab3k9z  ")).toBe("AB3K9Z");
  });

  it("folds the characters people mistype", () => {
    expect(normaliseTicketId("IL0U")).toBe("110V");
    expect(normaliseTicketId("O")).toBe("0");
  });

  it("strips separators people add", () => {
    expect(normaliseTicketId("AB3-K9Z")).toBe("AB3K9Z");
    expect(normaliseTicketId("AB3 K9Z")).toBe("AB3K9Z");
  });
});

describe("isValidTicketId", () => {
  it("accepts a generated id", () => {
    expect(isValidTicketId(generateTicketId())).toBe(true);
  });

  it("accepts an id typed with confusable characters", () => {
    expect(isValidTicketId("ab3k9z")).toBe(true);
  });

  it("rejects wrong lengths", () => {
    expect(isValidTicketId("AB3K9")).toBe(false);
    expect(isValidTicketId("AB3K9ZZ")).toBe(false);
    expect(isValidTicketId("")).toBe(false);
  });
});
