import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockSupabase } from "@/lib/test-utils/supabase-mock";

const supabaseStub = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(supabaseStub.client),
  createServiceClient: () => Promise.resolve(supabaseStub.client),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { transitionBookingStatus, updateBookingNotes } from "./management-bookings";

const BOOKING_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const USER_ID = "user-123";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  const fresh = createMockSupabase();
  Object.assign(supabaseStub, fresh);
  Object.assign(supabaseStub.client, fresh.client);
});

describe("transitionBookingStatus", () => {
  it("returns Not signed in when auth is empty", async () => {
    supabaseStub.setUser(null);
    const result = await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "confirmed" })
    );
    expect(result).toEqual({ error: "Not signed in" });
  });

  it("returns Booking not found when the row is missing", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: null, error: null });
    const result = await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "confirmed" })
    );
    expect(result).toEqual({ error: "Booking not found" });
  });

  it("rejects an illegal transition", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: { id: BOOKING_ID, status: "pending" }, error: null });
    const result = await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "completed" })
    );
    expect(result.error).toMatch(/Cannot transition/);
    // No update attempt.
    expect(supabaseStub.updatedRows["bookings"]).toBeUndefined();
  });

  it("requires a note when transitioning to refunded", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: { id: BOOKING_ID, status: "confirmed" }, error: null });
    const result = await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "refunded", note: "" })
    );
    expect(result).toEqual({ error: "Refunds require a note.", field: "note" });
    expect(supabaseStub.rpcCalls).toEqual([]);
  });

  it("calls refund_booking RPC when transitioning to refunded with a note", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: { id: BOOKING_ID, status: "confirmed" }, error: null });
    supabaseStub.setRpcResponse("refund_booking", { data: "refund-id", error: null });
    const result = await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "refunded", note: "car returned damaged" })
    );
    expect(result).toEqual({ success: true });
    expect(supabaseStub.rpcCalls).toEqual([
      {
        fn: "refund_booking",
        args: {
          p_booking_id: BOOKING_ID,
          p_user_id: USER_ID,
          p_note: "car returned damaged",
        },
      },
    ]);
    // The refund branch delegates everything to the RPC — no inline booking update.
    expect(supabaseStub.updatedRows["bookings"]).toBeUndefined();
  });

  it("translates 'No completed payment found' into a user-visible error", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: { id: BOOKING_ID, status: "confirmed" }, error: null });
    supabaseStub.setRpcResponse("refund_booking", {
      data: null,
      error: { message: "No completed payment found for booking ..." },
    });
    const result = await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "refunded", note: "test" })
    );
    expect(result).toEqual({ error: "This booking has no completed payment to refund." });
  });

  it("deletes availability rows when transitioning to cancelled", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: { id: BOOKING_ID, status: "confirmed" }, error: null });
    // Both the update and the history insert need to resolve cleanly.
    const result = await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "cancelled", note: "customer request" })
    );
    expect(result).toEqual({ success: true });
    expect(supabaseStub.updatedRows["bookings"]).toHaveLength(1);
    expect(supabaseStub.insertedRows["booking_status_history"]).toHaveLength(1);
    expect(supabaseStub.deletedTables).toContain("vehicle_availability");
  });

  it("does NOT delete availability for a non-destructive transition", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: { id: BOOKING_ID, status: "confirmed" }, error: null });
    await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "ready_for_pickup" })
    );
    expect(supabaseStub.deletedTables).not.toContain("vehicle_availability");
  });

  it("writes the status-history row with changed_by set to the auth user", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: { id: BOOKING_ID, status: "pending" }, error: null });
    await transitionBookingStatus(
      fd({ booking_id: BOOKING_ID, next_status: "confirmed", note: "approved" })
    );
    const history = supabaseStub.insertedRows["booking_status_history"][0] as Record<string, unknown>;
    expect(history.booking_id).toBe(BOOKING_ID);
    expect(history.status).toBe("confirmed");
    expect(history.changed_by).toBe(USER_ID);
    expect(history.note).toBe("approved");
  });
});

describe("updateBookingNotes", () => {
  it("returns Not signed in when auth is empty", async () => {
    supabaseStub.setUser(null);
    const result = await updateBookingNotes(
      fd({ booking_id: BOOKING_ID, notes: "ok" })
    );
    expect(result).toEqual({ error: "Not signed in" });
  });

  it("rejects notes longer than 2000 chars", async () => {
    supabaseStub.setUser({ id: USER_ID });
    const result = await updateBookingNotes(
      fd({ booking_id: BOOKING_ID, notes: "x".repeat(2001) })
    );
    expect(result.error).toBeDefined();
    expect(result.field).toBe("notes");
    expect(supabaseStub.updatedRows["bookings"]).toBeUndefined();
  });

  it("rejects a non-UUID booking_id", async () => {
    supabaseStub.setUser({ id: USER_ID });
    const result = await updateBookingNotes(
      fd({ booking_id: "not-a-uuid", notes: "ok" })
    );
    expect(result.error).toBeDefined();
    expect(result.field).toBe("booking_id");
  });

  it("updates internal_notes on happy path", async () => {
    supabaseStub.setUser({ id: USER_ID });
    const result = await updateBookingNotes(
      fd({ booking_id: BOOKING_ID, notes: "Verified ID in person" })
    );
    expect(result).toEqual({ success: true });
    const patch = supabaseStub.updatedRows["bookings"][0] as Record<string, unknown>;
    expect(patch.internal_notes).toBe("Verified ID in person");
    expect(patch.updated_at).toEqual(expect.any(String));
  });
});
