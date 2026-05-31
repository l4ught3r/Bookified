import { createGoogleGenerativeAI } from "@ai-sdk/google";

const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
const FAST_MODEL = process.env.GEMINI_MODEL_FAST?.trim() || "gemini-3.1-flash-lite";

const COMPLEX_INTENT_PATTERN =
  /(?:summary|summarize|character|context|analysis|analyze|explain the context|historical|cultural|кратк|содержан|анализ|персонаж|контекст|историческ|культурн)/i;

const SIMPLE_QUERY_MAX_WORDS = 40;

export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return apiKey;
}

export function getDefaultGeminiModelId(): string {
  return DEFAULT_MODEL;
}

export function getFastGeminiModelId(): string {
  return FAST_MODEL;
}

export function selectGeminiModel(userQuery: string, intent?: "simple" | "complex"): string {
  const trimmed = userQuery.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  if (wordCount <= SIMPLE_QUERY_MAX_WORDS) {
    return FAST_MODEL;
  }

  if (intent === "complex" || COMPLEX_INTENT_PATTERN.test(trimmed)) {
    return DEFAULT_MODEL;
  }

  return FAST_MODEL;
}

export function getGeminiModel(modelId: string = DEFAULT_MODEL) {
  const google = createGoogleGenerativeAI({ apiKey: getGeminiApiKey() });
  return google(modelId);
}

export function getGeminiProviderOptions() {
  return {
    google: {
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  } as const;
}
