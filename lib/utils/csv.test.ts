import { describe, it, expect } from "vitest";
import { csvEscape, toCsv } from "./csv";

describe("csvEscape", () => {
  it("passes through plain strings unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("quotes fields containing commas", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("quotes fields with newlines (LF and CRLF)", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("renders null and undefined as empty strings", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("stringifies numbers and booleans", () => {
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(0)).toBe("0");
    expect(csvEscape(true)).toBe("true");
    expect(csvEscape(false)).toBe("false");
  });

  it("renders Dates as ISO strings", () => {
    expect(csvEscape(new Date("2026-10-09T12:34:56Z"))).toBe("2026-10-09T12:34:56.000Z");
  });
});

describe("toCsv", () => {
  it("writes the header line and one row per entry", () => {
    const result = toCsv(["a", "b"], [[1, 2], [3, 4]]);
    expect(result).toBe("a,b\n1,2\n3,4\n");
  });

  it("handles mixed types in a row", () => {
    const result = toCsv(
      ["name", "count", "active"],
      [["widget, deluxe", 10, true]]
    );
    expect(result).toBe('name,count,active\n"widget, deluxe",10,true\n');
  });

  it("emits only the header when rows is empty", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\n");
  });
});
