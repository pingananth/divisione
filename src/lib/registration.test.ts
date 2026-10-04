import { describe, it, expect } from "vitest";
import {
  normalisePhone,
  registrationSchema,
  priceRegistration,
  utrSchema,
  explainBadUtr,
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

describe("explainBadUtr", () => {
  const msg = (v: string) => {
    const r = utrSchema.safeParse({ utr: v });
    return r.success ? null : r.error.issues[0].message;
  };

  it("accepts a plain 12-digit UTR", () => {
    expect(explainBadUtr("412345678901")).toBeNull();
  });

  it("accepts a UTR pasted with a label and spaces", () => {
    expect(explainBadUtr("UTR: 4123 4567 8901")).toBeNull();
    expect(explainBadUtr("UPI Ref No 412345678901")).toBeNull();
  });

  it("names PhonePe's Transaction ID when that is pasted", () => {
    expect(msg("T2510031234567890123456")).toMatch(/PhonePe's Transaction ID/);
  });

  it("names PhonePe's ID case-insensitively and with spaces", () => {
    expect(msg(" t2510031234567890123456 ")).toMatch(/PhonePe/);
  });

  it("names the Google transaction ID when that is pasted", () => {
    expect(msg("CICAgKDt4qTqWQ")).toMatch(/Google transaction ID/);
  });

  it("rejects an app ID even when its digits happen to total twelve", () => {
    expect(msg("CIC123456789012")).toMatch(/Google transaction ID/);
  });

  it("says numbers only for other letter-bearing input", () => {
    expect(msg("ABC12345")).toMatch(/only numbers/);
  });

  it("falls back to the length message for too few digits", () => {
    expect(msg("41234567")).toMatch(/exactly 12 digits/);
  });

  it("still normalises a good UTR to digits only", () => {
    const r = utrSchema.safeParse({ utr: "UTR: 4123-4567-8901" });
    expect(r.success && r.data.utr).toBe("412345678901");
  });
});

describe("registrationSchema reports every problem at once", () => {
  const issuesFor = (fields: Parameters<typeof registrationSchema>[0], input: object) => {
    const r = registrationSchema(fields).safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
  };

  it("flags every empty mandatory field in a single submit", () => {
    const empty = { fullName: "", email: "", phone: "", club: "", area: "", division: "", mealPreference: "" };
    expect(issuesFor(["club", "area", "division", "mealPreference"], empty).sort()).toEqual(
      ["area", "club", "division", "email", "fullName", "mealPreference", "phone"].sort(),
    );
  });

  it("does not ask for a T-shirt size when the event does not collect it", () => {
    const r = registrationSchema(["club", "area", "division", "mealPreference"]).safeParse({
      ...valid,
      tshirtSize: "",
    });
    expect(r.success).toBe(true);
  });

  it("treats a field of only spaces as missing", () => {
    expect(issuesFor(["club"], { ...valid, club: "   " })).toContain("club");
  });

  it("still rejects a meal preference that is not on the list", () => {
    expect(issuesFor([...allFields], { ...valid, mealPreference: "Pizza" })).toContain("mealPreference");
  });
});

describe("Exuberance'26 fields", () => {
  const fields = ["attendeeType", "mealPreference", "vehicle", "governmentId"] as const;
  const schema = registrationSchema([...fields]);
  const base = {
    fullName: "Asha Rao",
    email: "asha@example.com",
    phone: "9876543210",
    attendeeType: "toastmaster",
    mealPreference: "Vegetarian",
    vehicleType: "four_wheeler",
    vehicleNumber: "tn 09 ab 1234",
    govIdType: "pan",
    govIdNumber: "abcde1234f",
  };
  const errorsFor = (input: object) => {
    const r = schema.safeParse(input);
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
  };

  it("accepts a complete submission and stores plate and ID in one canonical form", () => {
    const r = schema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.vehicleNumber).toBe("TN09AB1234");
      expect(r.data.govIdNumber).toBe("ABCDE1234F");
    }
  });

  it("reports every missing field in one submit", () => {
    expect(Object.keys(errorsFor({ fullName: "", email: "", phone: "" })).sort()).toEqual(
      ["attendeeType", "email", "fullName", "govIdNumber", "govIdType", "mealPreference", "phone", "vehicleType"].sort(),
    );
  });

  it("asks for the vehicle number when coming in their own vehicle", () => {
    expect(errorsFor({ ...base, vehicleNumber: "" }).vehicleNumber).toBe("Vehicle number is required");
    expect(errorsFor({ ...base, vehicleType: "two_wheeler", vehicleNumber: "  " }).vehicleNumber).toBe(
      "Vehicle number is required",
    );
  });

  it("shows the vehicle-number error alongside other errors, not after them", () => {
    const e = errorsFor({ ...base, fullName: "", vehicleNumber: "" });
    expect(e.fullName).toBeDefined();
    expect(e.vehicleNumber).toBeDefined();
  });

  it("does not want a vehicle number for public transport, and drops one if typed", () => {
    const r = schema.safeParse({ ...base, vehicleType: "public", vehicleNumber: "TN09AB1234" });
    expect(r.success && r.data.vehicleNumber).toBeNull();
  });

  it("rejects a plate that is not an Indian registration number", () => {
    expect(errorsFor({ ...base, vehicleNumber: "HELLO" }).vehicleNumber).toMatch(/as on the plate/);
  });

  it("accepts common plate formats including Bharat series", () => {
    for (const plate of ["TN-09-AB-1234", "KA 01 1234", "DL 3C AB 1234", "22 BH 1234 AA"]) {
      expect(errorsFor({ ...base, vehicleNumber: plate }).vehicleNumber, plate).toBeUndefined();
    }
  });

  it("checks each ID number against its own ID type", () => {
    const cases: [string, string, boolean][] = [
      ["aadhaar", "2345 6789 0123", true],
      ["aadhaar", "1234 5678 9012", false], // Aadhaar never starts with 0 or 1
      ["pan", "ABCDE1234F", true],
      ["pan", "ABCD1234F", false],
      ["passport", "A1234567", true],
      ["passport", "12345678", false],
      ["voter_id", "ABC1234567", true],
      ["voter_id", "AB12345678", false],
      ["driving_licence", "TN09 20201234567", true],
      ["driving_licence", "123", false],
    ];
    for (const [type, number, ok] of cases) {
      const e = errorsFor({ ...base, govIdType: type, govIdNumber: number });
      expect(e.govIdNumber === undefined, `${type} ${number}`).toBe(ok);
    }
  });

  it("explains the expected format for the chosen ID type", () => {
    expect(errorsFor({ ...base, govIdType: "aadhaar", govIdNumber: "123" }).govIdNumber).toBe(
      "Enter a valid 12-digit Aadhaar number",
    );
  });

  it("rejects attending-as and travel values that are not offered", () => {
    expect(errorsFor({ ...base, attendeeType: "vip" }).attendeeType).toBeDefined();
    expect(errorsFor({ ...base, vehicleType: "helicopter" }).vehicleType).toBeDefined();
  });

  it("offers only Veg and Non-veg", () => {
    expect(errorsFor({ ...base, mealPreference: "Jain" }).mealPreference).toBeDefined();
    expect(errorsFor({ ...base, mealPreference: "Non-vegetarian" }).mealPreference).toBeUndefined();
  });

  it("refuses travel or ID details for an event that does not collect them", () => {
    const r = registrationSchema(["club"]).safeParse({
      ...valid,
      area: "",
      division: "",
      mealPreference: "",
      tshirtSize: "",
      vehicleType: "public",
    });
    expect(r.success).toBe(false);
  });
});

describe("optionLabel", () => {
  it("turns a stored code into its label", async () => {
    const { optionLabel, VEHICLE_TYPES } = await import("./registration");
    expect(optionLabel(VEHICLE_TYPES, "public")).toBe("Public transport");
    expect(optionLabel(VEHICLE_TYPES, null)).toBe("");
  });
});
