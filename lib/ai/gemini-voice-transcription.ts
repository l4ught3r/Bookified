import type { AiChatLocale } from "@/lib/ai/book-context";
import { getFastGeminiModelId, getGeminiApiKey } from "@/lib/ai/gemini";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const LIVE_MIC_SAMPLE_RATE = 16_000;
/** ~0.2s of 16-bit mono PCM — skip noise-only buffers. */
export const MIN_UTTERANCE_PCM_BYTES = Math.floor(LIVE_MIC_SAMPLE_RATE * 2 * 0.2);

function buildTranscriptionPrompt(locale: AiChatLocale): string {
  if (locale === "ru") {
    return [
      "Тебе передан фрагмент PCM-аудио с микрофона пользователя в голосовом чате о книге.",
      "Дословно транскрибируй только услышанную речь на русском языке.",
      "Не проси загрузить файл, не давай инструкций и пояснений.",
      "Верни только сказанные слова, без кавычек.",
      "Если речи нет или она неразборчива — верни пустую строку.",
    ].join(" ");
  }

  return [
    "You receive a PCM microphone fragment from an in-app voice chat about a book.",
    "Transcribe only the spoken words verbatim in English.",
    "Do not ask the user to upload files or give instructions.",
    "Return only the spoken words, no quotation marks.",
    "If there is no intelligible speech, return an empty string.",
  ].join(" ");
}

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export async function transcribePcm16Utterance(
  pcm16Base64: string,
  locale: AiChatLocale,
): Promise<string> {
  const model = getFastGeminiModelId();
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: buildTranscriptionPrompt(locale) },
            {
              inlineData: {
                mimeType: `audio/pcm;rate=${LIVE_MIC_SAMPLE_RATE}`,
                data: pcm16Base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const detail = payload?.error?.message ?? response.statusText;
    throw new Error(`Gemini transcription failed: ${detail}`);
  }

  const payload = (await response.json()) as GenerateContentResponse;
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  return text;
}
