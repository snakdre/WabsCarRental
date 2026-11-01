import { describe, it, expect } from "vitest";
import { canCustomerCancel, parseAccountTab, profileSchema, documentMetaSchema } from "./account";

describe("canCustomerCancel", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  it("allows confirmed booking more than 24h out", () => {
    expect(canCustomerCancel("confirmed", "2026-11-03T12:00:00Z", now)).toBe(true);
  });
  it("rejects inside the 24h window", () => {
    expect(canCustomerCancel("confirmed", "2026-11-02T11:00:00Z", now)).toBe(false);
  });
  it("rejects terminal / active statuses", () => {
    for (const s of ["active", "completed", "cancelled", "refunded", "rejected"]) {
      expect(canCustomerCancel(s, "2027-01-01T00:00:00Z", now)).toBe(false);
    }
  });
});

describe("parseAccountTab", () => {
  it("defaults to bookings", () => {
    expect(parseAccountTab(undefined)).toBe("bookings");
    expect(parseAccountTab("nope")).toBe("bookings");
  });
  it("accepts known tabs", () => {
    expect(parseAccountTab(["documents"])).toBe("documents");
  });
});

describe("profileSchema", () => {
  const base = {
    first_name: "Ada", last_name: "Lovelace", phone: "", date_of_birth: "",
    address_line1: "", address_city: "", address_state: "", address_zip: "",
  };
  it("normalizes blanks to null", () => {
    const r = profileSchema.parse(base);
    expect(r.phone).toBeNull();
    expect(r.date_of_birth).toBeNull();
    expect(r.address_city).toBeNull();
  });
  it("requires names", () => {
    expect(profileSchema.safeParse({ ...base, first_name: " " }).success).toBe(false);
  });
  it("rejects junk phone", () => {
    expect(profileSchema.safeParse({ ...base, phone: "call me" }).success).toBe(false);
  });
});

describe("documentMetaSchema", () => {
  it("rejects oversize and wrong types", () => {
    expect(documentMetaSchema.safeParse({ type: "passport", mime: "image/png", size: 11 * 1024 * 1024 }).success).toBe(false);
    expect(documentMetaSchema.safeParse({ type: "passport", mime: "text/plain", size: 10 }).success).toBe(false);
    expect(documentMetaSchema.safeParse({ type: "passport", mime: "application/pdf", size: 10 }).success).toBe(true);
  });
});
