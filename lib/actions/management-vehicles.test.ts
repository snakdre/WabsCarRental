import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockSupabase } from "@/lib/test-utils/supabase-mock";

// Hoisted mocks — vi.mock calls are hoisted above imports.
const supabaseStub = createMockSupabase();
const roleRef = { value: null as "customer" | "manager" | "admin" | null };

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(supabaseStub.client),
  createServiceClient: () => Promise.resolve(supabaseStub.client),
}));
vi.mock("@/lib/utils/roles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/roles")>("@/lib/utils/roles");
  return {
    ...actual,
    getUserRole: () => Promise.resolve(roleRef.value),
  };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    // Mimic Next's redirect() which throws a special error that unwinds the server action.
    const err = new Error(`NEXT_REDIRECT:${url}`);
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  }),
}));

import { updateVehicle, createVehicle } from "./management-vehicles";

const VALID_UUID = "aaaaaaaa-0000-0000-0000-000000000001";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  // Reset state. createMockSupabase holds internal maps/arrays so re-create per test.
  const fresh = createMockSupabase();
  Object.assign(supabaseStub, fresh);
  Object.assign(supabaseStub.client, fresh.client);
  roleRef.value = null;
});

describe("updateVehicle", () => {
  it("returns Forbidden when the user has no manager role", async () => {
    roleRef.value = "customer";
    const result = await updateVehicle(
      fd({
        vehicle_id: VALID_UUID,
        status: "available",
        is_featured: "on",
        daily_price: "500",
        weekly_price: "",
        monthly_price: "",
        description: "",
      })
    );
    expect(result).toEqual({ error: "Forbidden" });
    // DB was never touched.
    expect(supabaseStub.fromCalls).toEqual([]);
  });

  it("returns Forbidden for customer role explicitly", async () => {
    roleRef.value = "customer";
    const result = await updateVehicle(fd({ vehicle_id: VALID_UUID }));
    expect(result.error).toBe("Forbidden");
  });

  it("returns a field error when daily_price is zero", async () => {
    roleRef.value = "admin";
    const result = await updateVehicle(
      fd({
        vehicle_id: VALID_UUID,
        status: "available",
        is_featured: "",
        daily_price: "0",
        weekly_price: "",
        monthly_price: "",
        description: "",
      })
    );
    expect(result.error).toBeDefined();
    expect(result.field).toBe("daily_price");
    // DB was never touched.
    expect(supabaseStub.fromCalls).toEqual([]);
  });

  it("returns Vehicle not found when the row doesn't exist", async () => {
    roleRef.value = "manager";
    supabaseStub.setTableResponse("vehicles", { data: null, error: null });
    const result = await updateVehicle(
      fd({
        vehicle_id: VALID_UUID,
        status: "available",
        is_featured: "",
        daily_price: "500",
        weekly_price: "",
        monthly_price: "",
        description: "",
      })
    );
    expect(result).toEqual({ error: "Vehicle not found" });
    expect(supabaseStub.updatedRows["vehicles"]).toHaveLength(1);
  });

  it("writes the right columns on happy path", async () => {
    roleRef.value = "manager";
    supabaseStub.setTableResponse("vehicles", { data: { id: VALID_UUID }, error: null });
    const result = await updateVehicle(
      fd({
        vehicle_id: VALID_UUID,
        status: "maintenance",
        is_featured: "on",
        daily_price: "750",
        weekly_price: "4500",
        monthly_price: "15000",
        description: "Scheduled service",
      })
    );
    expect(result).toEqual({ success: true });
    const patch = supabaseStub.updatedRows["vehicles"][0] as Record<string, unknown>;
    expect(patch.status).toBe("maintenance");
    expect(patch.is_featured).toBe(true);
    expect(patch.daily_price).toBe(750);
    expect(patch.weekly_price).toBe(4500);
    expect(patch.monthly_price).toBe(15000);
    expect(patch.description).toBe("Scheduled service");
    expect(patch.updated_at).toEqual(expect.any(String));
  });

  it("coerces empty weekly/monthly price inputs to null", async () => {
    roleRef.value = "manager";
    supabaseStub.setTableResponse("vehicles", { data: { id: VALID_UUID }, error: null });
    await updateVehicle(
      fd({
        vehicle_id: VALID_UUID,
        status: "available",
        is_featured: "",
        daily_price: "500",
        weekly_price: "",
        monthly_price: "",
        description: "",
      })
    );
    const patch = supabaseStub.updatedRows["vehicles"][0] as Record<string, unknown>;
    expect(patch.weekly_price).toBeNull();
    expect(patch.monthly_price).toBeNull();
    expect(patch.description).toBeNull();
  });

  it("treats missing is_featured checkbox as false", async () => {
    roleRef.value = "manager";
    supabaseStub.setTableResponse("vehicles", { data: { id: VALID_UUID }, error: null });
    await updateVehicle(
      fd({
        vehicle_id: VALID_UUID,
        status: "available",
        daily_price: "500",
        weekly_price: "",
        monthly_price: "",
        description: "",
      })
    );
    const patch = supabaseStub.updatedRows["vehicles"][0] as Record<string, unknown>;
    expect(patch.is_featured).toBe(false);
  });
});

describe("createVehicle", () => {
  it("returns Forbidden when the user has no manager role", async () => {
    roleRef.value = null;
    const result = await createVehicle(
      fd({
        make: "Ferrari",
        model: "F8",
        trim: "",
        year: "2024",
        category: "exotic",
        daily_price: "900",
        description: "",
      })
    );
    expect(result).toEqual({ error: "Forbidden" });
    expect(supabaseStub.fromCalls).toEqual([]);
  });

  it("returns a field error on invalid category", async () => {
    roleRef.value = "admin";
    const result = await createVehicle(
      fd({
        make: "Ferrari",
        model: "F8",
        trim: "",
        year: "2024",
        category: "sedan",
        daily_price: "900",
        description: "",
      })
    );
    expect(result.error).toBeDefined();
    expect(result.field).toBe("category");
    expect(supabaseStub.fromCalls).toEqual([]);
  });

  it("inserts the right columns and redirects on happy path", async () => {
    roleRef.value = "manager";
    const newId = "bbbbbbbb-0000-0000-0000-000000000002";
    supabaseStub.setTableResponse("vehicles", { data: { id: newId }, error: null });

    await expect(() =>
      createVehicle(
        fd({
          make: "Ferrari",
          model: "F8",
          trim: "Tributo",
          year: "2024",
          category: "exotic",
          daily_price: "900",
          description: "Rare V8",
        })
      )
    ).rejects.toThrow(/NEXT_REDIRECT.*\/management\/vehicles\/bbbbbbbb/);

    const row = supabaseStub.insertedRows["vehicles"][0] as Record<string, unknown>;
    expect(row.make).toBe("Ferrari");
    expect(row.model).toBe("F8");
    expect(row.trim).toBe("Tributo");
    expect(row.year).toBe(2024);
    expect(row.category).toBe("exotic");
    expect(row.daily_price).toBe(900);
    expect(row.description).toBe("Rare V8");
  });

  it("returns 'Insert returned no row' when the DB returns null", async () => {
    roleRef.value = "manager";
    supabaseStub.setTableResponse("vehicles", { data: null, error: null });

    const result = await createVehicle(
      fd({
        make: "Ferrari",
        model: "F8",
        trim: "",
        year: "2024",
        category: "exotic",
        daily_price: "900",
        description: "",
      })
    );
    expect(result).toEqual({ error: "Insert returned no row" });
  });
});
