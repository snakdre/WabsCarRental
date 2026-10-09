import { describe, it, expect } from "vitest";
import { formatMoney, formatMileage, formatHorsepower } from "./format";

describe("formatMoney", () => {
  it("formats whole-dollar USD without decimals", () => {
    expect(formatMoney(1200)).toBe("$1,200");
    expect(formatMoney(0)).toBe("$0");
  });

  it("renders em-dash for null and undefined", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });
});

describe("formatMileage", () => {
  it("formats with thousands separator and mi/day suffix", () => {
    expect(formatMileage(150)).toBe("150 mi/day");
    expect(formatMileage(1500)).toBe("1,500 mi/day");
  });

  it("renders Unlimited for null/undefined (electric fleet uses this)", () => {
    expect(formatMileage(null)).toBe("Unlimited");
    expect(formatMileage(undefined)).toBe("Unlimited");
  });
});

describe("formatHorsepower", () => {
  it("formats with hp suffix", () => {
    expect(formatHorsepower(710)).toBe("710 hp");
    expect(formatHorsepower(1020)).toBe("1,020 hp");
  });

  it("renders em-dash for missing values", () => {
    expect(formatHorsepower(null)).toBe("—");
    expect(formatHorsepower(undefined)).toBe("—");
  });
});
