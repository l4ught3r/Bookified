import {
  GoogleGenAI,
  Modality,
  type AudioTranscriptionConfig,
  type RealtimeInputConfig,
} from "@google/genai";
import type { AiChatLocale } from "@/lib/ai/book-context";
import { getGeminiApiKey } from "@/lib/ai/gemini";

export const GEMINI_LIVE_API_VERSION = "v1alpha" as const;

export const DEFAULT_GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.1-flash-live-preview";

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

export async function createGeminiLiveSessionToken(systemInstruction: string) {
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
        model: DEFAULT_GEMINI_LIVE_MODEL,
        config: liveConfig,
      },
    },
  });

  if (!token.name) {
    throw new Error("Failed to create Gemini Live session token");
  }

  return {
    token: token.name,
    model: DEFAULT_GEMINI_LIVE_MODEL,
  };
}
