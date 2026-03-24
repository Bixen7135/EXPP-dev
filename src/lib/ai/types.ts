export interface AiMessage {
  role: "system" | "user";
  content: string;
}

export interface AiGenerateOptions {
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AiGenerateResult {
  text: string;
}
