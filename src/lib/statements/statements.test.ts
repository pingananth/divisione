import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv, dropBlankRows } from "./csv";
import { parseStatement, extractUtr } from "./index";

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8");

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas inside quoted amounts intact", () => {
    expect(parseCsv('date,"1,234.00",bal')).toEqual([["date", "1,234.00", "bal"]]);
  });

  it("handles escaped quotes", () => {
    expect(parseCsv('a,"he said ""hi""",b')).toEqual([["a", 'he said "hi"', "b"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a UTF-8 BOM so the first header cell still matches", () => {
    expect(parseCsv("\uFEFFDate,Credit")).toEqual([["Date", "Credit"]]);
  });

  it("does not emit a phantom trailing row for a trailing newline", () => {
    expect(parseCsv("a,b\n")).toEqual([["a", "b"]]);
  });

  it("drops entirely blank rows on request", () => {
    expect(dropBlankRows([["a"], ["", "  "], ["b"]])).toEqual([["a"], ["b"]]);
  });
});

describe("extractUtr", () => {
  it("pulls a 12-digit reference out of a UPI narration", () => {
    expect(extractUtr("UPI/CR/412345678901/PAYER/BANK")).toBe("412345678901");
  });

  it("prefers the first cell given, so a ref column beats the narration", () => {
    expect(extractUtr("412345678901", "UPI/999999999999/x")).toBe("412345678901");
  });

  it("falls back to later cells when the first has no reference", () => {
    expect(extractUtr("", "UPI/412345678901/x")).toBe("412345678901");
  });

  it("does not match inside a longer digit run", () => {
    expect(extractUtr("4123456789012345")).toBeNull();
    expect(extractUtr("1234567890123")).toBeNull();
  });

  it("returns null when there is no reference at all", () => {
    expect(extractUtr("ATM WDL", "")).toBeNull();
  });
});

describe("parseStatement", () => {
  it("parses an HDFC-style export, skipping preamble and debits", () => {
    const { rows, headerLine } = parseStatement(fixture("hdfc.csv"));
    expect(headerLine).toBeGreaterThan(0); // header is not the first line
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ utr: "412345678901", amountPaise: 30000 });
    expect(rows[1]).toMatchObject({ utr: "412345678902", amountPaise: 120000 });
    expect(rows[2]).toMatchObject({ utr: "412345678903", amountPaise: 25000 });
  });

  it("excludes the ATM withdrawal row entirely", () => {
    const { rows } = parseStatement(fixture("hdfc.csv"));
    expect(rows.some((r) => r.narration.includes("ATM"))).toBe(false);
  });

  it("parses quoted thousands separators without losing a digit", () => {
    const { rows } = parseStatement(fixture("hdfc.csv"));
    expect(rows[1].amountPaise).toBe(120000); // "1,200.00" not 1.00
  });

  it("parses an ICICI-style export with different headers", () => {
    const { rows } = parseStatement(fixture("icici.csv"));
    expect(rows.map((r) => r.utr)).toEqual(["412345678904", "412345678905"]);
    expect(rows.every((r) => r.amountPaise === 30000)).toBe(true);
  });

  it("reports credits with no UPI reference rather than dropping them", () => {
    const { rows, skipped } = parseStatement(fixture("icici.csv"));
    expect(rows.some((r) => r.narration.includes("SALARY"))).toBe(false);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/no 12-digit/);
  });

  it("keeps the narration verbatim for the audit trail", () => {
    const { rows } = parseStatement(fixture("hdfc.csv"));
    expect(rows[0].narration).toContain("ASHA RAO");
  });

  it("throws a usable error when the file is not a statement", () => {
    expect(() => parseStatement(fixture("no-header.csv"))).toThrow(/Could not find a header row/);
  });

  it("accepts a manual column mapping when auto-detection is not wanted", () => {
    const csv = "x,y,z\n01/09/2026,SOMETHING 412345678901 ELSE,300.00\n";
    const { rows } = parseStatement(csv, { date: 0, narration: 1, credit: 2, ref: null });
    expect(rows).toHaveLength(1);
    expect(rows[0].utr).toBe("412345678901");
  });

  it("produces rows that feed straight into reconciliation", () => {
    const { rows } = parseStatement(fixture("hdfc.csv"));
    for (const r of rows) {
      expect(r.utr).toMatch(/^\d{12}$/);
      expect(Number.isInteger(r.amountPaise)).toBe(true);
    }
  });
});
