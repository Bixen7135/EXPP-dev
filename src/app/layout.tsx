import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import AppearanceThemeRuntime from "./AppearanceThemeRuntime";
import { resolveSession } from "@/lib/auth/session";
import { getAppearanceSettingsForAccountOrDefault } from "@/modules/appearance/service";
import {
  normalizeAppearanceSettings,
  resolveEffectiveAppearance,
  resolveThemeTokenMap,
} from "@/modules/appearance/theme";
import type { AppearanceSettings } from "@/modules/appearance/types";

export const metadata: Metadata = {
  title: "EXPP",
  description: "EXPP platform for schools, teachers, and students.",
};

function buildAppearanceBootstrapScript(settings: AppearanceSettings): string {
  const payload = {
    light: {
      effective: resolveEffectiveAppearance(settings, false),
      tokenMap: resolveThemeTokenMap(settings, false),
    },
    dark: {
      effective: resolveEffectiveAppearance(settings, true),
      tokenMap: resolveThemeTokenMap(settings, true),
    },
  };

  const serializedPayload = JSON.stringify(payload).replace(/</g, "\\u003c");

  return `(() => {
    const payload = ${serializedPayload};
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const selected = prefersDark ? payload.dark : payload.light;
    if (!selected) return;

    const root = document.documentElement;
    const tokenMap = selected.tokenMap || {};
    for (const [key, value] of Object.entries(tokenMap)) {
      if (typeof value === "string" && value.length > 0) {
        root.style.setProperty(key, value);
      }
    }

    const effective = selected.effective || {};
    root.dataset.themeMode =
      typeof effective.mode === "string" ? effective.mode.toLowerCase() : "light";
    root.dataset.themePreset =
      typeof effective.preset === "string" ? effective.preset.toLowerCase() : "default";
    root.dataset.themeContrast = effective.highContrast ? "high" : "normal";
    root.style.colorScheme = effective.mode === "DARK" ? "dark" : "light";
  })();`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await resolveSession().catch(() => null);
  const appearanceSettings = await getAppearanceSettingsForAccountOrDefault(session?.id).catch(() =>
    null
  );
  const normalizedAppearanceSettings = normalizeAppearanceSettings(appearanceSettings);
  const appearanceBootstrapScript = buildAppearanceBootstrapScript(normalizedAppearanceSettings);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: appearanceBootstrapScript,
          }}
        />
      </head>
      <body>
        <AppearanceThemeRuntime initialSettings={normalizedAppearanceSettings} />
        {children}
      </body>
    </html>
  );
}
