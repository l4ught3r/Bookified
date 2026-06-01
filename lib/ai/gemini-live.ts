import {
  GoogleGenAI,
  Modality,
  type AudioTranscriptionConfig,
  type RealtimeInputConfig,
} from "@google/genai";
import type { AiChatLocale } from "@/lib/ai/book-context";
import { getGeminiApiKey } from "@/lib/ai/gemini";

export const GEMINI_LIVE_API_VERSION = "v1alpha" as const;

export type GeminiLiveModelTier = "primary" | "fallback";

/** Preferred Live model (Gemini 3 Flash Live). */
export const PRIMARY_GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.1-flash-live-preview";

/** Cheaper / broader-access Live model (Gemini 2.5 Flash Native Audio). */
export const FALLBACK_GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL_FALLBACK?.trim() ||
  "gemini-2.5-flash-native-audio-preview-12-2025";

/** @deprecated Use {@link PRIMARY_GEMINI_LIVE_MODEL}. */
export const DEFAULT_GEMINI_LIVE_MODEL = PRIMARY_GEMINI_LIVE_MODEL;

export function getGeminiLiveModelForTier(tier: GeminiLiveModelTier = "primary"): string {
  return tier === "fallback" ? FALLBACK_GEMINI_LIVE_MODEL : PRIMARY_GEMINI_LIVE_MODEL;
}

/** True when the API indicates quota, billing, or model availability limits. */
export function isGeminiLiveQuotaOrAvailabilityError(
  message: string,
  httpStatus?: number,
): boolean {
  if (httpStatus === 429 || httpStatus === 503) {
    return true;
  }

  const lower = message.toLowerCase();

  if (
    lower.includes("resource_exhausted") ||
    lower.includes("resource exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests") ||
    lower.includes("billing") ||
    lower.includes("payment required") ||
    lower.includes("insufficient") ||
    lower.includes("exceeded your") ||
    lower.includes("exceeded the")
  ) {
    return true;
  }

  if (
    (lower.includes("token") || lower.includes("credit")) &&
    (lower.includes("limit") || lower.includes("exhausted") || lower.includes("insufficient"))
  ) {
    return true;
  }

  if (
    (lower.includes("not found") || lower.includes("not available") || lower.includes("unsupported")) &&
    lower.includes("model")
  ) {
    return true;
  }

  return false;
}

const LIVE_TOKEN_TTL_MS = 30 * 60 * 1000;
const LIVE_NEW_SESSION_TTL_MS = 2 * 60 * 1000;

export function buildLiveVoiceSystemInstruction(basePrompt: string, locale: AiChatLocale): string {
  const voiceRules =
    locale === "ru"
      ? [
          "",
          "Режим: живой голосовой диалог.",
          "Не произноси приветствие и не представляйся — пользователь уже в приложении.",
          "Дождись речи пользователя, затем отвечай по контексту книги.",
          "Отвечай кратко, разговорным языком, на языке пользователя.",
          "Пользователь говорит по-русски — распознавай и понимай речь как русскую.",
        ]
      : [
          "",
          "Mode: live voice conversation.",
          "Do not greet or introduce yourself — the user is already in the app.",
          "Wait for the user to speak, then answer using the book context.",
          "Keep replies short and conversational in the user's language.",
          "The user speaks English — recognize and understand speech as English.",
        ];

  return `${basePrompt}\n${voiceRules.join("\n")}`;
}

/** Developer API: enable transcription with `{}` only (`languageCodes` is Enterprise-only). */
export function getLiveAudioTranscriptionConfig(): AudioTranscriptionConfig {
  return {};
}

/** Reduces false end-of-speech splits (e.g. "А," pause, "кто такой…"). */
export function getLiveRealtimeInputConfig(): RealtimeInputConfig {
  return {
    automaticActivityDetection: {
      silenceDurationMs: 1000,
      prefixPaddingMs: 300,
    },
  };
}

export function getGeminiLiveConnectConfig(systemInstruction: string) {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    outputAudioTranscription: getLiveAudioTranscriptionConfig(),
    realtimeInputConfig: getLiveRealtimeInputConfig(),
  };
}

export type GeminiLiveSessionToken = {
  token: string;
  model: string;
  modelTier: GeminiLiveModelTier;
};

export async function createGeminiLiveSessionToken(
  systemInstruction: string,
  modelTier: GeminiLiveModelTier = "primary",
): Promise<GeminiLiveSessionToken> {
  const model = getGeminiLiveModelForTier(modelTier);
  const client = new GoogleGenAI({
    apiKey: getGeminiApiKey(),
    httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
  });

  const expireTime = new Date(Date.now() + LIVE_TOKEN_TTL_MS).toISOString();
  const newSessionExpireTime = new Date(Date.now() + LIVE_NEW_SESSION_TTL_MS).toISOString();
  const liveConfig = getGeminiLiveConnectConfig(systemInstruction);

  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      httpOptions: { apiVersion: GEMINI_LIVE_API_VERSION },
      liveConnectConstraints: {
        model,
        config: liveConfig,
      },
    },
  });

  if (!token.name) {
    throw new Error("Failed to create Gemini Live session token");
  }

  return {
    token: token.name,
    model,
    modelTier,
  };
}

export async function createGeminiLiveSessionTokenWithFallback(
  systemInstruction: string,
): Promise<GeminiLiveSessionToken> {
  try {
    return await createGeminiLiveSessionToken(systemInstruction, "primary");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isGeminiLiveQuotaOrAvailabilityError(message)) {
      throw error;
    }

    console.warn(
      "[Gemini Live] primary model unavailable, falling back:",
      PRIMARY_GEMINI_LIVE_MODEL,
      "→",
      FALLBACK_GEMINI_LIVE_MODEL,
      message,
    );

    return createGeminiLiveSessionToken(systemInstruction, "fallback");
  }
}
