import { parseCsv } from "./csv";
import { toPaise } from "../pricing";
import type { StatementRow } from "../types";

export type ColumnMapping = {
  date: number;
  narration: number;
  credit: number;
  /** Dedicated reference/UTR column, when the bank provides one. */
  ref: number | null;
};

export type SkippedRow = { line: number; reason: string; raw: string[] };

export type ParsedStatement = {
  rows: StatementRow[];
  skipped: SkippedRow[];
  mapping: ColumnMapping;
  headerLine: number;
};

const HEADER_PATTERNS = {
  date: /\b(value\s*date|txn\s*date|transaction\s*date|date)\b/i,
  narration: /\b(narration|description|particulars|remarks|transaction\s*remarks|details)\b/i,
  credit: /\b(credit|deposit|cr\s*amount|credit\s*amount|deposit\s*amt)\b/i,
  ref: /\b(ref(erence)?\s*(no|number)?|utr|rrn|chq\s*\/?\s*ref|cheque\s*number)\b/i,
};

/**
 * Find the header row. Bank CSVs prepend account holder name, address, account
 * number and blank lines before the actual table, so we scan for the first row
 * that looks like a header rather than assuming row 0.
 */
function findHeader(rows: string[][]): { line: number; mapping: ColumnMapping } | null {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cells = rows[i].map((c) => c.trim());
    const find = (re: RegExp) => cells.findIndex((c) => re.test(c));

    const date = find(HEADER_PATTERNS.date);
    const credit = find(HEADER_PATTERNS.credit);
    if (date === -1 || credit === -1) continue;

    const narration = find(HEADER_PATTERNS.narration);
    const ref = find(HEADER_PATTERNS.ref);

    return {
      line: i,
      mapping: {
        date,
        credit,
        narration: narration === -1 ? date : narration,
        ref: ref === -1 ? null : ref,
      },
    };
  }
  return null;
}

/** Parse an amount cell. Returns null for blanks, dashes and unparseable text. */
function parseAmount(cell: string): number | null {
  const cleaned = cell.replace(/[₹,\s]/g, "").replace(/^-$/, "");
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return toPaise(value);
}

/**
 * Pull a 12-digit UPI reference out of a cell. UPI narrations look like
 * "UPI/CR/412345678901/PAYER/BANK/note", so the first standalone 12-digit run
 * is the UTR. Bounded on both sides so a 16-digit card number or a long
 * account number cannot masquerade as one.
 */
export function extractUtr(...cells: string[]): string | null {
  for (const cell of cells) {
    if (!cell) continue;
    const match = cell.match(/(?<!\d)(\d{12})(?!\d)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Parse a bank statement CSV into credit rows.
 *
 * Deliberately format-agnostic: rather than one adapter per bank, columns are
 * auto-detected from the header and can be overridden explicitly when a bank's
 * headers are too unusual to detect. Every row that cannot be parsed is
 * reported in `skipped` rather than dropped, so an organiser can see that
 * money arrived even when we could not read it.
 */
export function parseStatement(
  text: string,
  override?: Partial<ColumnMapping>,
): ParsedStatement {
  const all = parseCsv(text);
  const header = findHeader(all);

  if (!header && !isCompleteMapping(override)) {
    throw new Error(
      "Could not find a header row with a date and a credit column. " +
        "Check the file is a CSV statement export, or set the column mapping manually.",
    );
  }

  const mapping: ColumnMapping = {
    ...(header?.mapping ?? { date: 0, narration: 0, credit: 0, ref: null }),
    ...override,
  };
  const startLine = header ? header.line + 1 : 0;

  const rows: StatementRow[] = [];
  const skipped: SkippedRow[] = [];

  for (let i = startLine; i < all.length; i++) {
    const cells = all[i];
    if (cells.every((c) => c.trim() === "")) continue;

    const creditCell = cells[mapping.credit] ?? "";
    const amountPaise = parseAmount(creditCell);

    // No credit amount means a debit row or a footer line, not an error.
    if (amountPaise === null || amountPaise <= 0) continue;

    const narration = (cells[mapping.narration] ?? "").trim();
    const refCell = mapping.ref !== null ? (cells[mapping.ref] ?? "").trim() : "";
    const utr = extractUtr(refCell, narration);

    if (!utr) {
      skipped.push({
        line: i + 1,
        reason: "credit with no 12-digit UPI reference",
        raw: cells,
      });
      continue;
    }

    rows.push({
      utr,
      amountPaise,
      valueDate: (cells[mapping.date] ?? "").trim(),
      narration,
    });
  }

  return { rows, skipped, mapping, headerLine: header ? header.line : -1 };
}

function isCompleteMapping(m?: Partial<ColumnMapping>): m is ColumnMapping {
  return (
    !!m &&
    typeof m.date === "number" &&
    typeof m.credit === "number" &&
    typeof m.narration === "number"
  );
}
