import { describe, it, expect } from "vitest";
import { currentMonthRangeUTC, todayUTC } from "./month-range";

describe("currentMonthRangeUTC", () => {
  it("returns correct range for mid-October 2026", () => {
    const { startISO, endISO } = currentMonthRangeUTC(new Date("2026-10-15T12:34:56Z"));
    expect(startISO).toBe("2026-10-01T00:00:00.000Z");
    expect(endISO).toBe("2026-11-01T00:00:00.000Z");
  });

  it("handles year rollover: December 31 → January 1 next year", () => {
    const { startISO, endISO } = currentMonthRangeUTC(new Date("2026-12-31T23:59:59Z"));
    expect(startISO).toBe("2026-12-01T00:00:00.000Z");
    expect(endISO).toBe("2027-01-01T00:00:00.000Z");
  });

  it("returns correct range for February 2026", () => {
    const { startISO, endISO } = currentMonthRangeUTC(new Date("2026-02-14T00:00:00Z"));
    expect(startISO).toBe("2026-02-01T00:00:00.000Z");
    expect(endISO).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("todayUTC", () => {
  it("returns YYYY-MM-DD for a date with time component", () => {
    expect(todayUTC(new Date("2026-10-15T12:34:56Z"))).toBe("2026-10-15");
  });

  it("returns YYYY-MM-DD for a date at UTC midnight", () => {
    expect(todayUTC(new Date("2026-10-15T00:00:00Z"))).toBe("2026-10-15");
  });
});
