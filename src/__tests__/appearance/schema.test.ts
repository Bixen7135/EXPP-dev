import { describe, expect, it } from "vitest";
import { AppearancePayloadSchema } from "@/modules/appearance/schema";

describe("AppearancePayloadSchema", () => {
  it("accepts a full valid snapshot payload", () => {
    const payload = {
      mode: "SYSTEM",
      lightPreset: "DEFAULT",
      darkPreset: "DIMMED",
      singleThemeChoice: "DARK_SOFT",
      contrast: {
        enabled: true,
        light: false,
        dark: true,
      },
    };

    const parsed = AppearancePayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("accepts SINGLE_THEME payload when singleThemeChoice is present", () => {
    const payload = {
      mode: "SINGLE_THEME",
      lightPreset: "COLORBLIND",
      darkPreset: "DEFAULT",
      singleThemeChoice: "LIGHT_COLORBLIND",
      contrast: {
        enabled: true,
        light: false,
        dark: false,
      },
    };

    const parsed = AppearancePayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("rejects SINGLE_THEME payload without singleThemeChoice", () => {
    const payload = {
      mode: "SINGLE_THEME",
      lightPreset: "COLORBLIND",
      darkPreset: "DEFAULT",
      contrast: {
        enabled: true,
        light: false,
        dark: false,
      },
    };

    const parsed = AppearancePayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects payload with missing contrast object", () => {
    const payload = {
      mode: "SYSTEM",
      lightPreset: "COLORBLIND",
      darkPreset: "DEFAULT",
      singleThemeChoice: "LIGHT_COLORBLIND",
    };

    const parsed = AppearancePayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown presets", () => {
    const payload = {
      mode: "SYSTEM",
      lightPreset: "DEFAULT",
      darkPreset: "NEON",
      singleThemeChoice: "DARK_DEFAULT",
      contrast: {
        enabled: false,
        light: false,
        dark: false,
      },
    };

    const parsed = AppearancePayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});
