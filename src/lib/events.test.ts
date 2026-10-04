import { describe, it, expect, vi } from "vitest";
import { parseInfoSections, formatPhone, formatEventDay, formatEventTime } from "./events";

describe("parseInfoSections", () => {
  const good = [
    {
      heading: "Do's",
      tone: "do",
      items: [{ title: "Credentials & ID", text: "Carry a Government ID." }],
    },
  ];

  it("accepts well-formed sections", () => {
    expect(parseInfoSections(good)).toEqual(good);
  });

  it("treats missing sections as none", () => {
    expect(parseInfoSections(null)).toEqual([]);
    expect(parseInfoSections(undefined)).toEqual([]);
  });

  it("drops malformed sections instead of crashing the page", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseInfoSections([{ title: "no heading or items" }], "x")).toEqual([]);
    expect(parseInfoSections("not even an array", "x")).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("falls back to neutral styling for an unknown tone", () => {
    const [s] = parseInfoSections([{ heading: "Parking", tone: "loud", items: [{ text: "Use gate 2." }] }]);
    expect(s.tone).toBe("info");
  });

  it("allows items without a title", () => {
    const [s] = parseInfoSections([{ heading: "Note", tone: "info", items: [{ text: "Arrive early." }] }]);
    expect(s.items[0].title).toBeUndefined();
  });
});

describe("formatting", () => {
  it("writes an Indian mobile the way people read it", () => {
    expect(formatPhone("7010737617")).toBe("70107 37617");
  });

  it("leaves anything that is not 10 digits untouched", () => {
    expect(formatPhone("12345")).toBe("12345");
  });

  it("shows the event day and start time in IST", () => {
    expect(formatEventDay("2026-10-31T09:00:00+05:30")).toBe("Saturday, 31 October 2026");
    expect(formatEventTime("2026-10-31T09:00:00+05:30")).toBe("9:00 AM");
  });

  it("uses IST even for a UTC timestamp near midnight", () => {
    // 20:00 UTC on the 30th is 01:30 IST on the 31st.
    expect(formatEventDay("2026-10-30T20:00:00Z")).toBe("Saturday, 31 October 2026");
  });
});
