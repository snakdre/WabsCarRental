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

import {
  registerVehicleImage,
  setCoverImage,
  reorderVehicleImages,
  deleteVehicleImage,
  duplicateVehicle,
  updateImageAlt,
} from "./management-vehicle-images";
import { validateImageFile } from "@/lib/validators/management-vehicles";

const VEHICLE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const OTHER_VEHICLE = "aaaaaaaa-0000-0000-0000-000000000002";
const IMG_A = "bbbbbbbb-0000-0000-0000-00000000000a";
const IMG_B = "bbbbbbbb-0000-0000-0000-00000000000b";
const OBJ = "cccccccc-0000-0000-0000-000000000001";
const PATH = `${VEHICLE_ID}/${OBJ}.png`;

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
});

describe("validateImageFile", () => {
  it("accepts jpeg/png/webp up to 10MB", () => {
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/gif", size: 1000 })).toMatch(/JPEG, PNG or WebP/);
    expect(validateImageFile({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(validateImageFile({ type: "image/png", size: 0 })).toMatch(/empty/);
  });
});

describe("registerVehicleImage", () => {
  it("forbids customers", async () => {
    roleRef.value = "customer";
    expect(await registerVehicleImage(fd({ vehicle_id: VEHICLE_ID, storage_path: PATH, alt_text: "" }))).toEqual({ error: "Forbidden" });
  });

  it("rejects a path in another vehicle's folder", async () => {
    const r = await registerVehicleImage(fd({ vehicle_id: OTHER_VEHICLE, storage_path: PATH, alt_text: "" }));
    expect(r.error).toMatch(/does not belong/);
  });

  it("rejects path traversal", async () => {
    const r = await registerVehicleImage(fd({ vehicle_id: VEHICLE_ID, storage_path: `${VEHICLE_ID}/../x.png`, alt_text: "" }));
    expect(r.field).toBe("storage_path");
  });

  it("refuses when the object was never uploaded", async () => {
    supabaseStub.setTableResponse("vehicle_images", { data: [], error: null });
    supabaseStub.setStorageResponse("list", { data: [] });
    const r = await registerVehicleImage(fd({ vehicle_id: VEHICLE_ID, storage_path: PATH, alt_text: "" }));
    expect(r.error).toMatch(/not found in storage/);
    expect(supabaseStub.insertedRows["vehicle_images"]).toBeUndefined();
  });

  it("makes the first image the cover with public url", async () => {
    supabaseStub.setTableResponse("vehicle_images", { data: [], error: null });
    supabaseStub.setStorageResponse("list", { data: [{ name: `${OBJ}.png` }] });
    const r = await registerVehicleImage(fd({ vehicle_id: VEHICLE_ID, storage_path: PATH, alt_text: " Front " }));
    expect(r.success).toBe(true);
    expect(supabaseStub.insertedRows["vehicle_images"][0]).toMatchObject({
      vehicle_id: VEHICLE_ID, storage_path: PATH, is_cover: true, sort_order: 0, alt_text: "Front",
      url: `https://cdn.test/vehicle-images/${PATH}`,
    });
  });

  it("appends after existing images without stealing cover", async () => {
    supabaseStub.setTableResponse("vehicle_images", {
      data: [{ id: IMG_A, is_cover: true, sort_order: 0 }, { id: IMG_B, is_cover: false, sort_order: 4 }], error: null,
    });
    supabaseStub.setStorageResponse("list", { data: [{ name: `${OBJ}.png` }] });
    await registerVehicleImage(fd({ vehicle_id: VEHICLE_ID, storage_path: PATH, alt_text: "" }));
    expect(supabaseStub.insertedRows["vehicle_images"][0]).toMatchObject({ is_cover: false, sort_order: 5, alt_text: null });
  });

  it("enforces the per-vehicle cap", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, is_cover: i === 0, sort_order: i }));
    supabaseStub.setTableResponse("vehicle_images", { data: many, error: null });
    expect((await registerVehicleImage(fd({ vehicle_id: VEHICLE_ID, storage_path: PATH, alt_text: "" }))).error).toMatch(/at most 20/);
  });
});

describe("setCoverImage", () => {
  it("calls the atomic RPC", async () => {
    expect(await setCoverImage(fd({ image_id: IMG_B, vehicle_id: VEHICLE_ID }))).toEqual({ success: true });
    expect(supabaseStub.rpcCalls).toEqual([{ fn: "set_vehicle_cover", args: { p_image_id: IMG_B } }]);
  });
});

describe("reorderVehicleImages", () => {
  it("rejects duplicates before hitting the DB", async () => {
    expect((await reorderVehicleImages(VEHICLE_ID, [IMG_A, IMG_A])).error).toMatch(/Duplicate/);
    expect(supabaseStub.rpcCalls).toEqual([]);
  });

  it("maps a stale list to a refresh message", async () => {
    supabaseStub.setRpcResponse("reorder_vehicle_images", { error: { message: "Image list does not match this vehicle" } });
    expect((await reorderVehicleImages(VEHICLE_ID, [IMG_B, IMG_A])).error).toMatch(/Refresh/);
  });

  it("passes the ordered ids", async () => {
    expect(await reorderVehicleImages(VEHICLE_ID, [IMG_B, IMG_A])).toEqual({ success: true });
    expect(supabaseStub.rpcCalls[0]).toEqual({
      fn: "reorder_vehicle_images", args: { p_vehicle_id: VEHICLE_ID, p_image_ids: [IMG_B, IMG_A] },
    });
  });
});

describe("deleteVehicleImage", () => {
  it("returns not found", async () => {
    supabaseStub.setTableResponse("vehicle_images", { data: null, error: null });
    expect(await deleteVehicleImage(fd({ image_id: IMG_A }))).toEqual({ error: "Image not found" });
  });

  it("does not touch storage for seeded unsplash images", async () => {
    supabaseStub.setTableResponse("vehicle_images", {
      data: { id: IMG_A, vehicle_id: VEHICLE_ID, storage_path: "unsplash/photo-1", is_cover: false }, error: null,
    });
    expect(await deleteVehicleImage(fd({ image_id: IMG_A }))).toEqual({ success: true });
    expect(supabaseStub.deletedTables).toContain("vehicle_images");
    expect(supabaseStub.storageCalls).toEqual([]);
  });
});

describe("updateImageAlt", () => {
  it("rejects over-long alt text", async () => {
    expect((await updateImageAlt(fd({ image_id: IMG_A, alt_text: "x".repeat(201) }))).field).toBe("alt_text");
  });
});

describe("duplicateVehicle", () => {
  it("forbids customers", async () => {
    roleRef.value = "customer";
    expect(await duplicateVehicle(fd({ vehicle_id: VEHICLE_ID }))).toEqual({ error: "Forbidden" });
  });
  it("returns the new id", async () => {
    supabaseStub.setRpcResponse("duplicate_vehicle", { data: OTHER_VEHICLE });
    expect(await duplicateVehicle(fd({ vehicle_id: VEHICLE_ID }))).toEqual({ success: true, vehicle_id: OTHER_VEHICLE });
  });
});
