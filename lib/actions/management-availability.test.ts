import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockSupabase } from "@/lib/test-utils/supabase-mock";

const supabaseStub = createMockSupabase();
const roleRef = { value: null as "customer" | "manager" | "admin" | null };

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(supabaseStub.client),
  createServiceClient: () => Promise.resolve(supabaseStub.client),
}));
vi.mock("@/lib/utils/roles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/roles")>("@/lib/utils/roles");
  return { ...actual, getUserRole: () => Promise.resolve(roleRef.value) };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { createAvailabilityBlock } from "./management-availability";

const VALID_UUID = "aaaaaaaa-0000-0000-0000-000000000001";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  const fresh = createMockSupabase();
  Object.assign(supabaseStub, fresh);
  Object.assign(supabaseStub.client, fresh.client);
  roleRef.value = null;
});

describe("createAvailabilityBlock", () => {
  it("returns Forbidden when not a manager", async () => {
    roleRef.value = "customer";
    const result = await createAvailabilityBlock(
      fd({
        vehicle_id: VALID_UUID,
        type: "maintenance",
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        reason: "",
      })
    );
    expect(result).toEqual({ error: "Forbidden" });
    expect(supabaseStub.fromCalls).toEqual([]);
  });

  it("rejects a type outside maintenance|blocked", async () => {
    roleRef.value = "manager";
    supabaseStub.setUser({ id: "u1" });
    const result = await createAvailabilityBlock(
      fd({
        vehicle_id: VALID_UUID,
        type: "booking", // not in BLOCKABLE_TYPES
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        reason: "",
      })
    );
    expect(result.error).toBeDefined();
    expect(result.field).toBe("type");
    // insert never attempted
    expect(supabaseStub.insertedRows["vehicle_availability"]).toBeUndefined();
  });

  it("rejects end before start", async () => {
    roleRef.value = "manager";
    const result = await createAvailabilityBlock(
      fd({
        vehicle_id: VALID_UUID,
        type: "maintenance",
        start_date: "2026-11-05",
        end_date: "2026-11-02",
        reason: "",
      })
    );
    expect(result.error).toBeDefined();
    expect(result.field).toBe("end_date");
  });

  it("returns Not signed in when user is null", async () => {
    roleRef.value = "manager";
    supabaseStub.setUser(null);
    const result = await createAvailabilityBlock(
      fd({
        vehicle_id: VALID_UUID,
        type: "maintenance",
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        reason: "",
      })
    );
    expect(result).toEqual({ error: "Not signed in" });
    expect(supabaseStub.insertedRows["vehicle_availability"]).toBeUndefined();
  });

  it("translates PG 23P01 (EXCLUDE constraint) to a user-friendly message", async () => {
    roleRef.value = "manager";
    supabaseStub.setUser({ id: "u1" });
    supabaseStub.setTableResponse("vehicle_availability", {
      data: null,
      error: { code: "23P01", message: "conflicting key value violates exclusion constraint" },
    });
    const result = await createAvailabilityBlock(
      fd({
        vehicle_id: VALID_UUID,
        type: "maintenance",
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        reason: "",
      })
    );
    expect(result.error).toMatch(/overlap/i);
  });

  it("inserts the row with the authenticated user's id on happy path", async () => {
    roleRef.value = "manager";
    supabaseStub.setUser({ id: "user-123" });
    supabaseStub.setTableResponse("vehicle_availability", { data: null, error: null });
    const result = await createAvailabilityBlock(
      fd({
        vehicle_id: VALID_UUID,
        type: "blocked",
        start_date: "2026-11-01",
        end_date: "2026-11-03",
        reason: "VIP hold",
      })
    );
    expect(result).toEqual({ success: true });
    const row = supabaseStub.insertedRows["vehicle_availability"][0] as Record<string, unknown>;
    expect(row.vehicle_id).toBe(VALID_UUID);
    expect(row.type).toBe("blocked");
    expect(row.start_date).toBe("2026-11-01");
    expect(row.end_date).toBe("2026-11-03");
    expect(row.reason).toBe("VIP hold");
    expect(row.created_by).toBe("user-123");
  });

  it("treats empty reason as null", async () => {
    roleRef.value = "manager";
    supabaseStub.setUser({ id: "u1" });
    supabaseStub.setTableResponse("vehicle_availability", { data: null, error: null });
    await createAvailabilityBlock(
      fd({
        vehicle_id: VALID_UUID,
        type: "maintenance",
        start_date: "2026-11-01",
        end_date: "2026-11-01",
        reason: "   ",
      })
    );
    const row = supabaseStub.insertedRows["vehicle_availability"][0] as Record<string, unknown>;
    expect(row.reason).toBeNull();
  });
});
