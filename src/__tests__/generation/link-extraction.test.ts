import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gateway", () => ({
  aiGenerate: vi.fn(),
}));

vi.mock("@/modules/generation/external-sources", () => ({
  validateAndNormalizeExternalUrl: vi.fn(),
}));

import { aiGenerate } from "@/lib/ai/gateway";
import { validateAndNormalizeExternalUrl } from "@/modules/generation/external-sources";
import {
  extractLinksFromAdditionalInstructions,
  linkExtractionConstants,
} from "@/modules/generation/link-extraction";

const mockAiGenerate = aiGenerate as unknown as ReturnType<typeof vi.fn>;
const mockValidateUrl = validateAndNormalizeExternalUrl as unknown as ReturnType<typeof vi.fn>;

describe("extractLinksFromAdditionalInstructions", () => {
  beforeEach(() => {
    mockValidateUrl.mockImplementation(async (raw: string) => {
      if (!raw.startsWith("https://")) {
        throw new Error("Only HTTPS URLs are allowed");
      }
      return raw;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty values when additionalInstructions is empty", async () => {
    const result = await extractLinksFromAdditionalInstructions({
      topic: "Algebra",
      additionalInstructions: "   ",
    });

    expect(result).toEqual({
      explicitUrls: [],
      suggestedUrls: [],
      materialHints: [],
      warnings: [],
    });
    expect(mockAiGenerate).not.toHaveBeenCalled();
  });

  it("falls back to regex extraction when AI returns malformed JSON", async () => {
    mockAiGenerate.mockResolvedValueOnce({
      text: "not-json",
    });

    const result = await extractLinksFromAdditionalInstructions({
      topic: "Biology",
      additionalInstructions:
        "Use https://example.com/chapter-1 and also http://insecure.example.com",
    });

    expect(result.explicitUrls).toEqual(["https://example.com/chapter-1"]);
    expect(result.suggestedUrls).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes("falling back"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("http://insecure.example.com"))).toBe(true);
  });

  it("deduplicates and caps explicit/suggested URLs and material hints", async () => {
    const explicitUrls = Array.from({ length: 15 }, (_, index) => `https://explicit.example.com/${index}`);
    const suggestedUrls = Array.from({ length: 15 }, (_, index) => ({
      url: `https://suggested.example.com/${index}`,
      reason: "Relevant to topic",
      confidence: 1 - index * 0.01,
    }));
    const materialHints = [
      ...Array.from({ length: 30 }, (_, index) => `hint-${index}`),
      "hint-1",
      "hint-2",
    ];

    mockAiGenerate.mockResolvedValueOnce({
      text: JSON.stringify({
        explicitUrls: [...explicitUrls, "https://explicit.example.com/1"],
        suggestedUrls,
        materialHints,
      }),
    });

    const result = await extractLinksFromAdditionalInstructions({
      topic: "Chemistry",
      additionalInstructions: "Please include supporting links.",
    });

    expect(result.explicitUrls.length).toBe(linkExtractionConstants.MAX_EXPLICIT_URLS);
    expect(result.suggestedUrls.length).toBe(linkExtractionConstants.MAX_SUGGESTED_URLS);
    expect(new Set(result.explicitUrls).size).toBe(result.explicitUrls.length);
    expect(new Set(result.suggestedUrls).size).toBe(result.suggestedUrls.length);
    expect(result.materialHints.length).toBe(linkExtractionConstants.MAX_HINTS);
    expect(new Set(result.materialHints).size).toBe(result.materialHints.length);
  });
});
