import { describe, it, expect } from "vitest";
import { addDays, startOfWeek, dateRange, blockColumns, findConflicts, monthDates, formatWeek } from "./calendar";

describe("date helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("finds Monday of the week", () => {
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26"); // Sunday → previous Monday
    expect(startOfWeek("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(startOfWeek("2026-11-07")).toBe("2026-11-02"); // Saturday
  });
  it("builds ranges", () => {
    expect(dateRange("2026-12-30", 4)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(monthDates(2026, 2)).toHaveLength(28);
  });
  it("formats a week label", () => {
    expect(formatWeek("2026-10-26")).toBe("Oct 26 – Nov 1, 2026");
  });
});

describe("blockColumns", () => {
  const week = dateRange("2026-11-02", 7);
  it("clamps blocks that start before / end after the range", () => {
    expect(blockColumns("2026-10-20", "2026-11-03", week)).toEqual({ from: 1, to: 2 });
    expect(blockColumns("2026-11-07", "2026-12-01", week)).toEqual({ from: 6, to: 7 });
  });
  it("returns null outside the range", () => {
    expect(blockColumns("2026-11-09", "2026-11-10", week)).toBeNull();
    expect(blockColumns("2026-10-01", "2026-11-01", week)).toBeNull();
  });
});

describe("findConflicts", () => {
  it("flags overlapping blocks on the same vehicle only", () => {
    const ids = findConflicts([
      { id: "a", vehicle_id: "v1", start_date: "2026-11-01", end_date: "2026-11-05", type: "booking" },
      { id: "b", vehicle_id: "v1", start_date: "2026-11-05", end_date: "2026-11-06", type: "blocked" },
      { id: "c", vehicle_id: "v1", start_date: "2026-11-10", end_date: "2026-11-12", type: "booking" },
      { id: "d", vehicle_id: "v2", start_date: "2026-11-01", end_date: "2026-11-30", type: "maintenance" },
    ]);
    expect(Array.from(ids).sort()).toEqual(["a", "b"]);
  });
  it("catches a long block overlapping a later, non-adjacent one", () => {
    const ids = findConflicts([
      { id: "long", vehicle_id: "v", start_date: "2026-11-01", end_date: "2026-11-30", type: "blocked" },
      { id: "x", vehicle_id: "v", start_date: "2026-11-03", end_date: "2026-11-04", type: "booking" },
      { id: "y", vehicle_id: "v", start_date: "2026-11-20", end_date: "2026-11-21", type: "booking" },
    ]);
    expect(Array.from(ids).sort()).toEqual(["long", "x", "y"]);
  });
});
