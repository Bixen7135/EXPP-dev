export type AiHelpMode = "NO_HELP" | "CLARIFICATION" | "GUIDED" | "POST_ASSESSMENT";

// Modes allowed when creating a distribution for mandatory graded assignments
export const MANDATORY_GRADED_ALLOWED_MODES: AiHelpMode[] = ["NO_HELP", "CLARIFICATION"];

// Mode display labels for the UI
export const AI_HELP_MODE_LABELS: Record<AiHelpMode, string> = {
  NO_HELP: "No Help",
  CLARIFICATION: "Clarification Only",
  GUIDED: "Guided Help",
  POST_ASSESSMENT: "Post-Assessment Review",
};

// Mode descriptions shown to students
export const AI_HELP_MODE_DESCRIPTIONS: Record<AiHelpMode, string> = {
  NO_HELP: "AI assistance is not available for this assignment.",
  CLARIFICATION:
    "You may ask for clarification on question wording or terminology only. The AI will not provide hints or answers.",
  GUIDED:
    "The AI will help you think through problems by asking leading questions. It will not give you direct answers.",
  POST_ASSESSMENT:
    "AI review will be available after your results are published.",
};

// System prompts used by the AI for each mode
export const AI_HELP_SYSTEM_PROMPTS: Partial<Record<AiHelpMode, string>> = {
  CLARIFICATION:
    "You are an educational assistant helping a student understand the wording or terminology of a question. " +
    "You may ONLY clarify what a term, word, or phrase in the question means. " +
    "You must NOT provide hints, partial answers, strategies, or any information that would help the student answer the question. " +
    "If the student asks for help beyond clarification, politely decline and remind them of the allowed help mode.",
  GUIDED:
    "You are a Socratic tutor. Your role is to help students think through problems by asking leading questions. " +
    "You must NOT provide direct answers, solutions, or explicit hints. " +
    "Guide the student's thinking with questions like 'What do you already know about...?' or 'What would happen if...?'. " +
    "If the student asks for a direct answer, respond only with another guiding question.",
};
