import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";
import { downloadChapterContent } from "@/lib/books/chapter-storage";
import { db } from "@/lib/db";
import { chapters } from "@/lib/db/schema";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    const book = access.book;

    const chapterRows = await db
      .select({
        id: chapters.id,
        title: chapters.title,
        href: chapters.href,
        order: chapters.order,
        wordCount: chapters.wordCount,
        storagePath: chapters.storagePath,
      })
      .from(chapters)
      .where(eq(chapters.bookId, id))
      .orderBy(asc(chapters.order));

    const chaptersWithContent = await Promise.all(
      chapterRows.map(async (chapter) => {
        const stored = await downloadChapterContent(chapter.storagePath);
        return {
          id: chapter.id,
          title: chapter.title,
          href: chapter.href,
          order: chapter.order,
          wordCount: chapter.wordCount,
          content: stored.html || stored.text || "",
        };
      }),
    );

    const coverUrl = book.coverAssetId
      ? `/api/books/${id}/assets/${book.coverAssetId}`
      : null;

    return NextResponse.json({
      book: {
        id: book.id,
        _id: book.id,
        title: book.title,
        authors: book.authors,
        format: book.format,
        totalChapters: book.totalChapters,
        coverAssetId: book.coverAssetId,
        coverUrl,
        readingTypography: book.readingTypography ?? null,
        toc: book.toc ?? [],
      },
      chapters: chaptersWithContent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load reader data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
