import { describe, it, expect } from "vitest";
import { generateBookingReference } from "./booking-reference";

describe("generateBookingReference", () => {
  it("matches the WBS-YYYY-XXXXXX format", () => {
    const ref = generateBookingReference(new Date("2026-03-15"));
    expect(ref).toMatch(/^WBS-2026-[A-Z2-9]{6}$/);
  });

  it("uses the readable alphabet (no I, O, 0, 1)", () => {
    const forbidden = /[IO01]/;
    for (let i = 0; i < 200; i++) {
      const suffix = generateBookingReference().slice(-6);
      expect(suffix).not.toMatch(forbidden);
    }
  });

  it("defaults to the current year when no date is passed", () => {
    const ref = generateBookingReference();
    const currentYear = new Date().getFullYear();
    expect(ref.startsWith(`WBS-${currentYear}-`)).toBe(true);
  });
});
