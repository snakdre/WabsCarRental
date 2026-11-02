import { describe, it, expect } from "vitest";
import { datesSchema, extrasSchema } from "./checkout";

// Seed data uses memorable ids like aaaaaaaa-0000-0000-0000-000000000001.
// Zod's strict .uuid() rejects them (version nibble 0), which made checkout
// fail with "Invalid UUID" for every seeded vehicle.
const SEED_ID = "aaaaaaaa-0000-0000-0000-000000000001";

describe("checkout validators accept seed-style ids", () => {
  it("datesSchema", () => {
    const r = datesSchema.safeParse({
      vehicle_id: SEED_ID, pickup_date: "2027-01-10", return_date: "2027-01-12", pickup_method: "pickup",
    });
    expect(r.success).toBe(true);
  });
  it("extrasSchema", () => {
    const r = extrasSchema.safeParse({ protection_plan_id: SEED_ID, extras: [{ extra_id: SEED_ID, quantity: 1 }] });
    expect(r.success).toBe(true);
  });
  it("still rejects non-ids", () => {
    expect(datesSchema.safeParse({ vehicle_id: "nope", pickup_date: "2027-01-10", return_date: "2027-01-12", pickup_method: "pickup" }).success).toBe(false);
  });
});
