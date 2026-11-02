import { describe, it, expect } from "vitest";
import { parseCustomerListParams, customersHref } from "./management-customers";

describe("parseCustomerListParams", () => {
  it("drops blank search and bad flags", () => {
    expect(parseCustomerListParams({ search: "  " })).toEqual({});
    expect(parseCustomerListParams({ flagged: "sometimes" })).toEqual({});
  });
  it("keeps valid values and takes first of arrays", () => {
    expect(parseCustomerListParams({ search: ["ada", "x"], flagged: "yes" })).toEqual({ search: "ada", flagged: "yes" });
  });
});

describe("pagination params", () => {
  it("parses page, ignores page 1 and junk without dropping other filters", () => {
    expect(parseCustomerListParams({ page: "3", search: "ada" })).toEqual({ page: 3, search: "ada" });
    expect(parseCustomerListParams({ page: "1" })).toEqual({});
    expect(parseCustomerListParams({ page: "abc", search: "ada" })).toEqual({ search: "ada" });
    expect(parseCustomerListParams({ page: "-2", flagged: "yes" })).toEqual({ flagged: "yes" });
  });
  it("builds hrefs that keep filters", () => {
    expect(customersHref({ search: "ada", flagged: "yes" }, { page: 2 })).toBe("/management/customers?search=ada&flagged=yes&page=2");
    expect(customersHref({ search: "ada", page: 4 }, { page: 1 })).toBe("/management/customers?search=ada");
  });
});
