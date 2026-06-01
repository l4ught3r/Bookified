import type { AiChatLocale } from "@/lib/ai/book-context";
import { getOpenAiApiKey, OPENAI_REALTIME_WHISPER_MODEL } from "@/lib/ai/openai";

const WHISPER_INPUT_SAMPLE_RATE = 24_000;
const CLIENT_SECRET_TTL_SECONDS = 600;

export type OpenAiTranscriptionClientSecret = {
  clientSecret: string;
  expiresAt: number;
  model: typeof OPENAI_REALTIME_WHISPER_MODEL;
};

export function getWhisperTranscriptionLanguage(locale: AiChatLocale): string {
  return locale === "ru" ? "ru" : "en";
}

export function buildTranscriptionClientSecretBody(locale: AiChatLocale) {
  return {
    expires_after: {
      seconds: CLIENT_SECRET_TTL_SECONDS,
      anchor: "created_at" as const,
    },
    session: {
      type: "transcription" as const,
      audio: {
        input: {
          format: {
            type: "audio/pcm" as const,
            rate: WHISPER_INPUT_SAMPLE_RATE,
          },
          transcription: {
            model: OPENAI_REALTIME_WHISPER_MODEL,
            language: getWhisperTranscriptionLanguage(locale),
            delay: "medium" as const,
          },
          turn_detection: null,
        },
      },
    },
  };
}

export async function createOpenAiTranscriptionClientSecret(
  locale: AiChatLocale,
): Promise<OpenAiTranscriptionClientSecret> {
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildTranscriptionClientSecretBody(locale)),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const detail = payload?.error?.message ?? response.statusText;
    throw new Error(`Failed to create OpenAI transcription session: ${detail}`);
  }

  const payload = (await response.json()) as {
    value?: string;
    expires_at?: number;
  };

  if (!payload.value) {
    throw new Error("Failed to create OpenAI transcription session: missing client secret");
  }

  return {
    clientSecret: payload.value,
    expiresAt: payload.expires_at ?? 0,
    model: OPENAI_REALTIME_WHISPER_MODEL,
  };
}

export { WHISPER_INPUT_SAMPLE_RATE };
