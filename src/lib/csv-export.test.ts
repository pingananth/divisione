import { describe, it, expect } from "vitest";
import { csvField, csvRow, csvDocument } from "./csv-export";

describe("csvField", () => {
  it("quotes every field", () => {
    expect(csvField("plain")).toBe('"plain"');
  });

  it("escapes embedded quotes by doubling them", () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("renders null and undefined as empty", () => {
    expect(csvField(null)).toBe('""');
    expect(csvField(undefined)).toBe('""');
  });

  it("keeps commas inside the quoted field", () => {
    expect(csvField("Rao, Asha")).toBe('"Rao, Asha"');
  });

  it("neutralises formulas a spreadsheet would execute", () => {
    expect(csvField("=1+1")).toBe(`"'=1+1"`);
    expect(csvField("+441234")).toBe(`"'+441234"`);
    expect(csvField("-2+3")).toBe(`"'-2+3"`);
    expect(csvField("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });

  it("neutralises the classic command-execution payload", () => {
    const payload = '=cmd|\' /C calc\'!A0';
    expect(csvField(payload).startsWith(`"'=`)).toBe(true);
  });

  it("leaves ordinary text that merely contains an equals sign alone", () => {
    expect(csvField("a=b")).toBe('"a=b"');
  });

  it("converts numbers without mangling them", () => {
    expect(csvField(300)).toBe('"300"');
  });
});

describe("csvRow", () => {
  it("joins quoted fields with commas", () => {
    expect(csvRow(["a", "b,c", 1])).toBe('"a","b,c","1"');
  });
});

describe("csvDocument", () => {
  it("starts with a BOM so Excel reads UTF-8 names correctly", () => {
    expect(csvDocument(["h"], [["v"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("uses CRLF line endings", () => {
    expect(csvDocument(["h"], [["v"]])).toBe('\uFEFF"h"\r\n"v"\r\n');
  });

  it("handles a header with no rows", () => {
    expect(csvDocument(["h"], [])).toBe('\uFEFF"h"\r\n');
  });
});
