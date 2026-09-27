import {
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
  type DarkThemePreset,
  type EffectiveAppearanceSettings,
  type EffectiveThemeMode,
  type LightThemePreset,
  type SingleThemeChoice,
  type ThemeMode,
} from "./types";

export type ThemeTokenMap = Record<string, string>;

type ColorScale = Record<string, string>;

function toTokenMap(colorFamily: string, scale: ColorScale): ThemeTokenMap {
  return Object.fromEntries(
    Object.entries(scale).map(([shade, value]) => [`--color-${colorFamily}-${shade}`, value])
  );
}

function reverseScale(scale: ColorScale): ColorScale {
  const keys = Object.keys(scale).sort((a, b) => Number(a) - Number(b));
  const values = keys.map((key) => scale[key]).reverse();
  return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
}

function mergeTokenMaps(...maps: ThemeTokenMap[]): ThemeTokenMap {
  return Object.assign({}, ...maps);
}

const SLATE_DARK_DEFAULT: ColorScale = {
  "50": "#f8fafc",
  "100": "#f1f5f9",
  "200": "#e2e8f0",
  "300": "#cad5e2",
  "400": "#90a1b9",
  "500": "#62748e",
  "600": "#45556c",
  "700": "#314158",
  "800": "#1d293d",
  "900": "#0f172b",
  "950": "#020618",
};

const SLATE_DARK_DIMMED: ColorScale = {
  "50": "#dde7f2",
  "100": "#cbd8eb",
  "200": "#adbed8",
  "300": "#90a5c3",
  "400": "#758cae",
  "500": "#5f7594",
  "600": "#4a5f79",
  "700": "#384b62",
  "800": "#24354b",
  "900": "#17263a",
  "950": "#0e1b2c",
};

const SLATE_LIGHT_DEFAULT = reverseScale(SLATE_DARK_DEFAULT);

const GRAY_DARK_DEFAULT: ColorScale = {
  "50": "#f9fafb",
  "100": "#f3f4f6",
  "200": "#e5e7eb",
  "300": "#d1d5dc",
  "400": "#99a1af",
  "500": "#6a7282",
  "600": "#4a5565",
  "700": "#364153",
  "800": "#1e2939",
  "900": "#101828",
};

const GRAY_LIGHT_DEFAULT = reverseScale(GRAY_DARK_DEFAULT);

const BLUE_DEFAULT: ColorScale = {
  "50": "#eff6ff",
  "100": "#dbeafe",
  "200": "#bedbff",
  "300": "#90c5ff",
  "400": "#54a2ff",
  "500": "#3080ff",
  "600": "#155dfc",
  "700": "#1447e6",
  "800": "#193cb8",
  "900": "#1c398e",
};

const BLUE_COLORBLIND: ColorScale = {
  "50": "#f0f9ff",
  "100": "#e0f2fe",
  "200": "#bae6fd",
  "300": "#7dd3fc",
  "400": "#38bdf8",
  "500": "#0ea5e9",
  "600": "#0284c7",
  "700": "#0369a1",
  "800": "#075985",
  "900": "#0c4a6e",
};

const BLUE_TRITANOPIA: ColorScale = {
  "50": "#f5f3ff",
  "100": "#ede9fe",
  "200": "#ddd6fe",
  "300": "#c4b5fd",
  "400": "#a78bfa",
  "500": "#8b5cf6",
  "600": "#7c3aed",
  "700": "#6d28d9",
  "800": "#5b21b6",
  "900": "#4c1d95",
};

const EMERALD_DEFAULT: ColorScale = {
  "100": "#d0fae5",
  "400": "#00d294",
  "500": "#00bb7f",
  "600": "#009767",
  "700": "#007956",
};

const EMERALD_COLORBLIND: ColorScale = {
  "100": "#dcfce7",
  "400": "#38bdf8",
  "500": "#0ea5e9",
  "600": "#0284c7",
  "700": "#0369a1",
};

const EMERALD_TRITANOPIA: ColorScale = {
  "100": "#ede9fe",
  "400": "#c084fc",
  "500": "#a855f7",
  "600": "#9333ea",
  "700": "#7e22ce",
};

const GREEN_DEFAULT: ColorScale = {
  "50": "#f0fdf4",
  "100": "#dcfce7",
  "200": "#b9f8cf",
  "300": "#7bf1a8",
  "500": "#00c758",
  "600": "#00a544",
  "700": "#008138",
  "800": "#016630",
};

const GREEN_COLORBLIND: ColorScale = {
  "50": "#ecfeff",
  "100": "#cffafe",
  "200": "#a5f3fc",
  "300": "#67e8f9",
  "500": "#06b6d4",
  "600": "#0891b2",
  "700": "#0e7490",
  "800": "#155e75",
};

const RED_DEFAULT: ColorScale = {
  "50": "#fef2f2",
  "100": "#ffe2e2",
  "200": "#ffcaca",
  "300": "#ffa3a3",
  "400": "#ff6568",
  "500": "#fb2c36",
  "600": "#e40014",
  "700": "#bf000f",
  "800": "#9f0712",
  "900": "#82181a",
  "950": "#460809",
};

const RED_COLORBLIND: ColorScale = {
  "50": "#fff7ed",
  "100": "#ffedd5",
  "200": "#fed7aa",
  "300": "#fdba74",
  "400": "#fb923c",
  "500": "#f97316",
  "600": "#ea580c",
  "700": "#c2410c",
  "800": "#9a3412",
  "900": "#7c2d12",
  "950": "#431407",
};

const RED_TRITANOPIA: ColorScale = {
  "50": "#fdf2f8",
  "100": "#fce7f3",
  "200": "#fbcfe8",
  "300": "#f9a8d4",
  "400": "#f472b6",
  "500": "#ec4899",
  "600": "#db2777",
  "700": "#be185d",
  "800": "#9d174d",
  "900": "#831843",
  "950": "#500724",
};

const AMBER_DEFAULT: ColorScale = {
  "50": "#fffbeb",
  "100": "#fef3c6",
  "200": "#fee685",
  "300": "#ffd236",
  "400": "#fcbb00",
  "500": "#f99c00",
  "600": "#dd7400",
  "700": "#b75000",
  "800": "#953d00",
};

const YELLOW_DEFAULT: ColorScale = {
  "50": "#fefce8",
  "100": "#fef9c2",
  "600": "#cd8900",
  "700": "#a36100",
  "800": "#874b00",
};

const YELLOW_TRITANOPIA: ColorScale = {
  "50": "#fff7ed",
  "100": "#ffedd5",
  "600": "#ea580c",
  "700": "#c2410c",
  "800": "#9a3412",
};

const INDIGO_DEFAULT: ColorScale = {
  "100": "#e0e7ff",
  "700": "#432dd7",
};

const INDIGO_TRITANOPIA: ColorScale = {
  "100": "#ede9fe",
  "700": "#6d28d9",
};

function accentMapDefault(): ThemeTokenMap {
  return mergeTokenMaps(
    toTokenMap("blue", BLUE_DEFAULT),
    toTokenMap("emerald", EMERALD_DEFAULT),
    toTokenMap("green", GREEN_DEFAULT),
    toTokenMap("red", RED_DEFAULT),
    toTokenMap("amber", AMBER_DEFAULT),
    toTokenMap("yellow", YELLOW_DEFAULT),
    toTokenMap("indigo", INDIGO_DEFAULT)
  );
}

function accentMapColorblind(): ThemeTokenMap {
  return mergeTokenMaps(
    toTokenMap("blue", BLUE_COLORBLIND),
    toTokenMap("emerald", EMERALD_COLORBLIND),
    toTokenMap("green", GREEN_COLORBLIND),
    toTokenMap("red", RED_COLORBLIND),
    toTokenMap("amber", AMBER_DEFAULT),
    toTokenMap("yellow", YELLOW_DEFAULT),
    toTokenMap("indigo", INDIGO_DEFAULT)
  );
}

function accentMapTritanopia(): ThemeTokenMap {
  return mergeTokenMaps(
    toTokenMap("blue", BLUE_TRITANOPIA),
    toTokenMap("emerald", EMERALD_TRITANOPIA),
    toTokenMap("green", GREEN_DEFAULT),
    toTokenMap("red", RED_TRITANOPIA),
    toTokenMap("amber", AMBER_DEFAULT),
    toTokenMap("yellow", YELLOW_TRITANOPIA),
    toTokenMap("indigo", INDIGO_TRITANOPIA)
  );
}

const DARK_THEME_TOKEN_MAPS: Record<DarkThemePreset, ThemeTokenMap> = {
  DEFAULT: mergeTokenMaps(
    toTokenMap("slate", SLATE_DARK_DEFAULT),
    toTokenMap("gray", GRAY_DARK_DEFAULT),
    accentMapDefault()
  ),
  DIMMED: mergeTokenMaps(
    toTokenMap("slate", SLATE_DARK_DIMMED),
    toTokenMap("gray", GRAY_DARK_DEFAULT),
    accentMapDefault()
  ),
  COLORBLIND: mergeTokenMaps(
    toTokenMap("slate", SLATE_DARK_DEFAULT),
    toTokenMap("gray", GRAY_DARK_DEFAULT),
    accentMapColorblind()
  ),
  TRITANOPIA: mergeTokenMaps(
    toTokenMap("slate", SLATE_DARK_DEFAULT),
    toTokenMap("gray", GRAY_DARK_DEFAULT),
    accentMapTritanopia()
  ),
};

const LIGHT_THEME_TOKEN_MAPS: Record<LightThemePreset, ThemeTokenMap> = {
  DEFAULT: mergeTokenMaps(
    toTokenMap("slate", SLATE_LIGHT_DEFAULT),
    toTokenMap("gray", GRAY_LIGHT_DEFAULT),
    accentMapDefault()
  ),
  COLORBLIND: mergeTokenMaps(
    toTokenMap("slate", SLATE_LIGHT_DEFAULT),
    toTokenMap("gray", GRAY_LIGHT_DEFAULT),
    accentMapColorblind()
  ),
  TRITANOPIA: mergeTokenMaps(
    toTokenMap("slate", SLATE_LIGHT_DEFAULT),
    toTokenMap("gray", GRAY_LIGHT_DEFAULT),
    accentMapTritanopia()
  ),
};

const HIGH_CONTRAST_OVERRIDES: Record<EffectiveThemeMode, ThemeTokenMap> = {
  LIGHT: mergeTokenMaps(
    toTokenMap("slate", {
      "50": "#111111",
      "100": "#000000",
      "200": "#0b0b0b",
      "300": "#1a1a1a",
      "400": "#3a3a3a",
      "500": "#5e5e5e",
      "600": "#8a8a8a",
      "700": "#bfbfbf",
      "800": "#e3e3e3",
      "900": "#f5f5f5",
      "950": "#ffffff",
    }),
    toTokenMap("blue", {
      "500": "#0052ff",
      "600": "#003dcc",
      "700": "#002b99",
    })
  ),
  DARK: mergeTokenMaps(
    toTokenMap("slate", {
      "50": "#ffffff",
      "100": "#ffffff",
      "200": "#f1f5f9",
      "300": "#dbe3ee",
      "400": "#a5b4c9",
      "500": "#7a8ea8",
      "600": "#5a6d86",
      "700": "#3c4f66",
      "800": "#1f2b3a",
      "900": "#0d1117",
      "950": "#000000",
    }),
    toTokenMap("blue", {
      "400": "#78a9ff",
      "500": "#4a86ff",
      "600": "#2d6bff",
    })
  ),
};

const LIGHT_PRESET_TO_SINGLE_THEME_CHOICE: Record<LightThemePreset, SingleThemeChoice> = {
  DEFAULT: "LIGHT_DEFAULT",
  COLORBLIND: "LIGHT_COLORBLIND",
  TRITANOPIA: "LIGHT_TRITANOPIA",
};

const DARK_PRESET_TO_SINGLE_THEME_CHOICE: Record<DarkThemePreset, SingleThemeChoice> = {
  DEFAULT: "DARK_DEFAULT",
  DIMMED: "DARK_SOFT",
  COLORBLIND: "DARK_COLORBLIND",
  TRITANOPIA: "DARK_TRITANOPIA",
};

export function mapSingleThemeChoiceToResolvedTheme(choice: SingleThemeChoice): {
  mode: EffectiveThemeMode;
  preset: LightThemePreset | DarkThemePreset;
} {
  switch (choice) {
    case "LIGHT_DEFAULT":
      return { mode: "LIGHT", preset: "DEFAULT" };
    case "LIGHT_COLORBLIND":
      return { mode: "LIGHT", preset: "COLORBLIND" };
    case "LIGHT_TRITANOPIA":
      return { mode: "LIGHT", preset: "TRITANOPIA" };
    case "DARK_DEFAULT":
      return { mode: "DARK", preset: "DEFAULT" };
    case "DARK_COLORBLIND":
      return { mode: "DARK", preset: "COLORBLIND" };
    case "DARK_TRITANOPIA":
      return { mode: "DARK", preset: "TRITANOPIA" };
    case "DARK_SOFT":
      return { mode: "DARK", preset: "DIMMED" };
    default:
      return { mode: "DARK", preset: "DEFAULT" };
  }
}

export function mapLightPresetToSingleThemeChoice(preset: LightThemePreset): SingleThemeChoice {
  return LIGHT_PRESET_TO_SINGLE_THEME_CHOICE[preset];
}

export function mapDarkPresetToSingleThemeChoice(preset: DarkThemePreset): SingleThemeChoice {
  return DARK_PRESET_TO_SINGLE_THEME_CHOICE[preset];
}

export function mapEffectiveThemeToSingleThemeChoice(
  mode: EffectiveThemeMode,
  preset: LightThemePreset | DarkThemePreset
): SingleThemeChoice {
  if (mode === "LIGHT") {
    return mapLightPresetToSingleThemeChoice(preset as LightThemePreset);
  }
  return mapDarkPresetToSingleThemeChoice(preset as DarkThemePreset);
}

export function syncPresetsFromSingleThemeChoice(
  choice: SingleThemeChoice,
  settings: Pick<AppearanceSettings, "lightPreset" | "darkPreset">
): Pick<AppearanceSettings, "lightPreset" | "darkPreset"> {
  const resolved = mapSingleThemeChoiceToResolvedTheme(choice);
  if (resolved.mode === "LIGHT") {
    return {
      lightPreset: resolved.preset as LightThemePreset,
      darkPreset: settings.darkPreset,
    };
  }
  return {
    lightPreset: settings.lightPreset,
    darkPreset: resolved.preset as DarkThemePreset,
  };
}

export function resolveEffectiveThemeMode(
  mode: ThemeMode,
  isSystemDark: boolean,
  singleThemeChoice: SingleThemeChoice = DEFAULT_APPEARANCE_SETTINGS.singleThemeChoice
): EffectiveThemeMode {
  if (mode === "LIGHT") return "LIGHT";
  if (mode === "DARK") return "DARK";
  if (mode === "SINGLE_THEME") {
    return mapSingleThemeChoiceToResolvedTheme(singleThemeChoice).mode;
  }
  return isSystemDark ? "DARK" : "LIGHT";
}

export function resolveEffectiveAppearance(
  settings: AppearanceSettings,
  isSystemDark: boolean
): EffectiveAppearanceSettings {
  const mode = resolveEffectiveThemeMode(settings.mode, isSystemDark, settings.singleThemeChoice);
  const preset =
    settings.mode === "SINGLE_THEME"
      ? mapSingleThemeChoiceToResolvedTheme(settings.singleThemeChoice).preset
      : mode === "LIGHT"
      ? settings.lightPreset
      : settings.darkPreset;
  const highContrast =
    settings.contrast.enabled &&
    (settings.mode === "SINGLE_THEME"
      ? true
      : mode === "LIGHT"
      ? settings.contrast.light
      : settings.contrast.dark);

  return { mode, preset, highContrast };
}

export function resolveThemeTokenMap(
  settings: AppearanceSettings,
  isSystemDark: boolean
): ThemeTokenMap {
  const effective = resolveEffectiveAppearance(settings, isSystemDark);
  const base =
    effective.mode === "LIGHT"
      ? LIGHT_THEME_TOKEN_MAPS[effective.preset as LightThemePreset]
      : DARK_THEME_TOKEN_MAPS[effective.preset as DarkThemePreset];

  if (!effective.highContrast) {
    return base;
  }

  return mergeTokenMaps(base, HIGH_CONTRAST_OVERRIDES[effective.mode]);
}

const tokenKeySet = new Set<string>();
for (const map of Object.values(DARK_THEME_TOKEN_MAPS)) {
  for (const key of Object.keys(map)) tokenKeySet.add(key);
}
for (const map of Object.values(LIGHT_THEME_TOKEN_MAPS)) {
  for (const key of Object.keys(map)) tokenKeySet.add(key);
}
for (const map of Object.values(HIGH_CONTRAST_OVERRIDES)) {
  for (const key of Object.keys(map)) tokenKeySet.add(key);
}

export const THEME_TOKEN_KEYS = Object.freeze([...tokenKeySet]);

export function normalizeAppearanceSettings(
  settings: Partial<AppearanceSettings> | null | undefined
): AppearanceSettings {
  if (!settings) {
    return DEFAULT_APPEARANCE_SETTINGS;
  }

  const mode = settings.mode ?? DEFAULT_APPEARANCE_SETTINGS.mode;
  const lightPreset = settings.lightPreset ?? DEFAULT_APPEARANCE_SETTINGS.lightPreset;
  const darkPreset = settings.darkPreset ?? DEFAULT_APPEARANCE_SETTINGS.darkPreset;

  if (mode === "LIGHT") {
    return {
      mode: "SINGLE_THEME",
      lightPreset,
      darkPreset,
      singleThemeChoice: mapLightPresetToSingleThemeChoice(lightPreset),
      contrast: {
        enabled: settings.contrast?.enabled ?? DEFAULT_APPEARANCE_SETTINGS.contrast.enabled,
        light: settings.contrast?.light ?? DEFAULT_APPEARANCE_SETTINGS.contrast.light,
        dark: settings.contrast?.dark ?? DEFAULT_APPEARANCE_SETTINGS.contrast.dark,
      },
    };
  }

  if (mode === "DARK") {
    return {
      mode: "SINGLE_THEME",
      lightPreset,
      darkPreset,
      singleThemeChoice: mapDarkPresetToSingleThemeChoice(darkPreset),
      contrast: {
        enabled: settings.contrast?.enabled ?? DEFAULT_APPEARANCE_SETTINGS.contrast.enabled,
        light: settings.contrast?.light ?? DEFAULT_APPEARANCE_SETTINGS.contrast.light,
        dark: settings.contrast?.dark ?? DEFAULT_APPEARANCE_SETTINGS.contrast.dark,
      },
    };
  }

  return {
    mode,
    lightPreset,
    darkPreset,
    singleThemeChoice:
      settings.singleThemeChoice ?? DEFAULT_APPEARANCE_SETTINGS.singleThemeChoice,
    contrast: {
      enabled: settings.contrast?.enabled ?? DEFAULT_APPEARANCE_SETTINGS.contrast.enabled,
      light: settings.contrast?.light ?? DEFAULT_APPEARANCE_SETTINGS.contrast.light,
      dark: settings.contrast?.dark ?? DEFAULT_APPEARANCE_SETTINGS.contrast.dark,
    },
  };
}
