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

import { searchCustomers } from "./customer-lookup";
import { listCustomers } from "@/lib/queries/management-customers";

beforeEach(() => {
  const fresh = createMockSupabase();
  Object.assign(supabaseStub, fresh);
  Object.assign(supabaseStub.client, fresh.client);
  roleRef.value = "manager";
});

const row = (i: number) => ({
  id: `aaaaaaaa-0000-0000-0000-00000000000${i}`, email: `c${i}@x.co`, first_name: "C", last_name: String(i), phone: null,
  flagged: false, is_active: true, created_at: "2026-01-01", booking_count: "2", total_spent: "100.50",
  last_booking_at: null, unverified_documents: "0", total_count: "137",
});

describe("searchCustomers", () => {
  it("forbids customers", async () => {
    roleRef.value = "customer";
    expect(await searchCustomers("ada")).toEqual({ error: "Forbidden" });
    expect(supabaseStub.rpcCalls).toEqual([]);
  });
  it("needs 2+ characters before querying", async () => {
    expect(await searchCustomers(" a ")).toEqual({ results: [] });
    expect(supabaseStub.rpcCalls).toEqual([]);
  });
  it("asks for 10 results and returns only picker fields", async () => {
    supabaseStub.setRpcResponse("staff_list_customers", { data: [row(1)] });
    const r = await searchCustomers("c1@");
    expect(supabaseStub.rpcCalls[0]).toEqual({
      fn: "staff_list_customers", args: { p_search: "c1@", p_flagged: null, p_limit: 10, p_offset: 0 },
    });
    expect(Object.keys(r.results![0]).sort()).toEqual(["email", "first_name", "flagged", "id", "is_active", "last_name", "phone"]);
  });
});

describe("listCustomers pagination", () => {
  it("translates page to offset and reads the total", async () => {
    supabaseStub.setRpcResponse("staff_list_customers", { data: [row(1), row(2)] });
    const r = await listCustomers({ page: 3, flagged: "yes" });
    expect(supabaseStub.rpcCalls[0].args).toEqual({ p_search: null, p_flagged: true, p_limit: 50, p_offset: 100 });
    expect(r).toMatchObject({ total: 137, page: 3, pageSize: 50 });
    expect(r.customers[0]).toMatchObject({ booking_count: 2, total_spent: 100.5, unverified_documents: 0 });
    expect(r.customers[0]).not.toHaveProperty("total_count");
  });
  it("returns total 0 for an empty page", async () => {
    supabaseStub.setRpcResponse("staff_list_customers", { data: [] });
    expect(await listCustomers({})).toMatchObject({ customers: [], total: 0, page: 1 });
  });
});
