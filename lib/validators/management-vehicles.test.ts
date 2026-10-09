import { describe, it, expect } from "vitest";
import { updateVehicleSchema } from "./management-vehicles";

const base = {
  vehicle_id: "aaaaaaaa-0000-0000-0000-000000000001",
  status: "available" as const,
  is_featured: true,
  daily_price: 1200,
  weekly_price: null,
  monthly_price: null,
  description: null,
};

describe("updateVehicleSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = updateVehicleSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid vehicle_id", () => {
    const result = updateVehicleSchema.safeParse({ ...base, vehicle_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = updateVehicleSchema.safeParse({ ...base, status: "retired" });
    expect(result.success).toBe(false);
  });

  it("rejects zero and negative daily_price", () => {
    expect(updateVehicleSchema.safeParse({ ...base, daily_price: 0 }).success).toBe(false);
    expect(updateVehicleSchema.safeParse({ ...base, daily_price: -1 }).success).toBe(false);
  });

  it("allows weekly_price / monthly_price to be null", () => {
    expect(
      updateVehicleSchema.safeParse({ ...base, weekly_price: null, monthly_price: null }).success
    ).toBe(true);
  });

  it("rejects description longer than 2000 chars", () => {
    const result = updateVehicleSchema.safeParse({ ...base, description: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });
});
