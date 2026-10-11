// Minimal, correct RFC 4180 CSV formatter.
//
// A field needs to be quoted if it contains a comma, a quote, or any line
// break. Double-quotes inside a quoted field are escaped by doubling them.
// Nulls and undefineds become empty strings. Numbers and booleans are
// stringified via String(). Dates become ISO strings.

export type CsvValue = string | number | boolean | null | undefined | Date;

export function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const raw =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const headerLine = headers.map(csvEscape).join(",");
  const bodyLines = rows.map((r) => r.map(csvEscape).join(","));
  // RFC 4180 says CRLF but LF-only is widely accepted and keeps diffs cleaner.
  return [headerLine, ...bodyLines].join("\n") + "\n";
}
