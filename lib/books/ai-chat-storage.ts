import { isBookIdUuid } from "@/lib/books/book-id";

const MAX_STORED_MESSAGES = 100;

export type StoredAiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type StoredAiChat = {
  messages: StoredAiChatMessage[];
  updatedAt: number;
};

function storageKey(bookId: string): string {
  return `bookified:aiChat:${bookId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function trimMessages(messages: StoredAiChatMessage[]): StoredAiChatMessage[] {
  if (messages.length <= MAX_STORED_MESSAGES) {
    return messages;
  }

  return messages.slice(messages.length - MAX_STORED_MESSAGES);
}

export function loadAiChat(bookId: string): StoredAiChatMessage[] {
  if (!isBookIdUuid(bookId) || !canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey(bookId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Partial<StoredAiChat>;
    if (!Array.isArray(parsed.messages)) {
      return [];
    }

    return parsed.messages.filter(
      (message): message is StoredAiChatMessage =>
        typeof message.id === "string" &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        typeof message.timestamp === "number",
    );
  } catch {
    return [];
  }
}

export function saveAiChat(bookId: string, messages: StoredAiChatMessage[]): void {
  if (!isBookIdUuid(bookId) || !canUseStorage()) {
    return;
  }

  const payload: StoredAiChat = {
    messages: trimMessages(messages),
    updatedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(storageKey(bookId), JSON.stringify(payload));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function clearAiChat(bookId: string): void {
  if (!isBookIdUuid(bookId) || !canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey(bookId));
  } catch {
    // Ignore storage errors
  }
}
