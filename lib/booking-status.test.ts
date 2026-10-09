import { describe, it, expect } from "vitest";
import {
  canTransition,
  nextStatusesFor,
  isBookingStatus,
  DESTRUCTIVE_TRANSITIONS,
} from "./booking-status";

describe("canTransition", () => {
  it("allows pending -> confirmed", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
  });

  it("rejects pending -> completed (not a legal single hop)", () => {
    expect(canTransition("pending", "completed")).toBe(false);
  });

  it("blocks any transition out of a terminal state", () => {
    const terminals = ["completed", "cancelled", "rejected", "refunded"] as const;
    for (const t of terminals) {
      expect(nextStatusesFor(t)).toEqual([]);
      expect(canTransition(t, "pending")).toBe(false);
    }
  });

  it("allows refund from confirmed, ready_for_pickup, and active", () => {
    expect(canTransition("confirmed", "refunded")).toBe(true);
    expect(canTransition("ready_for_pickup", "refunded")).toBe(true);
    expect(canTransition("active", "refunded")).toBe(true);
  });

  it("does NOT allow refund directly from pending", () => {
    expect(canTransition("pending", "refunded")).toBe(false);
  });
});

describe("isBookingStatus", () => {
  it("accepts known statuses", () => {
    expect(isBookingStatus("confirmed")).toBe(true);
    expect(isBookingStatus("refunded")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isBookingStatus("archived")).toBe(false);
    expect(isBookingStatus("")).toBe(false);
  });
});

describe("DESTRUCTIVE_TRANSITIONS", () => {
  it("flags cancel / reject / refund as destructive", () => {
    expect(DESTRUCTIVE_TRANSITIONS.has("cancelled")).toBe(true);
    expect(DESTRUCTIVE_TRANSITIONS.has("rejected")).toBe(true);
    expect(DESTRUCTIVE_TRANSITIONS.has("refunded")).toBe(true);
  });

  it("does NOT flag normal forward transitions", () => {
    expect(DESTRUCTIVE_TRANSITIONS.has("confirmed")).toBe(false);
    expect(DESTRUCTIVE_TRANSITIONS.has("active")).toBe(false);
  });
});
