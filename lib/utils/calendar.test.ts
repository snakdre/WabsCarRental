import { describe, it, expect } from "vitest";
import { daysInMonth, clampBlockToMonth, prevMonth, nextMonth, formatMonth } from "./calendar";

describe("daysInMonth", () => {
  it("returns 31 days for January", () => {
    expect(daysInMonth(2026, 1)).toHaveLength(31);
    expect(daysInMonth(2026, 1)[0]).toBe(1);
    expect(daysInMonth(2026, 1)[30]).toBe(31);
  });

  it("returns 30 days for April", () => {
    expect(daysInMonth(2026, 4)).toHaveLength(30);
    expect(daysInMonth(2026, 4)[29]).toBe(30);
  });

  it("returns 29 days for February 2024 (leap year)", () => {
    expect(daysInMonth(2024, 2)).toHaveLength(29);
    expect(daysInMonth(2024, 2)[28]).toBe(29);
  });

  it("returns 28 days for February 2025 (non-leap year)", () => {
    expect(daysInMonth(2025, 2)).toHaveLength(28);
    expect(daysInMonth(2025, 2)[27]).toBe(28);
  });
});

describe("prevMonth", () => {
  it("returns December of previous year when month is January", () => {
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });

  it("returns previous month within the same year", () => {
    expect(prevMonth(2026, 6)).toEqual({ year: 2026, month: 5 });
  });
});

describe("nextMonth", () => {
  it("returns January of next year when month is December", () => {
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
  });

  it("returns next month within the same year", () => {
    expect(nextMonth(2026, 6)).toEqual({ year: 2026, month: 7 });
  });
});

describe("clampBlockToMonth", () => {
  // October 2026: days 1–31
  const year = 2026;
  const month = 10;

  it("returns block as-is (in day numbers) when entirely inside the month", () => {
    expect(clampBlockToMonth("2026-10-05", "2026-10-10", year, month)).toEqual({
      startDay: 5,
      endDay: 10,
    });
  });

  it("clamps startDay to 1 when block starts before the month", () => {
    expect(clampBlockToMonth("2026-09-28", "2026-10-07", year, month)).toEqual({
      startDay: 1,
      endDay: 7,
    });
  });

  it("clamps endDay to last day of month when block ends after the month", () => {
    expect(clampBlockToMonth("2026-10-25", "2026-11-05", year, month)).toEqual({
      startDay: 25,
      endDay: 31,
    });
  });

  it("returns null when block is entirely before the month", () => {
    expect(clampBlockToMonth("2026-09-01", "2026-09-30", year, month)).toBeNull();
  });

  it("returns null when block is entirely after the month", () => {
    expect(clampBlockToMonth("2026-11-01", "2026-11-15", year, month)).toBeNull();
  });

  it("returns startDay=1 and endDay=lastDay when block exactly covers the whole month", () => {
    expect(clampBlockToMonth("2026-10-01", "2026-10-31", year, month)).toEqual({
      startDay: 1,
      endDay: 31,
    });
  });

  it("returns startDay=1 and endDay=lastDay when block spans across the entire month", () => {
    expect(clampBlockToMonth("2026-09-01", "2026-11-30", year, month)).toEqual({
      startDay: 1,
      endDay: 31,
    });
  });

  it("returns startDay==endDay for a single-day block inside the month", () => {
    expect(clampBlockToMonth("2026-10-15", "2026-10-15", year, month)).toEqual({
      startDay: 15,
      endDay: 15,
    });
  });
});

describe("formatMonth", () => {
  it('returns "October 2026" for month=10, year=2026', () => {
    expect(formatMonth(2026, 10)).toBe("October 2026");
  });

  it('returns "January 2025" for month=1, year=2025', () => {
    expect(formatMonth(2025, 1)).toBe("January 2025");
  });
});
