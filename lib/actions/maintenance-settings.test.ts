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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { createMaintenance, setMaintenanceStatus } from "./maintenance";
import { updateSettings } from "./settings";

const VEHICLE = "aaaaaaaa-0000-0000-0000-000000000001";
const RECORD = "bbbbbbbb-0000-0000-0000-000000000001";
const ADMIN = "cccccccc-0000-0000-0000-000000000001";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  const fresh = createMockSupabase();
  Object.assign(supabaseStub, fresh);
  Object.assign(supabaseStub.client, fresh.client);
  roleRef.value = "manager";
  supabaseStub.setUser({ id: ADMIN });
});

describe("createMaintenance", () => {
  const valid = {
    vehicle_id: VEHICLE, category: "service", service_date: "2026-12-01", return_date: "2026-12-03",
    description: "Annual service", vendor: "Beverly Motors", cost: "450.00", odometer: "18250",
  };

  it("forbids customers", async () => {
    roleRef.value = "customer";
    expect(await createMaintenance(fd(valid))).toEqual({ error: "Forbidden" });
  });

  it("validates return >= service date", async () => {
    expect((await createMaintenance(fd({ ...valid, return_date: "2026-11-30" }))).field).toBe("return_date");
  });

  it("rejects malformed cost", async () => {
    expect((await createMaintenance(fd({ ...valid, cost: "4,50" }))).field).toBe("cost");
  });

  it("passes typed args to the RPC (blank optional fields become null)", async () => {
    supabaseStub.setRpcResponse("staff_create_maintenance", { data: RECORD });
    const r = await createMaintenance(fd({ ...valid, return_date: "", cost: "", odometer: "" }));
    expect(r).toEqual({ success: true, id: RECORD });
    expect(supabaseStub.rpcCalls[0]).toEqual({
      fn: "staff_create_maintenance",
      args: {
        p_vehicle_id: VEHICLE, p_category: "service", p_service_date: "2026-12-01", p_return_date: null,
        p_description: "Annual service", p_vendor: "Beverly Motors", p_cost: null, p_odometer: null,
      },
    });
  });

  it("maps overlap to service_date", async () => {
    supabaseStub.setRpcResponse("staff_create_maintenance", { error: { code: "23P01", message: "exclusion" } });
    const r = await createMaintenance(fd(valid));
    expect(r.field).toBe("service_date");
    expect(r.error).toMatch(/overlap/);
  });
});

describe("setMaintenanceStatus", () => {
  it("rejects scheduling as a target status", async () => {
    expect((await setMaintenanceStatus(fd({ id: RECORD, status: "scheduled", cost: "", odometer: "" }))).field).toBe("status");
  });
  it("surfaces illegal transitions from the RPC", async () => {
    supabaseStub.setRpcResponse("staff_set_maintenance_status", { error: { message: "Cannot move maintenance from completed to cancelled", code: "P0001" } });
    expect((await setMaintenanceStatus(fd({ id: RECORD, status: "cancelled", cost: "", odometer: "" }))).error).toMatch(/Cannot move/);
  });
  it("completes with final cost", async () => {
    expect(await setMaintenanceStatus(fd({ id: RECORD, status: "completed", cost: "512.40", odometer: "18300" }))).toEqual({ success: true });
    expect(supabaseStub.rpcCalls[0].args).toEqual({ p_id: RECORD, p_status: "completed", p_cost: 512.4, p_odometer: 18300 });
  });
});

describe("updateSettings", () => {
  it("is admin-only (managers refused)", async () => {
    roleRef.value = "manager";
    expect((await updateSettings(fd({ tax_rate: "9" }))).error).toMatch(/Only admins/);
    expect(supabaseStub.fromCalls).toEqual([]);
  });

  it("reports the offending field", async () => {
    roleRef.value = "admin";
    expect(await updateSettings(fd({ tax_rate: "9", min_driver_age: "12" }))).toMatchObject({ field: "min_driver_age" });
  });

  it("ignores unknown keys and only writes changed ones, with an audit diff", async () => {
    roleRef.value = "admin";
    supabaseStub.setTableResponse("application_settings", {
      data: [{ key: "tax_rate", value: 0.08 }, { key: "business_name", value: "Wabs Car Rental" }], error: null,
    });
    const r = await updateSettings(fd({ tax_rate: "9.5", business_name: "Wabs Car Rental", payment_mode: "stripe" }));
    expect(r).toEqual({ success: true, changed: 1 });
    const audit = supabaseStub.insertedRows["audit_logs"][0] as { diff: Record<string, unknown> };
    expect(audit.diff).toEqual({ tax_rate: { from: 0.08, to: 0.095 } });
    expect(Object.keys(audit.diff)).not.toContain("payment_mode");
  });

  it("no-ops when nothing changed", async () => {
    roleRef.value = "admin";
    supabaseStub.setTableResponse("application_settings", { data: [{ key: "tax_rate", value: 0.08 }], error: null });
    expect(await updateSettings(fd({ tax_rate: "8" }))).toEqual({ success: true, changed: 0 });
    expect(supabaseStub.insertedRows["audit_logs"]).toBeUndefined();
  });
});
