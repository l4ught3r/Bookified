import type { LiveServerMessage, Part } from "@google/genai";
import type { UIMessage } from "ai";
import { getUiMessageText, isUiMessageStreaming } from "@/lib/ai/chat-messages";

function needsSpaceBetween(previous: string, next: string): boolean {
  if (!previous || !next) {
    return false;
  }

  if (/\s$/.test(previous) || /^\s/.test(next)) {
    return false;
  }

  if (/^[,.;:!?…)\]}»]/.test(next)) {
    return false;
  }

  if (/[([\{«]$/.test(previous)) {
    return false;
  }

  return /[\p{L}\p{N}]$/u.test(previous) && /^[\p{L}\p{N}]/u.test(next);
}

/** Merges Live API transcript chunks (cumulative or incremental). Preserves spaces. */
export function mergeTranscriptFragment(current: string, incoming: string): string {
  if (!incoming) {
    return current;
  }

  if (!current) {
    return incoming;
  }

  if (incoming === current) {
    return current;
  }

  if (incoming.startsWith(current)) {
    return incoming;
  }

  if (current.startsWith(incoming)) {
    return current;
  }

  if (needsSpaceBetween(current, incoming)) {
    return `${current} ${incoming}`;
  }

  return `${current}${incoming}`;
}

const MERGE_USER_WINDOW_MS = 2500;

export type RecentUserCommit = {
  messageId: string;
  text: string;
  committedAt: number;
};

/** Reopen a just-committed user bubble when VAD split one utterance in two. */
export function shouldReopenRecentUserTranscript(
  recent: RecentUserCommit | null,
  incoming: string,
  now = Date.now(),
): recent is RecentUserCommit {
  if (!recent || !incoming.trim()) {
    return false;
  }

  if (now - recent.committedAt > MERGE_USER_WINDOW_MS) {
    return false;
  }

  const previous = recent.text.trim();
  if (!previous) {
    return false;
  }

  if (previous.length <= 4) {
    return true;
  }

  if (/[,\-–—:;]$/.test(previous)) {
    return true;
  }

  return /^[а-яёa-z]/iu.test(incoming) && !/^[А-ЯЁA-Z]/.test(incoming);
}

export function markStreamingMessagesDone(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) =>
      part.type === "text" && part.state === "streaming"
        ? { ...part, state: "done" as const }
        : part,
    ),
  }));
}

function extractPcm16FromModelParts(parts: Part[]): ArrayBuffer | null {
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    const data = part.inlineData?.data;
    const mimeType = part.inlineData?.mimeType ?? "";
    if (!data || !mimeType.includes("audio")) {
      continue;
    }

    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    chunks.push(bytes);
  }

  if (chunks.length === 0) {
    return null;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged.buffer;
}

export function extractPcm16FromServerMessage(message: LiveServerMessage): ArrayBuffer | null {
  const parts = message.serverContent?.modelTurn?.parts;
  if (parts?.length) {
    return extractPcm16FromModelParts(parts);
  }

  return null;
}

export function createTextMessage(
  role: "user" | "assistant",
  text: string,
  streaming = false,
): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [
      {
        type: "text",
        text,
        state: streaming ? "streaming" : "done",
      },
    ],
  };
}

export function upsertMessage(
  messages: UIMessage[],
  messageId: string,
  role: "user" | "assistant",
  text: string,
  streaming: boolean,
): UIMessage[] {
  const parts = [
    { type: "text" as const, text, state: streaming ? ("streaming" as const) : ("done" as const) },
  ];
  const nextMessage = { id: messageId, role, parts };

  const index = messages.findIndex((message) => message.id === messageId);
  if (index >= 0) {
    return messages.map((message, i) => (i === index ? nextMessage : message));
  }

  const withoutDuplicateIds = messages.filter((message) => message.id !== messageId);
  return [...withoutDuplicateIds, nextMessage];
}

export function commitTranscript(
  messages: UIMessage[],
  messageId: string | null,
  role: "user" | "assistant",
  text: string,
): { messages: UIMessage[]; messageId: string | null } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { messages, messageId: null };
  }

  if (messageId) {
    const existing = messages.find((message) => message.id === messageId);
    if (existing && getUiMessageText(existing).trim() === trimmed) {
      return { messages, messageId: null };
    }

    return {
      messages: upsertMessage(messages, messageId, role, trimmed, false),
      messageId: null,
    };
  }

  return {
    messages: [...messages, createTextMessage(role, trimmed, false)],
    messageId: null,
  };
}

export function messagesEqual(previous: UIMessage[], next: UIMessage[]): boolean {
  if (previous === next) {
    return true;
  }

  if (previous.length !== next.length) {
    return false;
  }

  for (let i = 0; i < previous.length; i++) {
    const prev = previous[i]!;
    const curr = next[i]!;
    if (prev.id !== curr.id || prev.role !== curr.role) {
      return false;
    }
    if (getUiMessageText(prev) !== getUiMessageText(curr)) {
      return false;
    }
    if (isUiMessageStreaming(prev) !== isUiMessageStreaming(curr)) {
      return false;
    }
  }

  return true;
}
