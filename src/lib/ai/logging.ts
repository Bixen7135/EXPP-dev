import fs from "node:fs/promises";
import path from "node:path";
import type { AiMessage } from "./types";

const DEFAULT_MAX_LOG_CHARS = 24_000;
const REDACTED = "[REDACTED]";
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{16,}\b/g;

export interface AiLogRequestPayload {
  callId: string;
  traceId?: string;
  label?: string;
  modelId: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AiLogResponsePayload {
  callId: string;
  traceId?: string;
  label?: string;
  modelId: string;
  text?: string;
  error?: string;
}

interface AiLogEntry {
  ts: string;
  type: "request" | "response";
  callId: string;
  traceId?: string;
  label?: string;
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  messages?: AiMessage[];
  text?: string;
  error?: string;
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function isAiLoggingEnabled(): boolean {
  if (process.env.AI_LOGGING_ENABLED !== undefined) {
    return isTruthy(process.env.AI_LOGGING_ENABLED);
  }

  return process.env.NODE_ENV === "development";
}

function maxLogChars(): number {
  const raw = process.env.AI_LOG_MAX_CHARS;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MAX_LOG_CHARS;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_LOG_CHARS;
  }
  return parsed;
}

function trimText(value: string | undefined): string | undefined {
  if (!value) return value;
  const limit = maxLogChars();
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}... [trimmed ${value.length - limit} chars]`;
}

function redactSecrets(value: string | undefined): string | undefined {
  if (!value) return value;

  let redacted = value.replace(OPENAI_KEY_PATTERN, REDACTED);

  const configuredApiKey = process.env.OPENAI_API_KEY?.trim();
  if (configuredApiKey) {
    redacted = redacted.split(configuredApiKey).join(REDACTED);
  }

  return redacted;
}

function normalizeMessages(messages: AiMessage[] | undefined): AiMessage[] | undefined {
  if (!messages) return undefined;
  return messages.map((message) => ({
    role: message.role,
    content: trimText(redactSecrets(message.content)) ?? "",
  }));
}

function buildLogFilePath(): string {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(process.cwd(), "storage", "ai-logs", `openai-${day}.jsonl`);
}

async function appendToFile(entry: AiLogEntry): Promise<void> {
  const targetPath = buildLogFilePath();
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.appendFile(targetPath, `${JSON.stringify(entry)}\n`, "utf8");
}

function printToConsole(entry: AiLogEntry): void {
  if (entry.type === "request") {
    console.info("[ai][request]", {
      callId: entry.callId,
      traceId: entry.traceId,
      label: entry.label,
      modelId: entry.modelId,
      messages: entry.messages?.length ?? 0,
      maxTokens: entry.maxTokens,
      temperature: entry.temperature,
    });
    return;
  }

  if (entry.error) {
    console.error("[ai][response][error]", {
      callId: entry.callId,
      traceId: entry.traceId,
      label: entry.label,
      modelId: entry.modelId,
      error: entry.error,
    });
    return;
  }

  console.info("[ai][response]", {
    callId: entry.callId,
    traceId: entry.traceId,
    label: entry.label,
    modelId: entry.modelId,
    outputLength: entry.text?.length ?? 0,
  });
}

async function writeEntry(entry: AiLogEntry): Promise<void> {
  if (!isAiLoggingEnabled()) return;

  printToConsole(entry);
  try {
    await appendToFile(entry);
  } catch (error) {
    console.warn("[ai][log] failed to write ai log file", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function logAiRequest(payload: AiLogRequestPayload): Promise<void> {
  await writeEntry({
    ts: new Date().toISOString(),
    type: "request",
    callId: payload.callId,
    traceId: payload.traceId,
    label: payload.label,
    modelId: payload.modelId,
    maxTokens: payload.maxTokens,
    temperature: payload.temperature,
    messages: normalizeMessages(payload.messages),
  });
}

export async function logAiResponse(payload: AiLogResponsePayload): Promise<void> {
  await writeEntry({
    ts: new Date().toISOString(),
    type: "response",
    callId: payload.callId,
    traceId: payload.traceId,
    label: payload.label,
    modelId: payload.modelId,
    text: trimText(redactSecrets(payload.text)),
    error: redactSecrets(payload.error),
  });
}
