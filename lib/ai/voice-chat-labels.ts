import type { AiChatLocale } from "@/lib/ai/book-context";
import type { UIMessage } from "ai";
import { getUiMessageText } from "@/lib/ai/chat-messages";

const EPHEMERAL_LABELS = new Set([
  "слушаю…",
  "слушаю...",
  "listening…",
  "listening...",
  "распознаём…",
  "распознаем…",
  "распознаём...",
  "распознаем...",
  "transcribing…",
  "transcribing...",
  "голосовое сообщение",
  "voice message",
]);

export function listeningPlaceholder(locale: AiChatLocale): string {
  return locale === "ru" ? "Слушаю…" : "Listening…";
}

export function transcribingPlaceholder(locale: AiChatLocale): string {
  return locale === "ru" ? "Распознаём…" : "Transcribing…";
}

export function voiceMessagePlaceholder(locale: AiChatLocale): string {
  return locale === "ru" ? "Голосовое сообщение" : "Voice message";
}

export function isEphemeralVoiceLabel(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return EPHEMERAL_LABELS.has(normalized);
}

/** Model sometimes replies with instructions instead of a transcript. */
export function isInvalidBatchTranscript(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized || isEphemeralVoiceLabel(text)) {
    return true;
  }

  const metaPhrases = [
    "provide an audio",
    "provide a video",
    "audio recording",
    "video file",
    "please provide",
    "upload",
    "transcribe the following",
    "предоставьте аудио",
    "предоставьте видео",
    "аудиозапис",
    "видеофайл",
    "загрузите файл",
    "необходимо транскрибировать",
  ];

  return metaPhrases.some((phrase) => normalized.includes(phrase));
}

export function stripEphemeralVoiceMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((message) => {
    if (message.role !== "user") {
      return true;
    }

    return !isEphemeralVoiceLabel(getUiMessageText(message));
  });
}
