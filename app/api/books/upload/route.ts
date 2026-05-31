// src/app/api/books/upload/route.ts
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { normalizeBookLanguage } from "@/lib/books/normalize-language";
import {
  computeBookContentHash,
  findDuplicateBook,
  findDuplicateByIdentifier,
  normalizeBookIdentifier,
} from "@/lib/books/book-duplicate";
import { persistParsedBookContent } from "@/lib/books/persist-parsed-book";
import { applyCustomCoverIfProvided } from "@/lib/books/save-book-cover";
import { inspectPdf } from "@/lib/books/pdf-inspect";
import { purgeOrphanedBookContent } from "@/lib/books/purge-book";
import { detectUploadFormat, isBookFormat } from "@/lib/books/book-formats";
import { createParser } from "@/lib/parsers/ParserFactory";
import { normalizeChapterHref } from "@/lib/books/chapter-href";
import { db } from "@/lib/db";
import { assets, books, chapters } from "@/lib/db/schema";
import { serializeBook } from "@/lib/db/types";
import { uploadBookFile } from "@/lib/storage/book-storage";
import { requireUser } from "@/lib/auth/require-user";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const bookId = randomUUID();
  const uploadedStoragePaths: string[] = [];

  try {
    const authResult = await requireUser(request);
    if (authResult.unauthorized) {
      return authResult.unauthorized;
    }
    const userId = authResult.userId;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name;
    const format = detectUploadFormat(filename, file.type);

    if (!format || !isBookFormat(format)) {
      return NextResponse.json(
        { error: "Не удалось определить формат. Поддерживаются: PDF, EPUB, FB2, TXT" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });
    }

    const contentHash = computeBookContentHash(buffer);
    const duplicateByHash = await findDuplicateBook({ contentHash, userId });
    if (duplicateByHash) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: "Такая книга уже есть в библиотеке",
          book: duplicateByHash,
        },
        { status: 409 },
      );
    }

    const originalStoragePath = await uploadBookFile(
      buffer,
      `original/${bookId}/${filename}`,
      file.type || "application/octet-stream",
    );
    uploadedStoragePaths.push(originalStoragePath);

    const manualTitle = String(formData.get("title") ?? "").trim();
    const manualAuthor = String(formData.get("author") ?? "").trim();
    const manualDescription = String(formData.get("description") ?? "").trim();

    if (format === "pdf") {
      const inspected = await inspectPdf(buffer);
      const fallbackTitle = filename.replace(/\.[^.]+$/, "");
      const title = inspected.title || fallbackTitle;

      await db.insert(books).values({
        id: bookId,
        userId,
        title: manualTitle || title,
        authors: manualAuthor ? [manualAuthor] : inspected.authors,
        language: "none",
        description: manualDescription || inspected.description,
        format: "pdf",
        coverAssetId: null,
        toc: [],
        totalChapters: inspected.numPages,
        totalWords: 0,
        originalStoragePath,
        contentHash,
        status: "parsed",
      });

      let coverAssetId: string | null = null;
      if (inspected.coverData) {
        const coverPath = await uploadBookFile(
          inspected.coverData,
          `covers/${bookId}/cover`,
          inspected.coverMediaType,
        );
        uploadedStoragePaths.push(coverPath);

        const [coverAsset] = await db
          .insert(assets)
          .values({
            bookId,
            href: "__cover__",
            mediaType: inspected.coverMediaType,
            kind: "cover",
            storagePath: coverPath,
          })
          .returning();

        coverAssetId = coverAsset?.id ?? null;
      }

      const customCoverAssetId = await applyCustomCoverIfProvided(
        bookId,
        formData,
        uploadedStoragePaths,
      );
      if (customCoverAssetId) {
        coverAssetId = customCoverAssetId;
      }

      const [book] = await db
        .update(books)
        .set({ coverAssetId, updatedAt: new Date() })
        .where(eq(books.id, bookId))
        .returning();

      return NextResponse.json({ success: true, book: serializeBook(book!) });
    }

    const parser = createParser(format, buffer, bookId);
    const parsed = await parser.parse();

    if (!parsed.chapters.length) {
      throw new Error("В файле не найдено содержимое для чтения");
    }

    const duplicateByIdentifier = await findDuplicateByIdentifier(parsed.identifier, userId);
    if (duplicateByIdentifier) {
      await purgeOrphanedBookContent(bookId, uploadedStoragePaths);
      return NextResponse.json(
        {
          error: "duplicate",
          message: "Такая книга уже есть в библиотеке",
          book: duplicateByIdentifier,
        },
        { status: 409 },
      );
    }

    const persisted = await persistParsedBookContent(bookId, parsed);
    uploadedStoragePaths.push(...persisted.storagePaths);

    await db.insert(books).values({
      id: bookId,
      userId,
      title: manualTitle || parsed.title,
      authors: manualAuthor ? [manualAuthor] : parsed.authors,
      language: normalizeBookLanguage(parsed.language),
      description: manualDescription || parsed.description,
      identifier: parsed.identifier,
      identifierNormalized: normalizeBookIdentifier(parsed.identifier ?? ""),
      publisher: parsed.publisher,
      publishDate: parsed.publishDate,
      format,
      coverAssetId: null,
      toc: persisted.tocData,
      totalChapters: persisted.totalChapters,
      totalWords: persisted.totalWords,
      originalStoragePath,
      contentHash,
      readingTypography: parsed.typography ?? null,
      typographyStoragePath: null,
      typographyExtractedAt: null,
      status: "parsed",
    });

    const insertAssets =
      persisted.assetsToInsert.length > 0
        ? db.insert(assets).values(persisted.assetsToInsert)
        : Promise.resolve();
    const insertChapters =
      persisted.chaptersToInsert.length > 0
        ? db.insert(chapters).values(persisted.chaptersToInsert).returning()
        : Promise.resolve([]);
    const [, insertedChapters] = await Promise.all([insertAssets, insertChapters]);

    let coverAssetId: string | null = null;
    if (persisted.coverHref) {
      const [coverAsset] = await db
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.bookId, bookId), eq(assets.href, persisted.coverHref)))
        .limit(1);

      coverAssetId = coverAsset?.id ?? null;
    }

    const customCoverAssetId = await applyCustomCoverIfProvided(
      bookId,
      formData,
      uploadedStoragePaths,
    );
    if (customCoverAssetId) {
      coverAssetId = customCoverAssetId;
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

    const [book] = await db
      .update(books)
      .set({
        coverAssetId,
        toc,
        updatedAt: new Date(),
      })
      .where(eq(books.id, bookId))
      .returning();

    return NextResponse.json({ success: true, book: serializeBook(book!) });
  } catch (error: unknown) {
    try {
      await purgeOrphanedBookContent(bookId, uploadedStoragePaths);
    } catch (cleanupError) {
      console.error("Upload cleanup error:", cleanupError);
    }

    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("Upload error:", error);

    return NextResponse.json(
      {
        error: "Failed to upload book",
        details: message,
      },
      { status: 422 },
    );
  }
}
