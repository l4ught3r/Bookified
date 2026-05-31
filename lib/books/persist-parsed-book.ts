import { eq } from "drizzle-orm";
import { uploadChapterContent } from "@/lib/books/chapter-storage";
import { deleteTypographyDocument } from "@/lib/books/typography-document-storage";
import { db } from "@/lib/db";
import { assets, chapters } from "@/lib/db/schema";
import type { ParsedBook } from "@/lib/parsers/BaseParser";
import { deleteBookFiles, uploadBookFile } from "@/lib/storage/book-storage";

const UPLOAD_CONCURRENCY = 10;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex]!);
    }
  });

  await Promise.all(runners);
}

export type PersistParsedBookResult = {
  // Теперь мы возвращаем готовые массивы объектов для вставки в базу данных
  assetsToInsert: Array<typeof assets.$inferInsert>;
  chaptersToInsert: Array<typeof chapters.$inferInsert>;
  storagePaths: string[];
  coverHref: string | null;
  tocData: Array<{ title: string; href: string; order: number; level: number }>;
  totalChapters: number;
  totalWords: number;
};

export async function clearBookParsedContent(
  bookId: string,
  options: {
    typographyStoragePath?: string | null;
  } = {},
): Promise<void> {
  if (options.typographyStoragePath) {
    await deleteTypographyDocument(options.typographyStoragePath);
  }

  const [bookAssets, bookChapters] = await Promise.all([
    db.select().from(assets).where(eq(assets.bookId, bookId)),
    db
      .select({ storagePath: chapters.storagePath })
      .from(chapters)
      .where(eq(chapters.bookId, bookId)),
  ]);

  const storagePaths = [
    ...bookAssets.map((asset) => asset.storagePath),
    ...bookChapters.map((chapter) => chapter.storagePath),
  ];

  if (storagePaths.length) {
    try {
      await deleteBookFiles(storagePaths);
    } catch {
      // ignore missing files
    }
  }

  await db.delete(assets).where(eq(assets.bookId, bookId));
  await db.delete(chapters).where(eq(chapters.bookId, bookId));
}

export async function persistParsedBookContent(
  bookId: string,
  parsed: ParsedBook,
): Promise<PersistParsedBookResult> {
  const storagePaths: string[] = [];
  const assetsToInsert: Array<typeof assets.$inferInsert> = [];
  const chaptersToInsert: Array<typeof chapters.$inferInsert> = [];
  let coverHref: string | null = null;

  // 1. Загружаем обложку только в Storage
  if (parsed.coverData) {
    const coverPath = await uploadBookFile(
      parsed.coverData,
      `covers/${bookId}/cover`,
      parsed.coverMediaType,
    );
    storagePaths.push(coverPath);
    coverHref = "__cover__";

    assetsToInsert.push({
      bookId,
      href: "__cover__",
      mediaType: parsed.coverMediaType,
      kind: "cover",
      storagePath: coverPath,
    });
  }

  // 2. Загружаем ассеты только в Storage
  await runWithConcurrency(parsed.assets, UPLOAD_CONCURRENCY, async (asset) => {
    const assetPath = await uploadBookFile(
      asset.data,
      `assets/${bookId}/${asset.href}`,
      asset.mediaType,
    );
    storagePaths.push(assetPath);

    assetsToInsert.push({
      bookId,
      href: asset.href,
      mediaType: asset.mediaType,
      kind: asset.kind,
      storagePath: assetPath,
    });
  });

  // 3. Загружаем главы только в Storage
  await runWithConcurrency(parsed.chapters, UPLOAD_CONCURRENCY, async (chapter) => {
    const chapterPath = await uploadChapterContent(bookId, chapter.order, {
      html: chapter.html,
      text: chapter.text,
    });
    storagePaths.push(chapterPath);

    chaptersToInsert.push({
      bookId,
      order: chapter.order,
      title: chapter.title,
      href: chapter.href,
      storagePath: chapterPath,
      wordCount: chapter.wordCount,
    });
  });

  return {
    assetsToInsert,
    chaptersToInsert,
    storagePaths,
    coverHref,
    tocData: parsed.toc,
    totalChapters: parsed.chapters.length,
    totalWords: parsed.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
  };
}
