import type { ModelMessage, UIMessage } from "ai";

const FRAGMENT_PREFIX_PATTERNS = [
  /^Explain this excerpt:\s*"([\s\S]+)"$/i,
  /^Объясни этот фрагмент:\s*"([\s\S]+)"$/i,
];

export function getUiMessagePlainText(message: UIMessage): string {
  if ("content" in message && typeof message.content === "string") {
    return message.content.trim();
  }

  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function extractSelectedTextFromQuery(
  userQuery: string,
  explicitSelectedText?: string,
): string | undefined {
  const explicit = explicitSelectedText?.trim();
  if (explicit) {
    return explicit;
  }

  for (const pattern of FRAGMENT_PREFIX_PATTERNS) {
    const match = userQuery.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return undefined;
}

export function getLastUserQuery(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") {
      return getUiMessagePlainText(message);
    }
  }

  return "";
}

export function getLastUserModelMessage(messages: ModelMessage[]): ModelMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") {
      return message;
    }
  }

  return undefined;
}

export function getModelMessagePlainText(message: ModelMessage): string {
  if (typeof message.content === "string") {
    return message.content.trim();
  }

  if (!Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}
