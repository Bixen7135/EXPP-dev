import { z } from "zod";
import { ValidationError } from "@/lib/errors";
import type { GenerationConstraints } from "./types";

const MAX_LONG_CONSTRAINT_TEXT_LENGTH = 10000;

export const ConstraintsSchema = z.object({
  topic: z.string().min(1, "Topic is required").max(200),
  section: z.string().max(200).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  format: z.enum(["SINGLE_ASSIGNMENT", "WORKSHEET"]),
  questionCount: z
    .number()
    .int("questionCount must be an integer")
    .min(1, "At least 1 question required")
    .max(20, "Maximum 20 questions"),
  educationalGoals: z.string().max(MAX_LONG_CONSTRAINT_TEXT_LENGTH).optional(),
  additionalInstructions: z.string().max(MAX_LONG_CONSTRAINT_TEXT_LENGTH).optional(),
});

export function validateConstraints(raw: unknown): GenerationConstraints {
  const result = ConstraintsSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues ?? (result.error as { errors?: { message: string }[] }).errors ?? [];
    const msg = issues.map((e: { message: string }) => e.message).join("; ");
    throw new ValidationError(`Invalid constraints: ${msg}`);
  }
  return result.data;
}
