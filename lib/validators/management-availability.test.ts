import { describe, it, expect } from "vitest";
import { createAvailabilityBlockSchema } from "./management-availability";

const base = {
  vehicle_id: "aaaaaaaa-0000-0000-0000-000000000001",
  type: "maintenance" as const,
  start_date: "2026-10-07",
  end_date: "2026-10-07",
  reason: null,
};

describe("createAvailabilityBlockSchema", () => {
  it("accepts a minimal valid payload (maintenance, same-day, null reason)", () => {
    const result = createAvailabilityBlockSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts blocked type", () => {
    const result = createAvailabilityBlockSchema.safeParse({ ...base, type: "blocked" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown type (booking should not be creatable through this schema)", () => {
    const result = createAvailabilityBlockSchema.safeParse({ ...base, type: "booking" });
    expect(result.success).toBe(false);
  });

  it("rejects malformed start_date", () => {
    const result = createAvailabilityBlockSchema.safeParse({ ...base, start_date: "10-07-2026" });
    expect(result.success).toBe(false);
  });

  it("rejects malformed end_date", () => {
    const result = createAvailabilityBlockSchema.safeParse({ ...base, end_date: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects when end_date is before start_date", () => {
    const result = createAvailabilityBlockSchema.safeParse({
      ...base,
      start_date: "2026-10-10",
      end_date: "2026-10-09",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("end_date"));
      expect(issue?.message).toBe("End date must be on or after start date");
    }
  });

  it("accepts same-day range (end_date == start_date)", () => {
    const result = createAvailabilityBlockSchema.safeParse({
      ...base,
      start_date: "2026-11-01",
      end_date: "2026-11-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID vehicle_id", () => {
    const result = createAvailabilityBlockSchema.safeParse({ ...base, vehicle_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects reason longer than 500 chars", () => {
    const result = createAvailabilityBlockSchema.safeParse({
      ...base,
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("treats reason: null as valid", () => {
    const result = createAvailabilityBlockSchema.safeParse({ ...base, reason: null });
    expect(result.success).toBe(true);
  });
});
