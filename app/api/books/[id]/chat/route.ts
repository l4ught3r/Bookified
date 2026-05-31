import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { buildBookAiContext, type AiChatLocale } from "@/lib/ai/book-context";
import {
  extractSelectedTextFromQuery,
  getLastUserQuery,
  getLastUserModelMessage,
  getModelMessagePlainText,
} from "@/lib/ai/chat-request";
import { getGeminiModel, getGeminiProviderOptions, selectGeminiModel } from "@/lib/ai/gemini";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";

export const runtime = "nodejs";

type ChatRequestBody = {
  messages?: UIMessage[];
  chapterOrder?: number;
  locale?: AiChatLocale;
  selectedText?: string;
  intent?: "simple" | "complex";
};

function isValidLocale(value: unknown): value is AiChatLocale {
  return value === "en" || value === "ru";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    let body: ChatRequestBody;
    try {
      body = (await request.json()) as ChatRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "At least one message is required" }, { status: 400 });
    }

    const messages = await convertToModelMessages(body.messages);
    if (messages.length === 0) {
      return NextResponse.json({ error: "At least one message is required" }, { status: 400 });
    }

    const lastMessage = getLastUserModelMessage(messages);
    if (!lastMessage) {
      return NextResponse.json({ error: "Last message must be from the user" }, { status: 400 });
    }

    const locale = isValidLocale(body.locale) ? body.locale : "en";
    const chapterOrder =
      typeof body.chapterOrder === "number" && Number.isFinite(body.chapterOrder)
        ? body.chapterOrder
        : undefined;

    const userQuery = getLastUserQuery(body.messages) || getModelMessagePlainText(lastMessage);
    const selectedText = extractSelectedTextFromQuery(
      userQuery,
      typeof body.selectedText === "string" ? body.selectedText : undefined,
    );

    const { systemPrompt } = await buildBookAiContext(access.book, chapterOrder, locale, {
      userQuery,
      selectedText,
    });

    const modelId = selectGeminiModel(userQuery, body.intent);

    // Text-only generation: no tools or Google Search / Map grounding.
    const result = streamText({
      model: getGeminiModel(modelId),
      system: systemPrompt,
      messages,
      tools: {},
      providerOptions: getGeminiProviderOptions(),
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate AI response";

    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
