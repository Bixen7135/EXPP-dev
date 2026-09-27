import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import {
  getAppearanceSettingsForAccount,
  getAppearanceSettingsForAccountOrDefault,
  updateAppearanceSettingsForAccount,
} from "@/modules/appearance/service";
import { DEFAULT_APPEARANCE_SETTINGS } from "@/modules/appearance/types";

const mockPrisma = prisma as unknown as {
  account: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const accountRow = {
  themeMode: "SYSTEM",
  lightThemePreset: "DEFAULT",
  darkThemePreset: "DIMMED",
  singleThemeChoice: "DARK_SOFT",
  contrastEnabled: true,
  contrastLightEnabled: false,
  contrastDarkEnabled: true,
};

describe("appearance service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps account appearance columns into settings", async () => {
    mockPrisma.account.findUnique.mockResolvedValue(accountRow);

    const result = await getAppearanceSettingsForAccount("acc_1");

    expect(mockPrisma.account.findUnique).toHaveBeenCalledOnce();
    expect(result).toEqual({
      mode: "SYSTEM",
      lightPreset: "DEFAULT",
      darkPreset: "DIMMED",
      singleThemeChoice: "DARK_SOFT",
      contrast: {
        enabled: true,
        light: false,
        dark: true,
      },
    });
  });

  it("throws NotFoundError when account does not exist", async () => {
    mockPrisma.account.findUnique.mockResolvedValue(null);
    await expect(getAppearanceSettingsForAccount("missing")).rejects.toThrow(NotFoundError);
  });

  it("returns defaults when account id is not provided", async () => {
    const result = await getAppearanceSettingsForAccountOrDefault(null);
    expect(result).toEqual(DEFAULT_APPEARANCE_SETTINGS);
    expect(mockPrisma.account.findUnique).not.toHaveBeenCalled();
  });

  it("updates account appearance columns", async () => {
    mockPrisma.account.update.mockResolvedValue(accountRow);

    const result = await updateAppearanceSettingsForAccount("acc_1", {
      mode: "SYSTEM",
      lightPreset: "DEFAULT",
      darkPreset: "DIMMED",
      singleThemeChoice: "DARK_SOFT",
      contrast: {
        enabled: true,
        light: false,
        dark: true,
      },
    });

    expect(mockPrisma.account.update).toHaveBeenCalledWith({
      where: { id: "acc_1" },
      data: {
        themeMode: "SYSTEM",
        lightThemePreset: "DEFAULT",
        darkThemePreset: "DIMMED",
        singleThemeChoice: "DARK_SOFT",
        contrastEnabled: true,
        contrastLightEnabled: false,
        contrastDarkEnabled: true,
      },
      select: {
        themeMode: true,
        lightThemePreset: true,
        darkThemePreset: true,
        singleThemeChoice: true,
        contrastEnabled: true,
        contrastLightEnabled: true,
        contrastDarkEnabled: true,
      },
    });
    expect(result.mode).toBe("SYSTEM");
  });

  it("normalizes legacy LIGHT mode into SINGLE_THEME on read", async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      ...accountRow,
      themeMode: "LIGHT",
      lightThemePreset: "TRITANOPIA",
      singleThemeChoice: "DARK_DEFAULT",
    });

    const result = await getAppearanceSettingsForAccount("acc_legacy_light");

    expect(result.mode).toBe("SINGLE_THEME");
    expect(result.singleThemeChoice).toBe("LIGHT_TRITANOPIA");
  });

  it("normalizes legacy DARK mode into SINGLE_THEME on read", async () => {
    mockPrisma.account.findUnique.mockResolvedValue({
      ...accountRow,
      themeMode: "DARK",
      darkThemePreset: "COLORBLIND",
      singleThemeChoice: "LIGHT_DEFAULT",
    });

    const result = await getAppearanceSettingsForAccount("acc_legacy_dark");

    expect(result.mode).toBe("SINGLE_THEME");
    expect(result.singleThemeChoice).toBe("DARK_COLORBLIND");
  });

  it("syncs linked presets when saving SINGLE_THEME payload", async () => {
    mockPrisma.account.update.mockResolvedValue({
      ...accountRow,
      themeMode: "SINGLE_THEME",
      darkThemePreset: "DIMMED",
      singleThemeChoice: "DARK_SOFT",
    });

    await updateAppearanceSettingsForAccount("acc_1", {
      mode: "SINGLE_THEME",
      lightPreset: "DEFAULT",
      darkPreset: "DEFAULT",
      singleThemeChoice: "DARK_SOFT",
      contrast: {
        enabled: true,
        light: false,
        dark: false,
      },
    });

    expect(mockPrisma.account.update).toHaveBeenCalledWith({
      where: { id: "acc_1" },
      data: {
        themeMode: "SINGLE_THEME",
        lightThemePreset: "DEFAULT",
        darkThemePreset: "DIMMED",
        singleThemeChoice: "DARK_SOFT",
        contrastEnabled: true,
        contrastLightEnabled: false,
        contrastDarkEnabled: false,
      },
      select: {
        themeMode: true,
        lightThemePreset: true,
        darkThemePreset: true,
        singleThemeChoice: true,
        contrastEnabled: true,
        contrastLightEnabled: true,
        contrastDarkEnabled: true,
      },
    });
  });

  it("converts P2025 update errors into NotFoundError", async () => {
    mockPrisma.account.update.mockRejectedValue({ code: "P2025" });
    await expect(
      updateAppearanceSettingsForAccount("missing", {
        mode: "LIGHT",
        lightPreset: "DEFAULT",
        darkPreset: "DEFAULT",
        singleThemeChoice: "LIGHT_DEFAULT",
        contrast: { enabled: false, light: false, dark: false },
      })
    ).rejects.toThrow(NotFoundError);
  });
});
