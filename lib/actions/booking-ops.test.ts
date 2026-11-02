import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockSupabase } from "@/lib/test-utils/supabase-mock";

const supabaseStub = createMockSupabase();
const roleRef = { value: null as "customer" | "manager" | "admin" | null };
const pricingStub = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(supabaseStub.client),
  createServiceClient: () => Promise.resolve(supabaseStub.client),
}));
vi.mock("@/lib/utils/roles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/roles")>("@/lib/utils/roles");
  return { ...actual, getUserRole: () => Promise.resolve(roleRef.value) };
});
vi.mock("@/lib/pricing", () => ({ calculatePricing: (...a: unknown[]) => pricingStub(...a) }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}));

import { recordPickup, recordReturn, reassignVehicle, createManualBooking } from "./booking-ops";

const BOOKING = "aaaaaaaa-0000-0000-0000-000000000001";
const VEHICLE = "bbbbbbbb-0000-0000-0000-000000000001";
const CUSTOMER = "cccccccc-0000-0000-0000-000000000001";
const STAFF = "dddddddd-0000-0000-0000-000000000001";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  const fresh = createMockSupabase();
  Object.assign(supabaseStub, fresh);
  Object.assign(supabaseStub.client, fresh.client);
  roleRef.value = "manager";
  supabaseStub.setUser({ id: STAFF });
  pricingStub.mockReset();
  pricingStub.mockResolvedValue({
    rental_days: 3, base_price: 3000, delivery_fee: 0, tax_amount: 240, protection_fee: 0,
    extras_fee: 0, discount_amount: 0, deposit_amount: 1000, total_amount: 3240,
  });
});

describe("recordPickup / recordReturn", () => {
  it("forbids customers", async () => {
    roleRef.value = "customer";
    expect(await recordPickup(fd({ booking_id: BOOKING, odometer: "100", fuel: "80" }))).toEqual({ error: "Forbidden" });
    expect(supabaseStub.rpcCalls).toEqual([]);
  });

  it("validates fuel range", async () => {
    expect((await recordPickup(fd({ booking_id: BOOKING, odometer: "100", fuel: "150" }))).field).toBe("fuel");
  });

  it("calls staff_record_pickup with numbers", async () => {
    expect(await recordPickup(fd({ booking_id: BOOKING, odometer: "12000", fuel: "90", notes: " scratch on bumper " }))).toEqual({ success: true });
    expect(supabaseStub.rpcCalls[0]).toEqual({
      fn: "staff_record_pickup",
      args: { p_booking_id: BOOKING, p_odometer: 12000, p_fuel: 90, p_notes: "scratch on bumper" },
    });
  });

  it("surfaces the odometer guard from the RPC on the odometer field", async () => {
    supabaseStub.setRpcResponse("staff_record_return", { error: { message: "Return odometer is below pickup odometer (12000)", code: "P0001" } });
    const r = await recordReturn(fd({ booking_id: BOOKING, odometer: "11000", fuel: "50" }));
    expect(r).toEqual({ error: "Return odometer is below pickup odometer (12000)", field: "odometer" });
  });

  it("rethrows unknown DB errors", async () => {
    supabaseStub.setRpcResponse("staff_record_return", { error: { message: "connection reset", code: "08006" } });
    await expect(recordReturn(fd({ booking_id: BOOKING, odometer: "1", fuel: "1" }))).rejects.toBeTruthy();
  });
});

describe("reassignVehicle", () => {
  it("maps exclusion violations to a friendly message", async () => {
    supabaseStub.setRpcResponse("staff_reassign_vehicle", { error: { code: "23P01", message: "conflicting key value violates exclusion constraint" } });
    const r = await reassignVehicle(fd({ booking_id: BOOKING, vehicle_id: VEHICLE }));
    expect(r.error).toMatch(/already booked/);
    expect(r.field).toBe("vehicle_id");
  });

  it("strips the status suffix from RPC messages", async () => {
    supabaseStub.setRpcResponse("staff_reassign_vehicle", { error: { code: "P0001", message: "Booking cannot be reassigned in status active" } });
    expect((await reassignVehicle(fd({ booking_id: BOOKING, vehicle_id: VEHICLE }))).error).toMatch(/cannot be reassigned/);
  });
});

describe("createManualBooking", () => {
  const valid = () => ({
    customer_id: CUSTOMER, vehicle_id: VEHICLE, pickup_date: futureDate(10), return_date: futureDate(13),
    pickup_method: "pickup", driver_name: "Ada Lovelace", driver_email: "ada@example.com", driver_phone: "5551234567",
    driver_dob: "1980-01-01", license_number: "L123", license_expiry: "2035-01-01", license_region: "CA",
    initial_status: "confirmed", payment_method: "cash",
  });

  it("enforces the 25+ driver rule", async () => {
    const r = await createManualBooking(fd({ ...valid(), driver_dob: futureDate(-365 * 20) }));
    expect(r.field).toBe("driver_dob");
    expect(supabaseStub.rpcCalls).toEqual([]);
  });

  it("rejects a non-customer account", async () => {
    supabaseStub.setTableResponse("roles", { data: { role: "manager" }, error: null });
    supabaseStub.setTableResponse("vehicles", { data: { status: "available" }, error: null });
    expect((await createManualBooking(fd(valid()))).field).toBe("customer_id");
  });

  it("uses server pricing, confirms, records cash and notifies", async () => {
    supabaseStub.setTableResponse("roles", { data: { role: "customer" }, error: null });
    supabaseStub.setTableResponse("vehicles", { data: { status: "available", min_rental_days: 1, max_rental_days: null }, error: null });
    supabaseStub.setTableResponse("bookings", { data: { id: BOOKING, reference: "WBS-2026-ABCDEF" }, error: null });

    const r = await createManualBooking(fd({ ...valid(), total_amount: "1" /* ignored */ }));
    expect(r).toEqual({ success: true, booking_id: BOOKING });

    const call = supabaseStub.rpcCalls.find(c => c.fn === "create_booking_with_availability")!;
    expect((call.args as { p_booking: Record<string, unknown> }).p_booking).toMatchObject({
      customer_id: CUSTOMER, total_amount: 3240, base_price: 3000,
    });
    expect(supabaseStub.updatedRows["bookings"][0]).toMatchObject({ status: "confirmed" });
    expect(supabaseStub.insertedRows["payments"][0]).toMatchObject({ method: "cash", amount: 3240, status: "completed" });
    expect(supabaseStub.insertedRows["notifications"][0]).toMatchObject({ user_id: CUSTOMER, type: "booking_created" });
    expect(supabaseStub.insertedRows["audit_logs"][0]).toMatchObject({ action: "booking.create_manual", entity_id: BOOKING });
  });

  it("maps overlap to the pickup_date field", async () => {
    supabaseStub.setTableResponse("roles", { data: { role: "customer" }, error: null });
    supabaseStub.setTableResponse("vehicles", { data: { status: "available" }, error: null });
    supabaseStub.setRpcResponse("create_booking_with_availability", { error: { code: "23P01", message: "exclusion" } });
    const r = await createManualBooking(fd(valid()));
    expect(r.field).toBe("pickup_date");
    expect(supabaseStub.insertedRows["payments"]).toBeUndefined();
  });

  describe("delivery and extras", () => {
    const EXTRA_A = "22222222-0000-0000-0000-000000000001";
    const EXTRA_B = "22222222-0000-0000-0000-000000000004";
    const LOCATION = "33333333-0000-0000-0000-000000000001";
    function ready() {
      supabaseStub.setTableResponse("roles", { data: { role: "customer" }, error: null });
      supabaseStub.setTableResponse("vehicles", { data: { status: "available", min_rental_days: 1, max_rental_days: null }, error: null });
      supabaseStub.setTableResponse("bookings", { data: { id: BOOKING, reference: "WBS-2026-ABCDEF" }, error: null });
    }

    it("prices extras from the database, not the form", async () => {
      ready();
      supabaseStub.setTableResponse("extras", { data: [{ id: EXTRA_A, price: 15 }, { id: EXTRA_B, price: 85 }], error: null });
      const extras = JSON.stringify([{ extra_id: EXTRA_A, quantity: 2 }, { extra_id: EXTRA_B, quantity: 1, unit_price: 0.01 }]);
      expect(await createManualBooking(fd({ ...valid(), extras }))).toEqual({ success: true, booking_id: BOOKING });
      expect(pricingStub.mock.calls[0][0]).toMatchObject({
        extras: [{ extra_id: EXTRA_A, quantity: 2 }, { extra_id: EXTRA_B, quantity: 1 }],
      });
      const p = (supabaseStub.rpcCalls.find(c => c.fn === "create_booking_with_availability")!.args as { p_booking: { extras: unknown } }).p_booking;
      expect(p.extras).toEqual([
        { extra_id: EXTRA_A, quantity: 2, unit_price: 15 },
        { extra_id: EXTRA_B, quantity: 1, unit_price: 85 },
      ]);
    });

    it("rejects an inactive or unknown extra", async () => {
      ready();
      supabaseStub.setTableResponse("extras", { data: [{ id: EXTRA_A, price: 15 }], error: null });
      const extras = JSON.stringify([{ extra_id: EXTRA_A, quantity: 1 }, { extra_id: EXTRA_B, quantity: 1 }]);
      const r = await createManualBooking(fd({ ...valid(), extras }));
      expect(r).toEqual({ error: "One of the extras is no longer available.", field: "extras" });
      expect(supabaseStub.rpcCalls).toEqual([]);
    });

    it("rejects duplicate extras and malformed JSON with a field error", async () => {
      ready();
      const dup = JSON.stringify([{ extra_id: EXTRA_A, quantity: 1 }, { extra_id: EXTRA_A, quantity: 2 }]);
      expect((await createManualBooking(fd({ ...valid(), extras: dup }))).field).toBe("extras");
      expect((await createManualBooking(fd({ ...valid(), extras: "{not json" }))).field).toBe("extras");
    });

    it("refuses delivery from a location that belongs to another vehicle", async () => {
      ready();
      supabaseStub.setTableResponse("vehicle_locations", { data: { delivery_available: true, vehicle_id: "someone-else" }, error: null });
      const r = await createManualBooking(fd({ ...valid(), pickup_method: "delivery", pickup_location_id: LOCATION }));
      expect(r).toEqual({ error: "That location doesn't belong to this vehicle.", field: "pickup_location_id" });
    });

    it("books delivery when the vehicle's location offers it", async () => {
      ready();
      supabaseStub.setTableResponse("vehicle_locations", { data: { delivery_available: true, vehicle_id: VEHICLE }, error: null });
      const r = await createManualBooking(fd({ ...valid(), pickup_method: "delivery", pickup_location_id: LOCATION }));
      expect(r).toEqual({ success: true, booking_id: BOOKING });
      expect(pricingStub.mock.calls[0][0]).toMatchObject({ pickup_method: "delivery", pickup_location_id: LOCATION });
    });
  });
});
