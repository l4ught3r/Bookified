import { NextResponse } from "next/server";
import { buildBookAiContext, type AiChatLocale } from "@/lib/ai/book-context";
import {
  buildLiveVoiceSystemInstruction,
  createGeminiLiveSessionToken,
  createGeminiLiveSessionTokenWithFallback,
  type GeminiLiveModelTier,
} from "@/lib/ai/gemini-live";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";

export const runtime = "nodejs";

type LiveSessionRequestBody = {
  chapterOrder?: number;
  locale?: AiChatLocale;
  selectedText?: string;
  /** Request a specific tier; omit to try primary then auto-fallback on quota errors. */
  modelTier?: GeminiLiveModelTier;
};

function isValidLocale(value: unknown): value is AiChatLocale {
  return value === "en" || value === "ru";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    let body: LiveSessionRequestBody = {};
    try {
      const raw = await request.text();
      if (raw.trim()) {
        body = JSON.parse(raw) as LiveSessionRequestBody;
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const locale = isValidLocale(body.locale) ? body.locale : "en";
    const chapterOrder =
      typeof body.chapterOrder === "number" && Number.isFinite(body.chapterOrder)
        ? body.chapterOrder
        : undefined;
    const selectedText =
      typeof body.selectedText === "string" ? body.selectedText.trim() : undefined;

    const { systemPrompt } = await buildBookAiContext(access.book, chapterOrder, locale, {
      userQuery: "",
      selectedText: selectedText || undefined,
    });

    const liveSystemPrompt = buildLiveVoiceSystemInstruction(systemPrompt, locale);
    const session =
      body.modelTier === "primary" || body.modelTier === "fallback"
        ? await createGeminiLiveSessionToken(liveSystemPrompt, body.modelTier)
        : await createGeminiLiveSessionTokenWithFallback(liveSystemPrompt);

    return NextResponse.json(session);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start live session";

    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
