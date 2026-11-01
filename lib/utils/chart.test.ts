import { describe, it, expect } from "vitest";
import { niceTicks, formatAxisMoney, monthLabel } from "./chart";

describe("niceTicks", () => {
  it("returns [0] for empty data", () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(NaN)).toEqual([0]);
  });
  it("rounds up to clean steps", () => {
    expect(niceTicks(37_400)).toEqual([0, 10_000, 20_000, 30_000, 40_000]);
    expect(niceTicks(900)).toEqual([0, 250, 500, 750, 1000]);
  });
  it("top tick always covers the max", () => {
    for (const m of [1, 7, 99, 1234, 98_765]) {
      const t = niceTicks(m);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(m);
    }
  });
});

describe("formatAxisMoney", () => {
  it("is full under 10K and compact above", () => {
    expect(formatAxisMoney(2500, 5000)).toBe("$2,500");
    expect(formatAxisMoney(20_000, 40_000)).toBe("$20K");
  });
});

describe("monthLabel", () => {
  it("formats in UTC", () => {
    expect(monthLabel("2026-01-01")).toBe("Jan");
  });
});
