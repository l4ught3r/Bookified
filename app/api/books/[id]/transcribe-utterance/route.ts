import { NextResponse } from "next/server";
import { type AiChatLocale } from "@/lib/ai/book-context";
import {
  LIVE_MIC_SAMPLE_RATE,
  MIN_UTTERANCE_PCM_BYTES,
  transcribePcm16Utterance,
} from "@/lib/ai/gemini-voice-transcription";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";

export const runtime = "nodejs";

type TranscribeUtteranceBody = {
  pcm16Base64?: string;
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

    let body: TranscribeUtteranceBody;
    try {
      body = (await request.json()) as TranscribeUtteranceBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const pcm16Base64 = typeof body.pcm16Base64 === "string" ? body.pcm16Base64.trim() : "";
    if (!pcm16Base64) {
      return NextResponse.json({ error: "Missing audio data" }, { status: 400 });
    }

    const pcmBytes = Buffer.from(pcm16Base64, "base64").byteLength;
    if (pcmBytes < MIN_UTTERANCE_PCM_BYTES) {
      return NextResponse.json({ transcript: "" });
    }

    const locale = isValidLocale(body.locale) ? body.locale : "en";
    const transcript = await transcribePcm16Utterance(pcm16Base64, locale);

    return NextResponse.json({ transcript, sampleRate: LIVE_MIC_SAMPLE_RATE });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Transcription failed";

    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
