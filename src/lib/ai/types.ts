export interface AiMessage {
  role: "system" | "user";
  content: string;
}

export interface AiGenerateOptions {
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  modelId?: string;
  traceId?: string;
  label?: string;
}

export interface AiGenerateResult {
  text: string;
}
