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

import {
  updateProfile,
  cancelMyBooking,
  toggleFavorite,
  uploadDocument,
  deleteDocument,
  markAllNotificationsRead,
} from "./account";

const BOOKING_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const VEHICLE_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const DOC_ID = "cccccccc-0000-0000-0000-000000000001";
const USER_ID = "dddddddd-0000-0000-0000-000000000001";

function fd(entries: Record<string, string | File>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

beforeEach(() => {
  const fresh = createMockSupabase();
  Object.assign(supabaseStub, fresh);
  Object.assign(supabaseStub.client, fresh.client);
});

describe("updateProfile", () => {
  const valid = {
    first_name: "Ada", last_name: "Lovelace", phone: "+1 555 123 4567", date_of_birth: "1990-01-02",
    address_line1: "1 Main St", address_city: "LA", address_state: "CA", address_zip: "90001",
  };

  it("rejects missing first name with field", async () => {
    supabaseStub.setUser({ id: USER_ID });
    const r = await updateProfile(fd({ ...valid, first_name: "" }));
    expect(r.field).toBe("first_name");
    expect(supabaseStub.updatedRows["profiles"]).toBeUndefined();
  });

  it("requires sign-in", async () => {
    supabaseStub.setUser(null);
    expect(await updateProfile(fd(valid))).toEqual({ error: "Not signed in" });
  });

  it("writes address as jsonb", async () => {
    supabaseStub.setUser({ id: USER_ID });
    expect(await updateProfile(fd(valid))).toEqual({ success: true });
    const patch = supabaseStub.updatedRows["profiles"][0] as Record<string, unknown>;
    expect(patch.address).toEqual({ line1: "1 Main St", city: "LA", state: "CA", zip: "90001" });
    expect(patch.first_name).toBe("Ada");
  });

  it("stores null address when all address fields are blank", async () => {
    supabaseStub.setUser({ id: USER_ID });
    await updateProfile(fd({ ...valid, address_line1: "", address_city: "", address_state: "", address_zip: "" }));
    const patch = supabaseStub.updatedRows["profiles"][0] as Record<string, unknown>;
    expect(patch.address).toBeNull();
  });
});

describe("cancelMyBooking", () => {
  it("returns not found for someone else's booking", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", { data: null, error: null });
    expect(await cancelMyBooking(fd({ booking_id: BOOKING_ID }))).toEqual({ error: "Booking not found" });
    expect(supabaseStub.rpcCalls).toEqual([]);
  });

  it("refuses inside the 24h window without calling the RPC", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", {
      data: { id: BOOKING_ID, status: "confirmed", pickup_date: inDays(0.5) }, error: null,
    });
    const r = await cancelMyBooking(fd({ booking_id: BOOKING_ID }));
    expect(r.error).toMatch(/can no longer be cancelled/);
    expect(supabaseStub.rpcCalls).toEqual([]);
  });

  it("refuses active bookings", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", {
      data: { id: BOOKING_ID, status: "active", pickup_date: inDays(5) }, error: null,
    });
    expect((await cancelMyBooking(fd({ booking_id: BOOKING_ID }))).error).toBeDefined();
  });

  it("calls cancel_my_booking RPC with reason", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", {
      data: { id: BOOKING_ID, status: "confirmed", pickup_date: inDays(5) }, error: null,
    });
    const r = await cancelMyBooking(fd({ booking_id: BOOKING_ID, reason: "plans changed" }));
    expect(r).toEqual({ success: true });
    expect(supabaseStub.rpcCalls).toEqual([
      { fn: "cancel_my_booking", args: { p_booking_id: BOOKING_ID, p_reason: "plans changed" } },
    ]);
  });

  it("maps an RPC window race to a friendly error", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("bookings", {
      data: { id: BOOKING_ID, status: "confirmed", pickup_date: inDays(5) }, error: null,
    });
    supabaseStub.setRpcResponse("cancel_my_booking", { error: { message: "Cancellation window has closed" } });
    expect((await cancelMyBooking(fd({ booking_id: BOOKING_ID }))).error).toMatch(/can no longer/);
  });
});

describe("toggleFavorite", () => {
  it("inserts when not yet favorited", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("favorites", { data: null, error: null });
    const r = await toggleFavorite(fd({ vehicle_id: VEHICLE_ID }));
    expect(r).toEqual({ success: true, favorited: true });
    expect(supabaseStub.insertedRows["favorites"]).toEqual([{ customer_id: USER_ID, vehicle_id: VEHICLE_ID }]);
  });

  it("deletes when already favorited", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("favorites", { data: { id: "fav-1" }, error: null });
    const r = await toggleFavorite(fd({ vehicle_id: VEHICLE_ID }));
    expect(r).toEqual({ success: true, favorited: false });
    expect(supabaseStub.deletedTables).toContain("favorites");
  });

  it("rejects a malformed id", async () => {
    supabaseStub.setUser({ id: USER_ID });
    expect((await toggleFavorite(fd({ vehicle_id: "nope" }))).field).toBe("vehicle_id");
  });
});

describe("uploadDocument", () => {
  it("rejects disallowed mime types", async () => {
    supabaseStub.setUser({ id: USER_ID });
    const file = new File(["hello"], "a.txt", { type: "text/plain" });
    const r = await uploadDocument(fd({ type: "passport", file }));
    expect(r.error).toMatch(/JPEG, PNG, WebP or PDF/);
    expect(supabaseStub.storageCalls).toEqual([]);
  });

  it("uploads into the user's folder then records the row", async () => {
    supabaseStub.setUser({ id: USER_ID });
    const file = new File([new Uint8Array(100)], "lic.png", { type: "image/png" });
    expect(await uploadDocument(fd({ type: "license_front", file }))).toEqual({ success: true });
    const up = supabaseStub.storageCalls.find(c => c.op === "upload")!;
    expect(up.bucket).toBe("customer-documents");
    expect(String(up.args[0])).toMatch(new RegExp(`^${USER_ID}/[0-9a-f-]+\\.png$`));
    const row = supabaseStub.insertedRows["customer_documents"][0] as Record<string, unknown>;
    expect(row).toMatchObject({ customer_id: USER_ID, type: "license_front" });
  });

  it("surfaces storage errors without inserting", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setStorageResponse("upload", { error: { message: "quota" } });
    const file = new File([new Uint8Array(10)], "p.pdf", { type: "application/pdf" });
    expect((await uploadDocument(fd({ type: "passport", file }))).error).toMatch(/quota/);
    expect(supabaseStub.insertedRows["customer_documents"]).toBeUndefined();
  });
});

describe("deleteDocument", () => {
  it("blocks deleting verified documents", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("customer_documents", {
      data: { id: DOC_ID, storage_path: `${USER_ID}/x.png`, verified: true }, error: null,
    });
    expect((await deleteDocument(fd({ id: DOC_ID }))).error).toMatch(/Verified/);
    expect(supabaseStub.deletedTables).toEqual([]);
  });

  it("deletes the row and the object", async () => {
    supabaseStub.setUser({ id: USER_ID });
    supabaseStub.setTableResponse("customer_documents", {
      data: { id: DOC_ID, storage_path: `${USER_ID}/x.png`, verified: false }, error: null,
    });
    expect(await deleteDocument(fd({ id: DOC_ID }))).toEqual({ success: true });
    expect(supabaseStub.deletedTables).toContain("customer_documents");
    expect(supabaseStub.storageCalls.map(c => c.op)).toEqual(["remove"]);
  });
});

describe("markAllNotificationsRead", () => {
  it("updates is_read for the user", async () => {
    supabaseStub.setUser({ id: USER_ID });
    expect(await markAllNotificationsRead()).toEqual({ success: true });
    expect(supabaseStub.updatedRows["notifications"]).toEqual([{ is_read: true }]);
  });
});
