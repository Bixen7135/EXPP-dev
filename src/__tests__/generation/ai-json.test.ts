import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { parseAiJson } from "@/modules/generation/ai-json";

describe("parseAiJson", () => {
  it("parses plain JSON", () => {
    const parsed = parseAiJson<{ ok: boolean }>('{"ok":true}', "plain");
    expect(parsed.ok).toBe(true);
  });

  it("parses JSON wrapped in markdown fence", () => {
    const raw = "```json\n{\"title\":\"Plan\",\"totalQuestions\":5}\n```";
    const parsed = parseAiJson<{ title: string; totalQuestions: number }>(
      raw,
      "fenced"
    );

    expect(parsed.title).toBe("Plan");
    expect(parsed.totalQuestions).toBe(5);
  });

  it("parses first JSON object from mixed text", () => {
    const raw =
      "Sure, here is the output:\n```json\n{\"items\":[{\"q\":\"A\"}]}\n```\nDone.";
    const parsed = parseAiJson<{ items: Array<{ q: string }> }>(raw, "mixed");
    expect(parsed.items[0].q).toBe("A");
  });

  it("throws ValidationError when JSON cannot be extracted", () => {
    expect(() => parseAiJson("not a json response", "invalid")).toThrow(
      ValidationError
    );
  });
});

