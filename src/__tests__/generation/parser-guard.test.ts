import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_DIRECT_PARSE_REGEX = /JSON\.parse\s*\(\s*result\.text\s*\)/;

describe("generation parser guard", () => {
  it("does not use direct JSON.parse(result.text) in generation modules", async () => {
    const generationFiles = [
      "src/modules/generation/planner.ts",
      "src/modules/generation/generator.ts",
      "src/modules/generation/link-extraction.ts",
    ];

    for (const relativePath of generationFiles) {
      const filePath = path.join(process.cwd(), relativePath);
      const source = await fs.readFile(filePath, "utf8");
      expect(source).not.toMatch(FORBIDDEN_DIRECT_PARSE_REGEX);
    }
  });
});

