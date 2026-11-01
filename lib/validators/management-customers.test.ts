import { describe, it, expect } from "vitest";
import { parseCustomerListParams } from "./management-customers";

describe("parseCustomerListParams", () => {
  it("drops blank search and bad flags", () => {
    expect(parseCustomerListParams({ search: "  " })).toEqual({});
    expect(parseCustomerListParams({ flagged: "sometimes" })).toEqual({});
  });
  it("keeps valid values and takes first of arrays", () => {
    expect(parseCustomerListParams({ search: ["ada", "x"], flagged: "yes" })).toEqual({ search: "ada", flagged: "yes" });
  });
});
