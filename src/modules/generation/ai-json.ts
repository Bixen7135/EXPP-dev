import { ValidationError } from "@/lib/errors";

const CODE_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
const MAX_ERROR_SNIPPET = 200;

function trimSnippet(value: string): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= MAX_ERROR_SNIPPET) return singleLine;
  return `${singleLine.slice(0, MAX_ERROR_SNIPPET)}...`;
}

function stripOuterFence(value: string): string {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (!match) return value;
  return match[1].trim();
}

function stripLeadingJsonLabel(value: string): string {
  return value.replace(/^json\s*[\r\n]+/i, "").trim();
}

function extractFencedBlocks(value: string): string[] {
  const result: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = CODE_BLOCK_REGEX.exec(value)) !== null) {
    const block = match[1]?.trim();
    if (block) result.push(block);
  }

  return result;
}

function extractFirstBalancedJsonValue(value: string): string | null {
  const openChars = new Set(["{", "["]);
  const closeByOpen: Record<string, string> = {
    "{": "}",
    "[": "]",
  };
  const openByClose: Record<string, string> = {
    "}": "{",
    "]": "[",
  };

  for (let start = 0; start < value.length; start += 1) {
    const firstChar = value[start];
    if (!openChars.has(firstChar)) continue;

    const stack: string[] = [firstChar];
    let inString = false;
    let escaped = false;

    for (let i = start + 1; i < value.length; i += 1) {
      const ch = value[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (ch === "\\") {
          escaped = true;
          continue;
        }

        if (ch === "\"") {
          inString = false;
        }

        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }

      if (openChars.has(ch)) {
        stack.push(ch);
        continue;
      }

      if (ch in openByClose) {
        const expectedOpen = openByClose[ch];
        const current = stack[stack.length - 1];
        if (current !== expectedOpen) {
          break;
        }

        stack.pop();
        if (stack.length === 0) {
          return value.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

function buildCandidates(raw: string): string[] {
  const candidates: string[] = [];

  const trimmed = raw.trim();
  if (!trimmed) return candidates;

  const base = stripLeadingJsonLabel(stripOuterFence(trimmed));
  if (base) candidates.push(base);

  for (const block of extractFencedBlocks(trimmed)) {
    const normalized = stripLeadingJsonLabel(block);
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  }

  const extracted = extractFirstBalancedJsonValue(trimmed);
  if (extracted) {
    const normalized = stripLeadingJsonLabel(extracted.trim());
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  }

  return candidates;
}

export function parseAiJson<T>(raw: string, contextLabel: string): T {
  const candidates = buildCandidates(raw);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error;
    }
  }

  const snippet = trimSnippet(raw);
  const detail =
    lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new ValidationError(
    `Failed to parse AI ${contextLabel} JSON.${detail} Raw: ${snippet}`
  );
}

