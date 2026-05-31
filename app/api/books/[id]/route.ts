import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { purgeOrphanedBookContent } from "@/lib/books/purge-book";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";
import { db } from "@/lib/db";
import { chapters } from "@/lib/db/schema";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    const chapterRows = await db
      .select({
        id: chapters.id,
        order: chapters.order,
        title: chapters.title,
        href: chapters.href,
        wordCount: chapters.wordCount,
      })
      .from(chapters)
      .where(eq(chapters.bookId, id))
      .orderBy(asc(chapters.order));

    return NextResponse.json({
      book: {
        ...access.book,
        hasTypographyDocument: Boolean(access.book.typographyStoragePath),
      },
      chapters: chapterRows.map((chapter) => ({
        _id: chapter.id,
        order: chapter.order,
        title: chapter.title,
        href: chapter.href,
        wordCount: chapter.wordCount,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    await purgeOrphanedBookContent(id, [], access.book.typographyStoragePath ?? undefined, {
      deferStorage: true,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
