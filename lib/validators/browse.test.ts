import { describe, it, expect } from "vitest";
import { parseBrowseParams, isDateFilterActive } from "./browse";

describe("parseBrowseParams", () => {
  it("returns an empty object when all inputs are missing", () => {
    expect(parseBrowseParams({})).toEqual({});
  });

  it("accepts a known category and sort", () => {
    const result = parseBrowseParams({ category: "exotic", sort: "price_asc" });
    expect(result).toEqual({ category: "exotic", sort: "price_asc" });
  });

  it("drops unknown categories silently", () => {
    const result = parseBrowseParams({ category: "spaceship" });
    expect(result.category).toBeUndefined();
  });

  it("accepts well-formed YYYY-MM-DD dates", () => {
    const result = parseBrowseParams({ pickup: "2026-10-10", return: "2026-10-15" });
    expect(result.pickup).toBe("2026-10-10");
    expect(result.return).toBe("2026-10-15");
  });

  it("rejects malformed dates (regex guard)", () => {
    const result = parseBrowseParams({ pickup: "10/10/2026", return: "2026-10-15" });
    expect(result.pickup).toBeUndefined();
    // The whole parse fails and returns {} — both dates get dropped.
    expect(result.return).toBeUndefined();
  });

  it("drops BOTH dates when return < pickup, but preserves category/sort", () => {
    const result = parseBrowseParams({
      category: "sports",
      sort: "price_desc",
      pickup: "2026-11-15",
      return: "2026-11-10",
    });
    expect(result).toEqual({ category: "sports", sort: "price_desc" });
  });

  it("picks the first array value when duplicate keys are passed", () => {
    const result = parseBrowseParams({ category: ["exotic", "sports"] });
    expect(result.category).toBe("exotic");
  });
});

describe("isDateFilterActive", () => {
  it("is true only when both dates are present", () => {
    expect(isDateFilterActive({ pickup: "2026-01-01", return: "2026-01-02" })).toBe(true);
  });

  it("is false when either date is missing", () => {
    expect(isDateFilterActive({ pickup: "2026-01-01" })).toBe(false);
    expect(isDateFilterActive({ return: "2026-01-02" })).toBe(false);
    expect(isDateFilterActive({})).toBe(false);
  });
});
