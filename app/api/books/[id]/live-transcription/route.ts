import { NextResponse } from "next/server";
import { type AiChatLocale } from "@/lib/ai/book-context";
import { createOpenAiTranscriptionClientSecret } from "@/lib/ai/openai-realtime-transcription";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";

export const runtime = "nodejs";

type LiveTranscriptionRequestBody = {
  locale?: AiChatLocale;
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

    let body: LiveTranscriptionRequestBody = {};
    try {
      const raw = await request.text();
      if (raw.trim()) {
        body = JSON.parse(raw) as LiveTranscriptionRequestBody;
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const locale = isValidLocale(body.locale) ? body.locale : "en";
    const session = await createOpenAiTranscriptionClientSecret(locale);

    return NextResponse.json(session);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to start live transcription session";

    if (message.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
