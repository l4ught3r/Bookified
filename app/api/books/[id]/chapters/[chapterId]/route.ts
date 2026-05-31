import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";
import { downloadChapterContent } from "@/lib/books/chapter-storage";
import { db } from "@/lib/db";
import { chapters } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; chapterId: string }> },
) {
  try {
    const { id, chapterId } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    let chapter;

    if (UUID_RE.test(chapterId)) {
      [chapter] = await db
        .select()
        .from(chapters)
        .where(and(eq(chapters.id, chapterId), eq(chapters.bookId, id)))
        .limit(1);
    } else {
      const order = parseInt(chapterId, 10);
      if (!Number.isFinite(order)) {
        return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
      }

      [chapter] = await db
        .select()
        .from(chapters)
        .where(and(eq(chapters.bookId, id), eq(chapters.order, order)))
        .limit(1);
    }

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const stored = await downloadChapterContent(chapter.storagePath);
    const content = stored.html || stored.text || "";

    return NextResponse.json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load chapter";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
