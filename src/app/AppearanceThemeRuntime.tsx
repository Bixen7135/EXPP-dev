"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  normalizeAppearanceSettings,
  resolveEffectiveAppearance,
  resolveThemeTokenMap,
  THEME_TOKEN_KEYS,
} from "@/modules/appearance/theme";
import {
  APPEARANCE_SETTINGS_EVENT,
  type AppearanceSettings,
} from "@/modules/appearance/types";

const SYSTEM_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function getSystemDarkPreference(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(SYSTEM_COLOR_SCHEME_QUERY).matches;
}

function applyThemeTokens(settings: AppearanceSettings, isSystemDark: boolean): void {
  const root = document.documentElement;
  const effective = resolveEffectiveAppearance(settings, isSystemDark);
  const tokenMap = resolveThemeTokenMap(settings, isSystemDark);

  for (const key of THEME_TOKEN_KEYS) {
    const value = tokenMap[key];
    if (value) {
      root.style.setProperty(key, value);
    } else {
      root.style.removeProperty(key);
    }
  }

  root.dataset.themeMode = effective.mode.toLowerCase();
  root.dataset.themePreset = effective.preset.toLowerCase();
  root.dataset.themeContrast = effective.highContrast ? "high" : "normal";
  root.classList.toggle("dark", effective.mode === "DARK");
  root.style.colorScheme = effective.mode === "DARK" ? "dark" : "light";
}

export default function AppearanceThemeRuntime({
  initialSettings,
}: {
  initialSettings?: AppearanceSettings | null;
}) {
  const normalizedInitialSettings = useMemo(
    () => normalizeAppearanceSettings(initialSettings),
    [initialSettings]
  );

  const [settings, setSettings] = useState<AppearanceSettings>(normalizedInitialSettings);
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() => getSystemDarkPreference());

  useEffect(() => {
    setSettings(normalizedInitialSettings);
  }, [normalizedInitialSettings]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(SYSTEM_COLOR_SCHEME_QUERY);
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
    const handleAppearanceUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<AppearanceSettings>;
      setSettings(normalizeAppearanceSettings(customEvent.detail));
    };

    window.addEventListener(APPEARANCE_SETTINGS_EVENT, handleAppearanceUpdate as EventListener);
    return () => {
      window.removeEventListener(APPEARANCE_SETTINGS_EVENT, handleAppearanceUpdate as EventListener);
    };
  }, []);

  useLayoutEffect(() => {
    applyThemeTokens(settings, isSystemDark);
  }, [settings, isSystemDark]);

  return null;
}
