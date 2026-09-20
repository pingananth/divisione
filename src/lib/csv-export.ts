/**
 * Quote a value for CSV output.
 *
 * Member-supplied names, club names and review notes end up in this file, and
 * organisers open it in Excel or Google Sheets. A field starting with =, +, -
 * or @ is executed as a formula on open, so it is prefixed with an apostrophe
 * to render it inert without changing what a reader sees.
 */
export function csvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",");
}

/**
 * Build a full CSV document. Excel needs a UTF-8 BOM to render Indian names
 * correctly, and CRLF endings to avoid a single-line file on Windows.
 */
export function csvDocument(header: string[], rows: unknown[][]): string {
  return `\uFEFF${[csvRow(header), ...rows.map(csvRow)].join("\r\n")}\r\n`;
}
