import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import type { AppearancePayloadInput } from "./schema";
import {
  normalizeAppearanceSettings,
  syncPresetsFromSingleThemeChoice,
} from "./theme";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
} from "./types";

const ACCOUNT_APPEARANCE_SELECT = {
  themeMode: true,
  lightThemePreset: true,
  darkThemePreset: true,
  singleThemeChoice: true,
  contrastEnabled: true,
  contrastLightEnabled: true,
  contrastDarkEnabled: true,
} as const;

type AccountAppearanceRow = {
  themeMode: AppearanceSettings["mode"];
  lightThemePreset: AppearanceSettings["lightPreset"];
  darkThemePreset: AppearanceSettings["darkPreset"];
  singleThemeChoice: AppearanceSettings["singleThemeChoice"];
  contrastEnabled: boolean;
  contrastLightEnabled: boolean;
  contrastDarkEnabled: boolean;
};

function toAppearanceSettings(row: AccountAppearanceRow): AppearanceSettings {
  return normalizeAppearanceSettings({
    mode: row.themeMode,
    lightPreset: row.lightThemePreset,
    darkPreset: row.darkThemePreset,
    singleThemeChoice: row.singleThemeChoice,
    contrast: {
      enabled: row.contrastEnabled,
      light: row.contrastLightEnabled,
      dark: row.contrastDarkEnabled,
    },
  });
}

export async function getAppearanceSettingsForAccount(
  accountId: string
): Promise<AppearanceSettings> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: ACCOUNT_APPEARANCE_SELECT,
  });

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  return toAppearanceSettings(account as AccountAppearanceRow);
}

export async function getAppearanceSettingsForAccountOrDefault(
  accountId: string | null | undefined
): Promise<AppearanceSettings> {
  if (!accountId) {
    return DEFAULT_APPEARANCE_SETTINGS;
  }

  try {
    return await getAppearanceSettingsForAccount(accountId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return DEFAULT_APPEARANCE_SETTINGS;
    }
    throw error;
  }
}

export async function updateAppearanceSettingsForAccount(
  accountId: string,
  input: AppearancePayloadInput
): Promise<AppearanceSettings> {
  const normalizedInput = normalizeAppearanceSettings({
    mode: input.mode,
    lightPreset: input.lightPreset,
    darkPreset: input.darkPreset,
    singleThemeChoice: input.singleThemeChoice,
    contrast: input.contrast,
  });
  const syncedPresets =
    normalizedInput.mode === "SINGLE_THEME"
      ? syncPresetsFromSingleThemeChoice(normalizedInput.singleThemeChoice, normalizedInput)
      : {
          lightPreset: normalizedInput.lightPreset,
          darkPreset: normalizedInput.darkPreset,
        };

  try {
    const updated = await prisma.account.update({
      where: { id: accountId },
      data: {
        themeMode: normalizedInput.mode,
        lightThemePreset: syncedPresets.lightPreset,
        darkThemePreset: syncedPresets.darkPreset,
        singleThemeChoice: normalizedInput.singleThemeChoice,
        contrastEnabled: normalizedInput.contrast.enabled,
        contrastLightEnabled: normalizedInput.contrast.light,
        contrastDarkEnabled: normalizedInput.contrast.dark,
      },
      select: ACCOUNT_APPEARANCE_SELECT,
    });

    return toAppearanceSettings(updated as AccountAppearanceRow);
  } catch (error) {
    const maybeCode =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (maybeCode === "P2025") {
      throw new NotFoundError("Account not found");
    }
    throw error;
  }
}
