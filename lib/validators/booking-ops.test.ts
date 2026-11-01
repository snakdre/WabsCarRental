import { describe, it, expect } from "vitest";
import { recordHandoverSchema, manualBookingSchema, checkDriverRules, ageAt } from "./booking-ops";

const ID = "aaaaaaaa-0000-0000-0000-000000000001";

describe("recordHandoverSchema", () => {
  it("parses numeric strings", () => {
    expect(recordHandoverSchema.parse({ booking_id: ID, odometer: "12345", fuel: "75" }))
      .toEqual({ booking_id: ID, odometer: 12345, fuel: 75, notes: "" });
  });
  it("rejects fuel over 100 and decimals", () => {
    expect(recordHandoverSchema.safeParse({ booking_id: ID, odometer: "1", fuel: "101" }).success).toBe(false);
    expect(recordHandoverSchema.safeParse({ booking_id: ID, odometer: "1.5", fuel: "50" }).success).toBe(false);
  });
});

describe("manualBookingSchema", () => {
  const base = {
    customer_id: ID, vehicle_id: ID, pickup_date: "2027-01-10", return_date: "2027-01-12",
    pickup_method: "pickup", pickup_location_id: null, driver_name: "Ada", driver_email: "a@b.co",
    driver_phone: "5551234567", driver_dob: "1980-01-01", license_number: "X1", license_expiry: "2030-01-01",
    license_region: "CA", protection_plan_id: null, special_requests: null,
    initial_status: "confirmed", payment_method: "cash",
  };
  it("accepts a valid booking", () => {
    expect(manualBookingSchema.safeParse(base).success).toBe(true);
  });
  it("rejects return before pickup", () => {
    const r = manualBookingSchema.safeParse({ ...base, return_date: "2027-01-09" });
    expect(r.success).toBe(false);
  });
  it("rejects cash payment on a pending booking", () => {
    const r = manualBookingSchema.safeParse({ ...base, initial_status: "pending" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["payment_method"]);
  });
});

describe("driver rules", () => {
  it("computes age at pickup", () => {
    expect(ageAt("2000-06-15", "2025-06-14")).toBe(24);
    expect(ageAt("2000-06-15", "2025-06-15")).toBe(25);
  });
  it("flags under-25 and expired licences", () => {
    expect(checkDriverRules({ pickup_date: "2025-01-01", driver_dob: "2005-01-01", license_expiry: "2030-01-01" })?.[1]).toBe("driver_dob");
    expect(checkDriverRules({ pickup_date: "2025-01-01", driver_dob: "1980-01-01", license_expiry: "2025-01-01" })?.[1]).toBe("license_expiry");
    expect(checkDriverRules({ pickup_date: "2025-01-01", driver_dob: "1980-01-01", license_expiry: "2026-01-01" })).toBeNull();
  });
});
