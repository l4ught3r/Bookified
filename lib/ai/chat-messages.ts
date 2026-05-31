import type { UIMessage } from "ai";
import type { StoredAiChatMessage } from "@/lib/books/ai-chat-storage";

export function getUiMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function storedToUiMessages(stored: StoredAiChatMessage[]): UIMessage[] {
  return stored.map((message) => ({
    id: message.id,
    role: message.role,
    parts: [{ type: "text" as const, text: message.content, state: "done" as const }],
  }));
}

export function uiMessagesToStored(messages: UIMessage[]): StoredAiChatMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message, index) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: getUiMessageText(message),
      timestamp: Date.now() + index,
    }));
}

export function isUiMessageStreaming(message: UIMessage): boolean {
  return message.parts.some((part) => part.type === "text" && part.state === "streaming");
}
