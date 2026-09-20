import { describe, it, expect } from "vitest";
import {
  normalisePhone,
  registrationSchema,
  priceRegistration,
  utrSchema,
} from "./registration";
import type { PriceTier } from "./types";

describe("normalisePhone", () => {
  it("accepts a plain ten-digit mobile", () => {
    expect(normalisePhone("9876543210")).toBe("9876543210");
  });

  it("strips the +91 country code and its formatting", () => {
    expect(normalisePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalisePhone("+91-9876543210")).toBe("9876543210");
  });

  it("strips a leading zero", () => {
    expect(normalisePhone("09876543210")).toBe("9876543210");
  });

  it("rejects numbers that cannot be Indian mobiles", () => {
    expect(normalisePhone("1234567890")).toBeNull(); // starts with 1
    expect(normalisePhone("98765")).toBeNull();
    expect(normalisePhone("98765432101")).toBeNull();
    expect(normalisePhone("")).toBeNull();
  });
});

const valid = {
  fullName: "Asha Rao",
  email: "Asha@Example.COM",
  phone: "+91 98765 43210",
  club: "Chennai Speakers",
  area: "E2",
  division: "E",
  mealPreference: "Vegetarian" as const,
  tshirtSize: "M" as const,
};

const allFields = ["club", "area", "division", "mealPreference", "tshirtSize"] as const;

describe("registrationSchema", () => {
  it("accepts a complete submission and normalises it", () => {
    const result = registrationSchema([...allFields]).safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("asha@example.com");
      expect(result.data.phone).toBe("9876543210");
    }
  });

  it("requires the fields the organiser enabled", () => {
    const result = registrationSchema([...allFields]).safeParse({ ...valid, club: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Club is required")).toBe(true);
    }
  });

  it("rejects fields the event does not collect", () => {
    const result = registrationSchema(["club"]).safeParse({ ...valid, tshirtSize: "M" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("not collected for this event")),
      ).toBe(true);
    }
  });

  it("accepts a minimal event that collects no custom fields", () => {
    const result = registrationSchema([]).safeParse({
      fullName: "Asha Rao",
      email: "asha@example.com",
      phone: "9876543210",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(registrationSchema([]).safeParse({ ...valid, email: "not-an-email", club: "", area: "", division: "", mealPreference: "", tshirtSize: "" }).success).toBe(false);
  });

  it("rejects a one-character name", () => {
    expect(
      registrationSchema([]).safeParse({
        fullName: "A",
        email: "asha@example.com",
        phone: "9876543210",
      }).success,
    ).toBe(false);
  });
});

const tiers: PriceTier[] = [
  { id: "early", label: "Early bird", amountPaise: 25000, endsAt: "2026-10-01T23:59:59+05:30" },
  { id: "regular", label: "Regular", amountPaise: 30000, endsAt: null },
];

describe("priceRegistration", () => {
  it("prices at the tier active right now", () => {
    const r = priceRegistration({ tiers, registrationOpen: true }, new Date("2026-09-20T10:00:00+05:30"));
    expect(r).toEqual({
      ok: true,
      priced: { tierId: "early", tierLabel: "Early bird", amountDuePaise: 25000 },
    });
  });

  it("recomputes after a cutoff rather than honouring a stale tab", () => {
    const r = priceRegistration({ tiers, registrationOpen: true }, new Date("2026-10-05T10:00:00+05:30"));
    expect(r.ok && r.priced.amountDuePaise).toBe(30000);
  });

  it("refuses when the organiser has closed registration", () => {
    const r = priceRegistration({ tiers, registrationOpen: false });
    expect(r).toMatchObject({ ok: false });
  });

  it("refuses when every tier has lapsed", () => {
    const dated: PriceTier[] = [tiers[0]];
    const r = priceRegistration({ tiers: dated, registrationOpen: true }, new Date("2026-11-01T00:00:00+05:30"));
    expect(r).toMatchObject({ ok: false });
  });

  it("refuses an event with no tiers configured", () => {
    expect(priceRegistration({ tiers: [], registrationOpen: true })).toMatchObject({ ok: false });
  });
});

describe("utrSchema", () => {
  it("accepts and normalises a pasted reference", () => {
    const r = utrSchema.safeParse({ utr: " 4123 4567 8901 " });
    expect(r.success && r.data.utr).toBe("412345678901");
  });

  it("explains what a UPI reference looks like when the length is wrong", () => {
    const r = utrSchema.safeParse({ utr: "12345" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/exactly 12 digits/);
  });
});
