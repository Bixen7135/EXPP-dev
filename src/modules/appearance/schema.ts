import { z } from "zod";
import {
  DARK_THEME_PRESETS,
  LIGHT_THEME_PRESETS,
  SINGLE_THEME_CHOICES,
  THEME_MODES,
} from "./types";

const ThemeModeSchema = z.enum(THEME_MODES);
const LightThemePresetSchema = z.enum(LIGHT_THEME_PRESETS);
const DarkThemePresetSchema = z.enum(DARK_THEME_PRESETS);
const SingleThemeChoiceSchema = z.enum(SINGLE_THEME_CHOICES);

export const AppearancePayloadSchema = z
  .object({
    mode: ThemeModeSchema,
    lightPreset: LightThemePresetSchema,
    darkPreset: DarkThemePresetSchema,
    singleThemeChoice: SingleThemeChoiceSchema.optional(),
    contrast: z.object({
      enabled: z.boolean(),
      light: z.boolean(),
      dark: z.boolean(),
    }),
  })
  .superRefine((payload, context) => {
    if (payload.mode === "SINGLE_THEME" && !payload.singleThemeChoice) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["singleThemeChoice"],
        message: "singleThemeChoice is required when mode is SINGLE_THEME",
      });
    }
  });

export type AppearancePayloadInput = z.infer<typeof AppearancePayloadSchema>;
