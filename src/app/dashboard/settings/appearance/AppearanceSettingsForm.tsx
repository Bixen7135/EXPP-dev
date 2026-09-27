"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  mapEffectiveThemeToSingleThemeChoice,
  resolveEffectiveThemeMode,
  syncPresetsFromSingleThemeChoice,
} from "@/modules/appearance/theme";
import {
  APPEARANCE_SETTINGS_EVENT,
  type AppearanceSettings,
  type DarkThemePreset,
  type LightThemePreset,
  type PrimaryThemeMode,
  type SingleThemeChoice,
} from "@/modules/appearance/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[20px] w-[20px]">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[20px] w-[20px]">
      <path
        d="M15.5 2.5A9.5 9.5 0 1 0 21.5 18 8 8 0 1 1 15.5 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

const LIGHT_PRESET_OPTIONS: Array<{
  value: LightThemePreset;
  label: string;
  swatch: string;
}> = [
  {
    value: "DEFAULT",
    label: "Light default",
    swatch: "linear-gradient(135deg, #ffffff 0%, #f4f6fb 100%)",
  },
  {
    value: "COLORBLIND",
    label: "Light colorblind",
    swatch: "conic-gradient(from 210deg, #ffffff 0deg, #0ea5e9 180deg, #f97316 320deg, #ffffff 360deg)",
  },
  {
    value: "TRITANOPIA",
    label: "Light tritanopia",
    swatch: "conic-gradient(from 210deg, #ffffff 0deg, #8b5cf6 180deg, #ec4899 320deg, #ffffff 360deg)",
  },
];

const DARK_PRESET_OPTIONS: Array<{
  value: DarkThemePreset;
  label: string;
  swatch: string;
}> = [
  {
    value: "DEFAULT",
    label: "Dark default",
    swatch: "linear-gradient(135deg, #0b1220 0%, #111b2e 100%)",
  },
  {
    value: "DIMMED",
    label: "Dark dimmed",
    swatch: "linear-gradient(135deg, #111b2d 0%, #1a2a44 100%)",
  },
  {
    value: "COLORBLIND",
    label: "Dark colorblind",
    swatch: "conic-gradient(from 210deg, #111827 0deg, #0ea5e9 170deg, #f97316 330deg, #111827 360deg)",
  },
  {
    value: "TRITANOPIA",
    label: "Dark tritanopia",
    swatch: "conic-gradient(from 210deg, #111827 0deg, #8b5cf6 170deg, #ec4899 330deg, #111827 360deg)",
  },
];

const SINGLE_THEME_CARDS: Array<{
  choice: SingleThemeChoice;
  title: string;
  description: string;
  mode: "LIGHT" | "DARK";
  beta?: boolean;
}> = [
  {
    choice: "LIGHT_DEFAULT",
    title: "Light default",
    description: "EXPP's standard light theme with full color contrast and brightness.",
    mode: "LIGHT",
  },
  {
    choice: "LIGHT_COLORBLIND",
    title: "Light protanopia and deuteranopia",
    description: "For people who may find it difficult to distinguish between reds and greens.",
    mode: "LIGHT",
    beta: true,
  },
  {
    choice: "LIGHT_TRITANOPIA",
    title: "Light tritanopia",
    description:
      "For people who find it difficult to distinguish between blues and greens, as well as warm and purple hues.",
    mode: "LIGHT",
    beta: true,
  },
  {
    choice: "DARK_DEFAULT",
    title: "Dark default",
    description: "EXPP's standard dark theme with full color contrast and brightness on a dark background.",
    mode: "DARK",
  },
  {
    choice: "DARK_COLORBLIND",
    title: "Dark protanopia and deuteranopia",
    description:
      "For people who may find it difficult to distinguish between reds and greens, with a dark background.",
    mode: "DARK",
    beta: true,
  },
  {
    choice: "DARK_TRITANOPIA",
    title: "Dark tritanopia",
    description:
      "For people who find it difficult to distinguish between blues and greens, as well as warm and purple hues, with a dark background.",
    mode: "DARK",
    beta: true,
  },
  {
    choice: "DARK_SOFT",
    title: "Soft dark",
    description: "A dark theme with reduced contrast for comfortable viewing in low-light environments.",
    mode: "DARK",
  },
];

function deepEqual(a: AppearanceSettings, b: AppearanceSettings): boolean {
  return (
    a.mode === b.mode &&
    a.lightPreset === b.lightPreset &&
    a.darkPreset === b.darkPreset &&
    a.singleThemeChoice === b.singleThemeChoice &&
    a.contrast.enabled === b.contrast.enabled &&
    a.contrast.light === b.contrast.light &&
    a.contrast.dark === b.contrast.dark
  );
}

function Toggle({
  checked,
  onToggle,
  disabled = false,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex h-[40px] items-center gap-[12px] text-[14px] text-slate-100 disabled:opacity-50"
    >
      <span>{checked ? "On" : "Off"}</span>
      <span
        className={`relative inline-flex h-[34px] w-[74px] items-center rounded-full border transition-colors ${
          checked
            ? "border-blue-500/80 bg-blue-600/30"
            : "border-slate-700 bg-slate-900/70"
        }`}
      >
        <span
          className={`absolute top-1 h-[26px] w-[26px] rounded-[8px] border transition-all ${
            checked
              ? "left-[42px] border-blue-400 bg-blue-500"
              : "left-1 border-slate-600 bg-slate-800"
          }`}
        />
      </span>
    </button>
  );
}

function ThemePreviewCard({
  mode,
  title,
  description,
  active,
  presetLabel,
  options,
  selected,
  onSelect,
}: {
  mode: "LIGHT" | "DARK";
  title: string;
  description: string;
  active: boolean;
  presetLabel: string;
  options: Array<{ value: string; label: string; swatch: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  const isDark = mode === "DARK";

  return (
    <article
      className={`overflow-hidden rounded-[12px] border ${
        active ? "border-blue-500/90 bg-blue-900/20" : "border-slate-700/80 bg-slate-900/40"
      }`}
    >
      <div className="flex w-full items-center justify-between border-b border-slate-700/80 px-[22px] py-[18px]">
        <span className="text-slate-200">{isDark ? <MoonIcon /> : <SunIcon />}</span>
        <div className="min-w-0 flex-1 pl-[12px]">
          <p className="text-[14px] font-semibold leading-none text-slate-100">{title}</p>
        </div>
        {active ? (
          <span className="inline-flex h-[30px] items-center rounded-full border border-blue-500/70 px-[12px] text-[14px] text-blue-300">
            Active
          </span>
        ) : null}
      </div>

      <div className="px-[22px] py-[18px]">
        <p className="text-[14px] leading-[24px] text-slate-400">{description}</p>

        <div
          className={`mt-[16px] overflow-hidden rounded-[10px] border ${
            isDark ? "border-slate-700 bg-slate-900" : "border-slate-700 bg-slate-100"
          }`}
        >
          <div
            className={`h-[52px] border-b ${
              isDark ? "border-slate-700 bg-slate-700/40" : "border-slate-300 bg-slate-200/80"
            }`}
          >
            <div className="flex h-full items-center gap-[18px] px-[18px]">
              <span
                className={`h-[12px] w-[78px] rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`}
              />
              <span
                className={`h-[12px] w-[78px] rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`}
              />
              <span
                className={`h-[12px] w-[78px] rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`}
              />
            </div>
          </div>
          <div className="h-[165px] px-[18px] py-[16px]">
            <span
              className={`block h-[12px] w-[112px] rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`}
            />
            <div className={`mt-[16px] rounded-[6px] ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
              <div
                className={`h-[28px] rounded-t-[6px] ${
                  isDark ? "bg-green-900/50" : "bg-green-600/30"
                } px-[12px] py-[8px]`}
              >
                <span className="block h-[12px] w-[62%] rounded-full bg-green-500" />
              </div>
              <div className={`h-[70px] rounded-b-[6px] ${isDark ? "bg-slate-700/70" : "bg-slate-100"}`} />
            </div>
          </div>
          <div className="border-t border-slate-700/80 px-[18px] py-[12px] text-[20px] font-semibold leading-none text-slate-100">
            {presetLabel}
          </div>
        </div>

        <div className="mt-[16px] flex flex-wrap gap-[10px]">
          {options.map((option) => {
            const isSelected = option.value === selected;
            return (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={() => onSelect(option.value)}
                className={`relative h-[44px] w-[44px] rounded-full border p-[3px] transition-transform hover:scale-[1.04] ${
                  isSelected ? "border-blue-500" : "border-slate-600"
                }`}
              >
                <span
                  className="block h-full w-full rounded-full border border-slate-500"
                  style={{ background: option.swatch }}
                />
                {isSelected ? (
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-blue-400/70" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function getSingleThemePreviewStyle(choice: SingleThemeChoice) {
  if (choice === "LIGHT_COLORBLIND" || choice === "DARK_COLORBLIND") {
    return {
      topBar: "bg-blue-600/35",
      progress: "bg-blue-500",
      chipA: "bg-blue-500",
      chipB: "bg-violet-400",
    };
  }
  if (choice === "LIGHT_TRITANOPIA" || choice === "DARK_TRITANOPIA") {
    return {
      topBar: "bg-red-600/35",
      progress: "bg-red-500",
      chipA: "bg-blue-500",
      chipB: "bg-red-400",
    };
  }
  return {
    topBar: "bg-green-700/35",
    progress: "bg-green-500",
    chipA: "bg-green-500",
    chipB: "bg-red-500",
  };
}

function SingleThemeCard({
  choice,
  title,
  description,
  mode,
  beta = false,
  selected,
  onSelect,
}: {
  choice: SingleThemeChoice;
  title: string;
  description: string;
  mode: "LIGHT" | "DARK";
  beta?: boolean;
  selected: boolean;
  onSelect: (choice: SingleThemeChoice) => void;
}) {
  const isDark = mode === "DARK";
  const preview = getSingleThemePreviewStyle(choice);

  return (
    <button
      type="button"
      onClick={() => onSelect(choice)}
      className={`overflow-hidden rounded-[10px] border text-left transition ${
        selected
          ? "border-blue-500 bg-blue-950/20"
          : "border-slate-700/80 bg-slate-900/40 hover:border-slate-500"
      }`}
    >
      <div
        className={`relative border-b ${
          isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-slate-100"
        }`}
      >
        {beta ? (
          <span className="absolute right-[10px] top-[10px] z-10 rounded-full border border-blue-500 px-[10px] py-[2px] text-[12px] text-blue-300">
            Beta
          </span>
        ) : null}

        <div
          className={`h-[58px] border-b ${
            isDark ? "border-slate-700 bg-slate-700/40" : "border-slate-300 bg-slate-200/80"
          }`}
        >
          <div className="flex h-full items-center gap-[14px] px-[16px]">
            <span className={`h-[10px] w-[54px] rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
            <span className={`h-[10px] w-[54px] rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
            <span className={`h-[10px] w-[54px] rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
          </div>
        </div>

        <div className="px-[16px] py-[12px]">
          <div className="flex items-center justify-between">
            <span className={`h-[10px] w-[82px] rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`} />
            <div className="flex items-center gap-[6px]">
              <span className={`h-[14px] w-[14px] rounded-[3px] ${preview.chipA}`} />
              <span className={`h-[14px] w-[14px] rounded-[3px] ${preview.chipB}`} />
            </div>
          </div>

          <div className={`mt-[14px] rounded-[6px] ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
            <div className={`h-[26px] rounded-t-[6px] ${preview.topBar} px-[10px] py-[7px]`}>
              <span className={`block h-[11px] w-[50%] rounded-full ${preview.progress}`} />
            </div>
            <div className={`h-[84px] rounded-b-[6px] ${isDark ? "bg-slate-700/70" : "bg-slate-100"}`} />
          </div>
        </div>
      </div>

      <div className="px-[14px] py-[12px]">
        <div className="flex items-start gap-[10px]">
          <span
            className={`mt-[4px] h-[18px] w-[18px] rounded-full border ${
              selected ? "border-blue-400 ring-2 ring-blue-400/70" : "border-slate-500"
            }`}
          />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-[22px] text-slate-100">{title}</p>
            <p className="pt-[6px] text-[12px] leading-[24px] text-slate-400">{description}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

export function AppearanceSettingsForm({
  initialSettings,
}: {
  initialSettings: AppearanceSettings;
}) {
  const normalizedInitialSettings = useMemo(() => initialSettings, [initialSettings]);
  const [settings, setSettings] = useState<AppearanceSettings>(normalizedInitialSettings);
  const [savedSettings, setSavedSettings] = useState<AppearanceSettings>(normalizedInitialSettings);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSystemDark, setIsSystemDark] = useState(false);
  const saveRequestRef = useRef(0);

  const effectiveMode = resolveEffectiveThemeMode(
    settings.mode,
    isSystemDark,
    settings.singleThemeChoice
  );

  useEffect(() => {
    setSettings(normalizedInitialSettings);
    setSavedSettings(normalizedInitialSettings);
    setSaveStatus("idle");
    setSaveError(null);
  }, [normalizedInitialSettings]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsSystemDark(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => {
      setIsSystemDark(event.matches);
    };
    mediaQuery.addEventListener("change", listener);
    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<AppearanceSettings>(APPEARANCE_SETTINGS_EVENT, {
        detail: settings,
      })
    );
  }, [settings]);

  useEffect(() => {
    if (deepEqual(settings, savedSettings)) {
      if (saveStatus === "saved") {
        const idleTimer = window.setTimeout(() => setSaveStatus("idle"), 1200);
        return () => window.clearTimeout(idleTimer);
      }
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);
    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/appearance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });

        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: AppearanceSettings; error?: string }
          | null;

        if (!response.ok || payload?.success !== true || !payload.data) {
          throw new Error(payload?.error ?? "Failed to save appearance settings");
        }

        if (saveRequestRef.current !== requestId) {
          return;
        }

        setSavedSettings(payload.data);
        setSettings((current) => (deepEqual(current, payload.data!) ? current : payload.data!));
        setSaveStatus("saved");
      } catch (error) {
        if (saveRequestRef.current !== requestId) {
          return;
        }
        setSaveStatus("error");
        setSaveError(error instanceof Error ? error.message : "Failed to save appearance settings");
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [settings, savedSettings, saveStatus]);

  function updateMode(mode: PrimaryThemeMode) {
    setSettings((current) => {
      if (mode === "SYSTEM") {
        return {
          ...current,
          mode: "SYSTEM",
        };
      }

      if (current.mode === "SINGLE_THEME") {
        return current;
      }

      const currentEffectiveMode = resolveEffectiveThemeMode(
        current.mode,
        isSystemDark,
        current.singleThemeChoice
      );
      const currentEffectivePreset =
        currentEffectiveMode === "LIGHT" ? current.lightPreset : current.darkPreset;
      const fallbackChoice = mapEffectiveThemeToSingleThemeChoice(
        currentEffectiveMode,
        currentEffectivePreset
      );
      const syncedPresets = syncPresetsFromSingleThemeChoice(fallbackChoice, current);

      return {
        ...current,
        mode: "SINGLE_THEME",
        singleThemeChoice: fallbackChoice,
        ...syncedPresets,
      };
    });
  }

  function updateLightPreset(preset: LightThemePreset) {
    setSettings((current) => ({ ...current, lightPreset: preset }));
  }

  function updateDarkPreset(preset: DarkThemePreset) {
    setSettings((current) => ({ ...current, darkPreset: preset }));
  }

  function selectSingleTheme(choice: SingleThemeChoice) {
    setSettings((current) => {
      const syncedPresets = syncPresetsFromSingleThemeChoice(choice, current);
      return {
        ...current,
        mode: "SINGLE_THEME",
        singleThemeChoice: choice,
        ...syncedPresets,
      };
    });
  }

  function updateContrast(patch: Partial<AppearanceSettings["contrast"]>) {
    setSettings((current) => ({
      ...current,
      contrast: {
        ...current.contrast,
        ...patch,
      },
    }));
  }

  function handleModeContrastToggle(mode: "light" | "dark") {
    setSettings((current) => {
      if (!current.contrast.enabled) {
        return {
          ...current,
          contrast: {
            ...current.contrast,
            enabled: true,
          },
        };
      }

      return {
        ...current,
        contrast: {
          ...current.contrast,
          [mode]: !current.contrast[mode],
        },
      };
    });
  }

  const saveLabel =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "saved"
      ? "Saved"
      : saveStatus === "error"
      ? "Save failed"
      : "";

  const lightPresetLabel =
    LIGHT_PRESET_OPTIONS.find((item) => item.value === settings.lightPreset)?.label ?? "Light default";
  const darkPresetLabel =
    DARK_PRESET_OPTIONS.find((item) => item.value === settings.darkPreset)?.label ?? "Dark default";
  const isSingleThemeMode = settings.mode === "SINGLE_THEME";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <h2 className="text-[24px] font-semibold leading-none text-slate-100">Theme preferences</h2>
        {saveLabel ? (
          <p
            className={`text-[14px] ${
              saveStatus === "error" ? "text-red-300" : "text-slate-400"
            }`}
          >
            {saveLabel}
          </p>
        ) : null}
      </div>
      <div className="mt-[14px] border-t border-slate-800/90" />

      <p className="pt-[20px] text-[15px] leading-[32px] text-slate-200">
        Choose how EXPP looks to you. Select a single theme, or sync with your system and
        automatically switch between day and night themes. Selections are applied immediately and
        saved automatically.
      </p>
      {saveError ? <p className="pt-[8px] text-[14px] text-red-300">{saveError}</p> : null}

      <section className="mt-[18px]">
        <h3 className="text-[24px] font-semibold leading-none text-slate-100">Theme mode</h3>
        <div className="mt-[12px] flex flex-wrap items-center gap-[12px]">
          <select
            value={isSingleThemeMode ? "SINGLE_THEME" : "SYSTEM"}
            onChange={(event) => updateMode(event.target.value as PrimaryThemeMode)}
            className="h-[44px] rounded-[10px] border border-slate-700 bg-slate-900/70 px-[16px] text-[16px] text-slate-100 focus:border-slate-500 focus:outline-none"
          >
            <option value="SYSTEM">Sync with system</option>
            <option value="SINGLE_THEME">Single theme</option>
          </select>
          <p className="text-[14px] leading-none text-slate-400">
            {isSingleThemeMode
              ? "EXPP will use your selected theme."
              : "Theme follows your system settings when mode is set to sync."}
          </p>
        </div>
      </section>

      {!isSingleThemeMode ? (
        <section className="mt-[22px] grid gap-[20px] xl:grid-cols-2">
          <ThemePreviewCard
            mode="LIGHT"
            title="Light theme"
            description='This theme will be active when your system is set to "light mode".'
            active={effectiveMode === "LIGHT"}
            presetLabel={lightPresetLabel}
            options={LIGHT_PRESET_OPTIONS}
            selected={settings.lightPreset}
            onSelect={(value) => updateLightPreset(value as LightThemePreset)}
          />

          <ThemePreviewCard
            mode="DARK"
            title="Dark theme"
            description='This theme will be active when your system is set to "dark mode".'
            active={effectiveMode === "DARK"}
            presetLabel={darkPresetLabel}
            options={DARK_PRESET_OPTIONS}
            selected={settings.darkPreset}
            onSelect={(value) => updateDarkPreset(value as DarkThemePreset)}
          />
        </section>
      ) : (
        <section className="mt-[22px] grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
          {SINGLE_THEME_CARDS.map((card) => (
            <SingleThemeCard
              key={card.choice}
              choice={card.choice}
              title={card.title}
              description={card.description}
              mode={card.mode}
              beta={card.beta}
              selected={settings.singleThemeChoice === card.choice}
              onSelect={selectSingleTheme}
            />
          ))}
        </section>
      )}

      <section className="mt-[24px]">
        <h3 className="text-[24px] font-semibold leading-none text-slate-100">Contrast</h3>
        <div className="mt-[14px] overflow-hidden rounded-[12px] border border-slate-700/80 bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-[12px] px-[20px] py-[18px]">
            <div>
              <p className="text-[18px] font-semibold leading-none text-slate-100">Increase contrast</p>
              <p className="pt-[10px] text-[15px] leading-[28px] text-slate-400">
                Enable high contrast for light or dark mode (or both) based on your system settings.
              </p>
            </div>
            <Toggle
              checked={settings.contrast.enabled}
              onToggle={() => updateContrast({ enabled: !settings.contrast.enabled })}
              label="Toggle increased contrast"
            />
          </div>

          {!isSingleThemeMode ? (
            <>
              <div className="border-t border-slate-700/80" />

              <div className="flex flex-wrap items-center justify-between gap-[12px] px-[20px] py-[16px]">
                <p className="text-[18px] font-semibold leading-none text-slate-100">Light mode</p>
                <Toggle
                  checked={settings.contrast.light}
                  onToggle={() => handleModeContrastToggle("light")}
                  label="Toggle light mode high contrast"
                />
              </div>

              <div className="border-t border-slate-700/80" />

              <div className="flex flex-wrap items-center justify-between gap-[12px] px-[20px] py-[16px]">
                <p className="text-[18px] font-semibold leading-none text-slate-100">Dark mode</p>
                <Toggle
                  checked={settings.contrast.dark}
                  onToggle={() => handleModeContrastToggle("dark")}
                  label="Toggle dark mode high contrast"
                />
              </div>
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}
