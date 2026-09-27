import { describe, expect, it } from "vitest";
import { resolveEffectiveAppearance, resolveEffectiveThemeMode, resolveThemeTokenMap } from "@/modules/appearance/theme";
import { DEFAULT_APPEARANCE_SETTINGS, type AppearanceSettings } from "@/modules/appearance/types";

describe("resolveEffectiveThemeMode", () => {
  it("follows system when mode is SYSTEM", () => {
    expect(resolveEffectiveThemeMode("SYSTEM", true)).toBe("DARK");
    expect(resolveEffectiveThemeMode("SYSTEM", false)).toBe("LIGHT");
  });

  it("ignores system scheme in SINGLE_THEME mode", () => {
    expect(resolveEffectiveThemeMode("SINGLE_THEME", true, "LIGHT_TRITANOPIA")).toBe("LIGHT");
    expect(resolveEffectiveThemeMode("SINGLE_THEME", false, "LIGHT_TRITANOPIA")).toBe("LIGHT");
    expect(resolveEffectiveThemeMode("SINGLE_THEME", true, "DARK_SOFT")).toBe("DARK");
    expect(resolveEffectiveThemeMode("SINGLE_THEME", false, "DARK_SOFT")).toBe("DARK");
  });

  it("keeps legacy LIGHT/DARK behavior for compatibility", () => {
    expect(resolveEffectiveThemeMode("LIGHT", true)).toBe("LIGHT");
    expect(resolveEffectiveThemeMode("DARK", false)).toBe("DARK");
  });
});

describe("resolveEffectiveAppearance", () => {
  it("in SYSTEM mode enables high contrast only for the active effective mode", () => {
    const settings: AppearanceSettings = {
      mode: "SYSTEM",
      lightPreset: "DEFAULT",
      darkPreset: "DEFAULT",
      singleThemeChoice: "DARK_DEFAULT",
      contrast: { enabled: true, light: true, dark: false },
    };

    const asLight = resolveEffectiveAppearance(settings, false);
    expect(asLight.mode).toBe("LIGHT");
    expect(asLight.highContrast).toBe(true);

    const asDark = resolveEffectiveAppearance(settings, true);
    expect(asDark.mode).toBe("DARK");
    expect(asDark.highContrast).toBe(false);
  });

  it("in SINGLE_THEME mode uses master contrast toggle only", () => {
    const settings: AppearanceSettings = {
      mode: "SINGLE_THEME",
      lightPreset: "DEFAULT",
      darkPreset: "DEFAULT",
      singleThemeChoice: "LIGHT_COLORBLIND",
      contrast: { enabled: true, light: false, dark: false },
    };

    const asLight = resolveEffectiveAppearance(settings, true);
    expect(asLight.mode).toBe("LIGHT");
    expect(asLight.preset).toBe("COLORBLIND");
    expect(asLight.highContrast).toBe(true);
  });
});

describe("resolveThemeTokenMap", () => {
  it("returns different slate roots for light and dark effective mode", () => {
    const lightTokens = resolveThemeTokenMap(
      { ...DEFAULT_APPEARANCE_SETTINGS, mode: "SINGLE_THEME", singleThemeChoice: "LIGHT_DEFAULT" },
      true
    );
    const darkTokens = resolveThemeTokenMap(
      { ...DEFAULT_APPEARANCE_SETTINGS, mode: "SINGLE_THEME", singleThemeChoice: "DARK_DEFAULT" },
      false
    );

    expect(lightTokens["--color-slate-950"]).not.toEqual(darkTokens["--color-slate-950"]);
  });

  it("changes accent tokens for accessibility presets", () => {
    const defaultTokens = resolveThemeTokenMap(
      { ...DEFAULT_APPEARANCE_SETTINGS, mode: "SINGLE_THEME", singleThemeChoice: "LIGHT_DEFAULT" },
      false
    );
    const colorblindTokens = resolveThemeTokenMap(
      { ...DEFAULT_APPEARANCE_SETTINGS, mode: "SINGLE_THEME", singleThemeChoice: "LIGHT_COLORBLIND" },
      false
    );

    expect(defaultTokens["--color-blue-500"]).not.toEqual(colorblindTokens["--color-blue-500"]);
  });
});
