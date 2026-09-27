export const THEME_MODES = ["SYSTEM", "LIGHT", "DARK", "SINGLE_THEME"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const PRIMARY_THEME_MODES = ["SYSTEM", "SINGLE_THEME"] as const;
export type PrimaryThemeMode = (typeof PRIMARY_THEME_MODES)[number];

export const LIGHT_THEME_PRESETS = ["DEFAULT", "COLORBLIND", "TRITANOPIA"] as const;
export type LightThemePreset = (typeof LIGHT_THEME_PRESETS)[number];

export const DARK_THEME_PRESETS = ["DEFAULT", "DIMMED", "COLORBLIND", "TRITANOPIA"] as const;
export type DarkThemePreset = (typeof DARK_THEME_PRESETS)[number];

export const SINGLE_THEME_CHOICES = [
  "LIGHT_DEFAULT",
  "LIGHT_COLORBLIND",
  "LIGHT_TRITANOPIA",
  "DARK_DEFAULT",
  "DARK_COLORBLIND",
  "DARK_TRITANOPIA",
  "DARK_SOFT",
] as const;
export type SingleThemeChoice = (typeof SINGLE_THEME_CHOICES)[number];

export interface AppearanceContrastSettings {
  enabled: boolean;
  light: boolean;
  dark: boolean;
}

export interface AppearanceSettings {
  mode: ThemeMode;
  lightPreset: LightThemePreset;
  darkPreset: DarkThemePreset;
  singleThemeChoice: SingleThemeChoice;
  contrast: AppearanceContrastSettings;
}

export type EffectiveThemeMode = "LIGHT" | "DARK";

export interface EffectiveAppearanceSettings {
  mode: EffectiveThemeMode;
  preset: LightThemePreset | DarkThemePreset;
  highContrast: boolean;
}

export const APPEARANCE_SETTINGS_EVENT = "appearance:settings-changed";

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  mode: "SYSTEM",
  lightPreset: "DEFAULT",
  darkPreset: "DEFAULT",
  singleThemeChoice: "DARK_DEFAULT",
  contrast: {
    enabled: false,
    light: false,
    dark: false,
  },
};
