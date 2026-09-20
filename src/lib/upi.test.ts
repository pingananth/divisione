import { describe, it, expect } from "vitest";
import {
  isValidVpa,
  buildUpiIntentUrl,
  buildReference,
  normaliseUtr,
  isValidUtr,
} from "./upi";

describe("isValidVpa", () => {
  it("accepts common real-world handles", () => {
    expect(isValidVpa("divisione@okhdfcbank")).toBe(true);
    expect(isValidVpa("some.person-1_x@ybl")).toBe(true);
    expect(isValidVpa("9876543210@paytm")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidVpa("noathandle")).toBe(false);
    expect(isValidVpa("two@at@signs")).toBe(false);
    expect(isValidVpa("@okhdfcbank")).toBe(false);
    expect(isValidVpa("someone@")).toBe(false);
    expect(isValidVpa("someone@1bank")).toBe(false); // handle must start with a letter
  });

  it("tolerates surrounding whitespace", () => {
    expect(isValidVpa("  divisione@okhdfcbank  ")).toBe(true);
  });
});

describe("buildUpiIntentUrl", () => {
  const base = {
    vpa: "divisione@okhdfcbank",
    payeeName: "Division E Conference",
    amountPaise: 30000,
    reference: "D229EABC123",
  };

  it("builds a well-formed intent URL", () => {
    const url = buildUpiIntentUrl(base);
    expect(url.startsWith("upi://pay?")).toBe(true);
    expect(url).toContain("pa=divisione%40okhdfcbank");
    expect(url).toContain("am=300.00");
    expect(url).toContain("cu=INR");
    expect(url).toContain("tn=D229EABC123");
  });

  it("percent-encodes spaces rather than using plus signs", () => {
    const url = buildUpiIntentUrl(base);
    expect(url).toContain("pn=Division%20E%20Conference");
    expect(url).not.toContain("+");
  });

  it("always renders the amount to two decimals", () => {
    expect(buildUpiIntentUrl({ ...base, amountPaise: 25000 })).toContain("am=250.00");
    expect(buildUpiIntentUrl({ ...base, amountPaise: 30050 })).toContain("am=300.50");
  });

  it("refuses an invalid VPA instead of producing a dead link", () => {
    expect(() => buildUpiIntentUrl({ ...base, vpa: "nonsense" })).toThrow(/Invalid UPI VPA/);
  });

  it("refuses non-positive or fractional paise amounts", () => {
    expect(() => buildUpiIntentUrl({ ...base, amountPaise: 0 })).toThrow(/positive integer/);
    expect(() => buildUpiIntentUrl({ ...base, amountPaise: -100 })).toThrow(/positive integer/);
    expect(() => buildUpiIntentUrl({ ...base, amountPaise: 300.5 })).toThrow(/positive integer/);
  });
});

describe("buildReference", () => {
  it("produces an uppercase alphanumeric reference", () => {
    expect(buildReference("E", "abc-123")).toBe("D229EABC123");
  });

  it("strips punctuation that some PSP apps reject", () => {
    expect(buildReference("E", "a_b.c/d")).toBe("D229EABCD");
  });

  it("caps length so notes are not truncated mid-reference", () => {
    expect(buildReference("E", "x".repeat(80)).length).toBe(30);
  });
});

describe("normaliseUtr", () => {
  it("accepts a clean 12-digit reference", () => {
    expect(normaliseUtr("123456789012")).toBe("123456789012");
  });

  it("strips the formatting attendees paste in", () => {
    expect(normaliseUtr(" 1234 5678 9012 ")).toBe("123456789012");
    expect(normaliseUtr("UTR: 123456789012")).toBe("123456789012");
    expect(normaliseUtr("1234-5678-9012")).toBe("123456789012");
  });

  it("rejects references of the wrong length", () => {
    expect(normaliseUtr("12345678901")).toBeNull(); // 11 digits
    expect(normaliseUtr("1234567890123")).toBeNull(); // 13 digits
    expect(normaliseUtr("")).toBeNull();
  });

  it("rejects input with no digits at all", () => {
    expect(normaliseUtr("not a reference")).toBeNull();
    expect(isValidUtr("not a reference")).toBe(false);
  });
});
