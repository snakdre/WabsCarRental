import { describe, it, expect } from "vitest";
import { parseSettingInput, settingToInput, coerceSetting } from "./settings";

describe("parseSettingInput", () => {
  it("converts percent input to a fraction", () => {
    expect(parseSettingInput("tax_rate", "8.25")).toEqual({ ok: true, value: 0.0825 });
  });
  it("rejects out-of-range percent with a readable message", () => {
    expect(parseSettingInput("tax_rate", "45")).toEqual({ ok: false, error: "Sales tax rate must be between 0% and 30%" });
  });
  it("rejects non-numbers and blanks", () => {
    expect(parseSettingInput("min_driver_age", "abc").ok).toBe(false);
    expect(parseSettingInput("default_deposit", " ").ok).toBe(false);
  });
  it("enforces integer age bounds", () => {
    expect(parseSettingInput("min_driver_age", "21")).toEqual({ ok: true, value: 21 });
    expect(parseSettingInput("min_driver_age", "21.5").ok).toBe(false);
    expect(parseSettingInput("min_driver_age", "16").ok).toBe(false);
  });
  it("validates email and phone", () => {
    expect(parseSettingInput("business_email", "nope").ok).toBe(false);
    expect(parseSettingInput("business_phone", "+1 (310) 555-0100")).toEqual({ ok: true, value: "+1 (310) 555-0100" });
  });
});

describe("settingToInput / coerceSetting", () => {
  it("round-trips percent", () => {
    expect(settingToInput("tax_rate", 0.0825)).toBe("8.25");
  });
  it("falls back to defaults on bad stored values", () => {
    expect(coerceSetting("min_driver_age", "twenty")).toBe(25);
    expect(coerceSetting("tax_rate", 0.1)).toBe(0.1);
  });
});
