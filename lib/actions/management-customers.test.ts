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
  it("deactivates", async () => {
    asStaff("admin");
    expect(await setCustomerActive(fd({ customer_id: CUSTOMER_ID, is_active: "false" }))).toEqual({ success: true });
    expect(supabaseStub.updatedRows["profiles"][0]).toMatchObject({ is_active: false });
    expect(supabaseStub.insertedRows["audit_logs"][0]).toMatchObject({ action: "customer.deactivate" });
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
