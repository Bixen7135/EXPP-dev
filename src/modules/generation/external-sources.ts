import dns from "node:dns/promises";
import net from "node:net";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const EXTERNAL_FETCH_CONCURRENCY = 5;

const DEFAULT_CURATED_URLS = [
  "https://en.wikipedia.org/wiki/",
  "https://ru.wikipedia.org/wiki/",
];

export interface ExternalFetchInput {
  topic: string;
  includeWhitelist: boolean;
  teacherUrls: string[];
}

export interface ExternalSourceDocument {
  url: string;
  domain: string;
  title: string;
  text: string;
  excerpt: string;
}

export interface ExternalFetchResult {
  documents: ExternalSourceDocument[];
  warnings: string[];
}

function isPrivateIPv4(ip: string): boolean {
  const octets = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) return true;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`Only HTTPS URLs are allowed: ${raw}`);
  }

  if (!parsed.hostname) {
    throw new Error(`URL hostname is required: ${raw}`);
  }

  const addresses = await dns.lookup(parsed.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) {
    throw new Error(`Failed to resolve URL host: ${raw}`);
  }

  for (const address of addresses) {
    if (!net.isIP(address.address)) {
      throw new Error(`Invalid resolved IP for URL: ${raw}`);
    }

    if (net.isIPv4(address.address) && isPrivateIPv4(address.address)) {
      throw new Error(`Private/internal IP is not allowed: ${raw}`);
    }

    if (net.isIPv6(address.address) && isPrivateIPv6(address.address)) {
      throw new Error(`Private/internal IP is not allowed: ${raw}`);
    }
  }

  return parsed;
}

export async function validateAndNormalizeExternalUrl(raw: string): Promise<string> {
  const parsed = await assertPublicHttpsUrl(raw);
  parsed.hash = "";
  return parsed.toString();
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readResponseBodyWithLimit(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      throw new Error("External source response exceeds allowed size");
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(merged);
}

async function fetchExternalSource(url: string): Promise<ExternalSourceDocument> {
  const normalized = new URL(await validateAndNormalizeExternalUrl(url));

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(normalized.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "EXPP-RAG/1.0 (+https://localhost)",
        Accept: "text/html,text/plain,text/markdown,application/json,*/*;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error(`External source returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const body = await readResponseBodyWithLimit(response);

    let title = normalized.hostname;
    let text = body;

    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const jsonTitle =
          (typeof parsed.title === "string" && parsed.title) ||
          (typeof parsed.displaytitle === "string" && parsed.displaytitle) ||
          normalized.hostname;
        const jsonText =
          (typeof parsed.extract === "string" && parsed.extract) ||
          (typeof parsed.description === "string" && parsed.description) ||
          body;

        title = jsonTitle;
        text = String(jsonText);
      } catch {
        title = normalized.hostname;
      }
    } else if (contentType.includes("text/html")) {
      const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch?.[1]) {
        title = titleMatch[1].replace(/\s+/g, " ").trim();
      }
      text = htmlToText(body);
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new Error("External source has no readable text content");
    }

    return {
      url: normalized.toString(),
      domain: normalized.hostname,
      title,
      text: trimmed,
      excerpt: trimmed.slice(0, 500),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function slugifyTopic(topic: string): string {
  return topic
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 120);
}

function buildCuratedUrls(topic: string): string[] {
  const slug = slugifyTopic(topic);
  if (!slug) return [];
  return DEFAULT_CURATED_URLS.map((base) => `${base}${encodeURIComponent(slug)}`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const result: R[] = [];
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      const value = await mapper(items[index]);
      result[index] = value;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return result;
}

export async function fetchExternalKnowledge(
  input: ExternalFetchInput
): Promise<ExternalFetchResult> {
  const warnings: string[] = [];

  const allUrls = new Set<string>(input.teacherUrls.map((url) => url.trim()).filter(Boolean));
  if (input.includeWhitelist) {
    for (const url of buildCuratedUrls(input.topic)) {
      allUrls.add(url);
    }
  }

  const urls = [...allUrls];
  if (urls.length === 0) {
    return {
      documents: [],
      warnings,
    };
  }

  const settled = await mapWithConcurrency(
    urls,
    EXTERNAL_FETCH_CONCURRENCY,
    async (url) => {
      try {
        return await fetchExternalSource(url);
      } catch (error) {
        warnings.push(
          `External source skipped (${url}): ${error instanceof Error ? error.message : "unknown error"}`
        );
        return null;
      }
    }
  );

  return {
    documents: settled.filter((entry): entry is ExternalSourceDocument => entry !== null),
    warnings,
  };
}

export async function fetchExternalKnowledgeFromUrls(
  urls: string[]
): Promise<ExternalFetchResult> {
  const warnings: string[] = [];

  const normalized = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  if (normalized.length === 0) {
    return {
      documents: [],
      warnings,
    };
  }

  const settled = await mapWithConcurrency(
    normalized,
    EXTERNAL_FETCH_CONCURRENCY,
    async (url) => {
      try {
        return await fetchExternalSource(url);
      } catch (error) {
        warnings.push(
          `External source skipped (${url}): ${error instanceof Error ? error.message : "unknown error"}`
        );
        return null;
      }
    }
  );

  return {
    documents: settled.filter((entry): entry is ExternalSourceDocument => entry !== null),
    warnings,
  };
}

export const externalKnowledgeConstants = {
  REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  EXTERNAL_FETCH_CONCURRENCY,
};
