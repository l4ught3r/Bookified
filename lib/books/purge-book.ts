import { eq } from "drizzle-orm";
import { deleteTypographyDocument } from "@/lib/books/typography-document-storage";
import { db } from "@/lib/db";
import { assets, books, chapters } from "@/lib/db/schema";
import { deleteAllBookStorage, deleteBookFilesBestEffort } from "@/lib/storage/book-storage";

export type PurgeBookOptions = {
  /** Удалить файлы в storage в фоне после очистки БД (быстрый ответ DELETE). */
  deferStorage?: boolean;
};

async function purgeBookStorageDeferred(
  bookId: string,
  extraStoragePaths: string[],
  typographyStoragePath?: string | null,
): Promise<void> {
  if (extraStoragePaths.length) {
    await deleteBookFilesBestEffort(extraStoragePaths);
  }

  if (typographyStoragePath) {
    await deleteTypographyDocument(typographyStoragePath);
  }

  await deleteAllBookStorage(bookId);
}

export async function purgeBook(
  bookId: string,
  extraStoragePaths: string[] = [],
): Promise<void> {
  const [book] = await db
    .select({
      originalStoragePath: books.originalStoragePath,
      typographyStoragePath: books.typographyStoragePath,
    })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  const storagePaths = new Set<string>(extraStoragePaths);

  if (book?.originalStoragePath) {
    storagePaths.add(book.originalStoragePath);
  }

  if (book?.typographyStoragePath) {
    storagePaths.add(book.typographyStoragePath);
  }

  if (book) {
    const [bookAssets, bookChapters] = await Promise.all([
      db.select({ storagePath: assets.storagePath }).from(assets).where(eq(assets.bookId, bookId)),
      db
        .select({ storagePath: chapters.storagePath })
        .from(chapters)
        .where(eq(chapters.bookId, bookId)),
    ]);

    for (const asset of bookAssets) {
      storagePaths.add(asset.storagePath);
    }

    for (const chapter of bookChapters) {
      storagePaths.add(chapter.storagePath);
    }

    await db.delete(books).where(eq(books.id, bookId));
  }

  if (storagePaths.size) {
    await deleteBookFilesBestEffort([...storagePaths]);
  }

  if (!book) {
    await deleteAllBookStorage(bookId);
  }
}

export async function purgeOrphanedBookContent(
  bookId: string,
  extraStoragePaths: string[] = [],
  typographyStoragePath?: string | null,
  options: PurgeBookOptions = {},
): Promise<void> {
  if (options.deferStorage) {
    await db.delete(books).where(eq(books.id, bookId));
    void purgeBookStorageDeferred(bookId, extraStoragePaths, typographyStoragePath);
    return;
  }

  if (typographyStoragePath) {
    await deleteTypographyDocument(typographyStoragePath);
  }

  await purgeBook(bookId, extraStoragePaths);
}
