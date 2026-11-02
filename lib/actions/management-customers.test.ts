import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockSupabase } from "@/lib/test-utils/supabase-mock";

const supabaseStub = createMockSupabase();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(supabaseStub.client),
  createServiceClient: () => Promise.resolve(supabaseStub.client),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { setCustomerFlag, setCustomerActive, updateCustomerNotes, setDocumentVerified } from "./management-customers";

const CUSTOMER_ID = "aaaaaaaa-0000-0000-0000-000000000009";
const DOC_ID = "cccccccc-0000-0000-0000-000000000009";
const STAFF_ID = "eeeeeeee-0000-0000-0000-000000000001";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

function asStaff(role = "manager") {
  supabaseStub.setUser({ id: STAFF_ID });
  supabaseStub.setTableResponse("roles", { data: { role }, error: null });
}

beforeEach(() => {
  const fresh = createMockSupabase();
  Object.assign(supabaseStub, fresh);
  Object.assign(supabaseStub.client, fresh.client);
});

describe("setCustomerFlag", () => {
  it("rejects non-staff", async () => {
    supabaseStub.setUser({ id: STAFF_ID });
    supabaseStub.setTableResponse("roles", { data: { role: "customer" }, error: null });
    expect(await setCustomerFlag(fd({ customer_id: CUSTOMER_ID, flagged: "true" }))).toEqual({ error: "Not authorized" });
    expect(supabaseStub.updatedRows["profiles"]).toBeUndefined();
  });

  it("requires sign-in", async () => {
    supabaseStub.setUser(null);
    expect(await setCustomerFlag(fd({ customer_id: CUSTOMER_ID, flagged: "true" }))).toEqual({ error: "Not signed in" });
  });

  it("flags and writes an audit row", async () => {
    asStaff();
    expect(await setCustomerFlag(fd({ customer_id: CUSTOMER_ID, flagged: "true" }))).toEqual({ success: true });
    expect(supabaseStub.updatedRows["profiles"][0]).toMatchObject({ flagged: true });
    expect(supabaseStub.insertedRows["audit_logs"][0]).toMatchObject({
      actor_id: STAFF_ID, action: "customer.flag", entity_type: "customer", entity_id: CUSTOMER_ID,
    });
  });

  it("rejects a non-boolean flag value", async () => {
    asStaff();
    expect((await setCustomerFlag(fd({ customer_id: CUSTOMER_ID, flagged: "maybe" }))).field).toBe("flagged");
  });
});

describe("setCustomerActive", () => {
  // requireStaff reads the caller's role, then the action reads the target's.
  function roles(caller: string, target: string | null) {
    supabaseStub.setUser({ id: STAFF_ID });
    supabaseStub.queueTableResponse("roles", { data: { role: caller }, error: null });
    supabaseStub.queueTableResponse("roles", { data: target ? { role: target } : null, error: null });
  }

  it("deactivates: bans sign-in, marks profile inactive, audits", async () => {
    roles("manager", "customer");
    expect(await setCustomerActive(fd({ customer_id: CUSTOMER_ID, is_active: "false" }))).toEqual({ success: true });
    expect(supabaseStub.adminCalls).toEqual([{ op: "updateUserById", args: [CUSTOMER_ID, { ban_duration: "876000h" }] }]);
    expect(supabaseStub.updatedRows["profiles"][0]).toMatchObject({ is_active: false });
    expect(supabaseStub.insertedRows["audit_logs"][0]).toMatchObject({ action: "customer.deactivate", diff: { sign_in: "banned" } });
  });

  it("reactivates: lifts the ban", async () => {
    roles("admin", "customer");
    expect(await setCustomerActive(fd({ customer_id: CUSTOMER_ID, is_active: "true" }))).toEqual({ success: true });
    expect(supabaseStub.adminCalls[0].args).toEqual([CUSTOMER_ID, { ban_duration: "none" }]);
    expect(supabaseStub.updatedRows["profiles"][0]).toMatchObject({ is_active: true });
  });

  it("refuses to deactivate staff accounts", async () => {
    roles("manager", "admin");
    expect(await setCustomerActive(fd({ customer_id: CUSTOMER_ID, is_active: "false" }))).toEqual({ error: "Customer not found" });
    expect(supabaseStub.adminCalls).toEqual([]);
    expect(supabaseStub.updatedRows["profiles"]).toBeUndefined();
  });

  it("refuses to deactivate yourself", async () => {
    roles("admin", "admin");
    const r = await setCustomerActive(fd({ customer_id: STAFF_ID, is_active: "false" }));
    expect(r.error).toMatch(/your own account/);
    expect(supabaseStub.adminCalls).toEqual([]);
  });

  it("leaves the profile alone if the auth ban fails", async () => {
    roles("manager", "customer");
    supabaseStub.setAdminResponse({ error: { message: "User not found" } });
    const r = await setCustomerActive(fd({ customer_id: CUSTOMER_ID, is_active: "false" }));
    expect(r.error).toMatch(/sign-in access: User not found/);
    expect(supabaseStub.updatedRows["profiles"]).toBeUndefined();
  });
});

describe("updateCustomerNotes", () => {
  it("rejects over-long notes", async () => {
    asStaff();
    expect((await updateCustomerNotes(fd({ customer_id: CUSTOMER_ID, notes: "x".repeat(4001) }))).field).toBe("notes");
  });
  it("saves notes", async () => {
    asStaff();
    expect(await updateCustomerNotes(fd({ customer_id: CUSTOMER_ID, notes: "VIP" }))).toEqual({ success: true });
    expect(supabaseStub.updatedRows["profiles"][0]).toMatchObject({ internal_notes: "VIP" });
  });
});

describe("setDocumentVerified", () => {
  it("returns not found for a missing doc", async () => {
    asStaff();
    supabaseStub.setTableResponse("customer_documents", { data: null, error: null });
    expect(await setDocumentVerified(fd({ document_id: DOC_ID, verified: "true" }))).toEqual({ error: "Document not found" });
  });

  it("verifies and notifies the customer", async () => {
    asStaff();
    supabaseStub.setTableResponse("customer_documents", {
      data: { id: DOC_ID, customer_id: CUSTOMER_ID, type: "passport" }, error: null,
    });
    expect(await setDocumentVerified(fd({ document_id: DOC_ID, verified: "true" }))).toEqual({ success: true });
    expect(supabaseStub.updatedRows["customer_documents"][0]).toEqual({ verified: true });
    expect(supabaseStub.insertedRows["notifications"][0]).toMatchObject({ user_id: CUSTOMER_ID, type: "document_verified" });
  });

  it("does not notify on unverify", async () => {
    asStaff();
    supabaseStub.setTableResponse("customer_documents", {
      data: { id: DOC_ID, customer_id: CUSTOMER_ID, type: "passport" }, error: null,
    });
    await setDocumentVerified(fd({ document_id: DOC_ID, verified: "false" }));
    expect(supabaseStub.insertedRows["notifications"]).toBeUndefined();
  });
});
