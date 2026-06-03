import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { bookAccessError, requireBookAccess, updateBookById } from "@/lib/auth/require-book-access";
import { normalizeBookIdentifier } from "@/lib/books/book-duplicate";
import { normalizeBookLanguage } from "@/lib/books/normalize-language";
import {
  clearBookParsedContent,
  persistParsedBookContent,
} from "@/lib/books/persist-parsed-book";
import { createParser } from "@/lib/parsers/ParserFactory";
import { normalizeChapterHref } from "@/lib/books/chapter-href";
import { db } from "@/lib/db";
import { assets, chapters } from "@/lib/db/schema";
import { serializeBook } from "@/lib/db/types";
import { downloadBookFile } from "@/lib/storage/book-storage";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    const book = access.book;

    if (book.format === "pdf") {
      return NextResponse.json(
        { error: "Перепарсинг PDF не поддерживается" },
        { status: 400 },
      );
    }

    if (!book.originalStoragePath) {
      return NextResponse.json(
        { error: "Оригинальный файл книги не найден" },
        { status: 400 },
      );
    }

    await updateBookById(id, {
      status: "parsing",
      errorMessage: "",
    });

    const buffer = await downloadBookFile(book.originalStoragePath);
    const parser = createParser(book.format, buffer, id);
    const parsed = await parser.parse();

    if (!parsed.chapters.length) {
      throw new Error("В файле не найдено содержимое для чтения");
    }

    await clearBookParsedContent(id, {
      typographyStoragePath: book.typographyStoragePath,
    });

    let persisted;
    try {
      persisted = await persistParsedBookContent(id, parsed);
    } catch (persistError) {
      await updateBookById(id, {
        status: "error",
        coverAssetId: null,
        totalChapters: 0,
        totalWords: 0,
        errorMessage:
          persistError instanceof Error ? persistError.message : "Failed to persist parsed book",
      });
      throw persistError;
    }

    await updateBookById(id, {
      title: parsed.title,
      authors: parsed.authors,
      language: normalizeBookLanguage(parsed.language),
      description: parsed.description,
      identifier: parsed.identifier,
      identifierNormalized: normalizeBookIdentifier(parsed.identifier ?? ""),
      publisher: parsed.publisher,
      publishDate: parsed.publishDate,
      coverAssetId: null,
      toc: persisted.tocData,
      totalChapters: persisted.totalChapters,
      totalWords: persisted.totalWords,
      readingTypography: parsed.typography ?? null,
      typographyStoragePath: null,
      typographyExtractedAt: null,
      status: "parsed",
      errorMessage: "",
    });

    if (persisted.assetsToInsert.length > 0) {
      await db.insert(assets).values(persisted.assetsToInsert);
    }

    const insertedChapters =
      persisted.chaptersToInsert.length > 0
        ? await db.insert(chapters).values(persisted.chaptersToInsert).returning()
        : [];

    let coverAssetId: string | null = null;
    if (persisted.coverHref) {
      const [coverAsset] = await db
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.bookId, id), eq(assets.href, persisted.coverHref)))
        .limit(1);

      coverAssetId = coverAsset?.id ?? null;
    }

    const chapterMapByHref = new Map(
      insertedChapters.map((chapter) => [
        normalizeChapterHref(chapter.href),
        chapter.id,
      ]),
    );

    const toc = persisted.tocData.map((item) => ({
      ...item,
      chapterId: chapterMapByHref.get(normalizeChapterHref(item.href)),
    }));

    const updated = await updateBookById(id, {
      coverAssetId,
      toc,
    });

    return NextResponse.json({
      success: true,
      book: updated ? serializeBook(updated) : null,
      hasTypographyDocument: Boolean(parsed.typography),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reparse failed";

    try {
      const { id } = await params;
      await updateBookById(id, {
        status: "error",
        errorMessage: message,
      });
    } catch {
      // ignore secondary update errors
    }

    console.error("Reparse error:", error);
    return NextResponse.json(
      {
        error: "Failed to reparse book",
        details: message,
      },
      { status: 422 },
    );
  }
}
