/**
 * Minimal RFC-4180 CSV reader. Bank exports routinely contain quoted fields
 * with embedded commas ("1,234.00") and CRLF line endings, so a naive split
 * on "," corrupts amounts — which in this system means silently mis-matching
 * money. Hence a real parser rather than a regex.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Strip a UTF-8 BOM; several Indian banks emit one and it corrupts the
  // first header cell, which breaks column auto-detection.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Trailing field/row, unless the file simply ended with a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  return rows;
}

/** Drop rows that are entirely empty — bank exports are full of spacer lines. */
export function dropBlankRows(rows: string[][]): string[][] {
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
