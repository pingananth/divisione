import { describe, expect, it } from "vitest";
import { findUtrInText } from "./utr-ocr";

describe("findUtrInText", () => {
  it("reads Google Pay's UPI transaction ID, not the Google one", () => {
    const text = [
      "₹349",
      "Completed",
      "To: DIVISION E CONTEST",
      "UPI transaction ID",
      "412345678901",
      "Google transaction ID",
      "CICAgOD1234567890abc",
    ].join("\n");
    expect(findUtrInText(text)).toBe("412345678901");
  });

  it("reads PhonePe's UTR and ignores the T-prefixed transaction ID", () => {
    const text = [
      "Transaction Successful",
      "Transaction ID",
      "T2610111234567890123456",
      "UTR: 528712345678",
    ].join("\n");
    expect(findUtrInText(text)).toBe("528712345678");
  });

  it("reads Paytm's UPI Ref No on the same line", () => {
    expect(findUtrInText("Paid Successfully\nUPI Ref No: 6123 4567 8901\n₹175")).toBe("612345678901");
  });

  it("fixes letters OCR reads in place of digits", () => {
    expect(findUtrInText("UPI transaction ID\n41234567B9O1")).toBe("412345678901");
  });

  it("finds nothing on a screen with only an alphanumeric bank ID", () => {
    const text = ["Payment Successful", "Transaction ID", "ICIA8F3K29XQ71", "₹479"].join("\n");
    expect(findUtrInText(text)).toBeNull();
  });

  it("skips a +91 phone number", () => {
    expect(findUtrInText("Mobile\n919876543210\nUTR 412345678901")).toBe("412345678901");
  });

  it("does not guess between two unlabelled numbers", () => {
    expect(findUtrInText("412345678901\n512345678901")).toBeNull();
  });

  it("uses a lone unlabelled 12-digit number", () => {
    expect(findUtrInText("Paid ₹349\n412345678901")).toBe("412345678901");
  });

  it("ignores 12 digits inside a longer number", () => {
    expect(findUtrInText("Ref 41234567890123")).toBeNull();
  });
});
