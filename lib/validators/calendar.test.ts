import { describe, it, expect } from "vitest";
import { parseCalendarParams } from "./calendar";

describe("parseCalendarParams", () => {
  it("returns the current year and month when raw is empty", () => {
    const now = new Date();
    const result = parseCalendarParams({});
    expect(result.year).toBe(now.getFullYear());
    expect(result.month).toBe(now.getMonth() + 1);
  });

  it("accepts valid year and month values", () => {
    const result = parseCalendarParams({ year: "2026", month: "10" });
    expect(result).toEqual({ year: 2026, month: 10 });
  });

  it("falls back to current date when month is out of range", () => {
    const now = new Date();
    const result = parseCalendarParams({ year: "2026", month: "13" });
    expect(result.year).toBe(now.getFullYear());
    expect(result.month).toBe(now.getMonth() + 1);
  });

  it("coerces string values from URL query params", () => {
    const result = parseCalendarParams({ year: "2025", month: "3" });
    expect(result).toEqual({ year: 2025, month: 3 });
  });

  it("falls back when only year is provided (month missing)", () => {
    const now = new Date();
    const result = parseCalendarParams({ year: "2026" });
    expect(result.year).toBe(now.getFullYear());
    expect(result.month).toBe(now.getMonth() + 1);
  });

  it("uses first element when an array value is passed", () => {
    const result = parseCalendarParams({ year: ["2027", "2028"], month: ["4", "5"] });
    expect(result).toEqual({ year: 2027, month: 4 });
  });
});
