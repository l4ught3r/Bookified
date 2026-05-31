import type { LibraryBook } from "@/lib/books/library-offline";
import { getLastChapterOrder } from "@/lib/books/reader-storage";
import { localDb, type LocalBook, type LocalChapter } from "@/lib/db/localDb";
import type { CachedBookMeta, ReaderChapterInput } from "@/lib/store/useBookStore";

export const OFFLINE_BOOKS_EVENT = "bookified:offline-books-changed";

function emitOfflineBooksChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_BOOKS_EVENT));
  }
}

function libraryBookToLocal(book: LibraryBook): LocalBook {
  return {
    id: book._id,
    title: book.title,
    authors: book.authors?.join(", ") ?? "",
    coverUrl: book.coverAssetId ? `/api/books/${book._id}/assets/${book.coverAssetId}` : "",
    format: book.format ?? "epub",
    totalChapters: book.totalChapters,
    coverAssetId: book.coverAssetId,
    createdAt: book.createdAt,
  };
}

function readerBookToLocal(book: CachedBookMeta): LocalBook {
  return {
    id: book._id,
    title: book.title,
    authors: book.authors?.join(", ") ?? "",
    coverUrl: book.coverUrl ?? "",
    format: book.format ?? "epub",
    totalChapters: book.totalChapters,
    coverAssetId: book.coverAssetId,
    typography: book.readingTypography ?? null,
  };
}

function readerChaptersToLocal(bookId: string, chapters: ReaderChapterInput[]): LocalChapter[] {
  return chapters.map((chapter) => ({
    id: chapter.id,
    bookId,
    title: chapter.title,
    href: chapter.href,
    order: chapter.order,
    wordCount: chapter.wordCount,
    content: chapter.content,
  }));
}

export async function isBookOfflineReady(bookId: string): Promise<boolean> {
  const chapterCount = await localDb.chapters.where("bookId").equals(bookId).count();
  if (chapterCount > 0) {
    return true;
  }

  const book = await localDb.books.get(bookId);
  return Boolean(book?.originalFile && book.originalFile.byteLength > 0);
}

export async function getOfflineReadyBookIds(): Promise<string[]> {
  const books = await localDb.books.toArray();
  const readyIds: string[] = [];

  for (const book of books) {
    if (book.originalFile && book.originalFile.byteLength > 0) {
      readyIds.push(book.id);
      continue;
    }

    const chapterCount = await localDb.chapters.where("bookId").equals(book.id).count();
    if (chapterCount > 0) {
      readyIds.push(book.id);
    }
  }

  return readyIds;
}

export async function downloadBookForOffline(
  book: LibraryBook,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "Нет подключения к интернету" };
  }

  if (await isBookOfflineReady(book._id)) {
    return { ok: true };
  }

  try {
    if (book.format === "pdf") {
      const res = await fetch(`/api/books/${encodeURIComponent(book._id)}/file`, {
        cache: "no-store",
      });

      if (res.status === 401) {
        return { ok: false, error: "Войдите в аккаунт, чтобы скачать книгу" };
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || "Не удалось загрузить PDF");
      }

      const originalFile = await res.arrayBuffer();
      const existing = await localDb.books.get(book._id);

      await localDb.books.put({
        ...libraryBookToLocal(book),
        typography: existing?.typography ?? null,
        lastChapterOrder: existing?.lastChapterOrder ?? getLastChapterOrder(book._id) ?? undefined,
        originalFile,
      });

      emitOfflineBooksChanged();
      return { ok: true };
    }

    const res = await fetch(`/api/books/${encodeURIComponent(book._id)}/reader`, {
      cache: "no-store",
    });

    if (res.status === 401) {
      return { ok: false, error: "Войдите в аккаунт, чтобы скачать книгу" };
    }

    if (!res.ok) {
      throw new Error("Не удалось загрузить книгу для офлайн-чтения");
    }

    const json = (await res.json()) as {
      book: CachedBookMeta & { _id: string; coverUrl?: string | null };
      chapters: ReaderChapterInput[];
    };

    const loadedBook: CachedBookMeta = {
      _id: json.book._id,
      title: json.book.title,
      authors: json.book.authors,
      format: json.book.format,
      totalChapters: json.book.totalChapters,
      coverAssetId: json.book.coverAssetId,
      coverUrl: json.book.coverUrl,
      readingTypography: json.book.readingTypography ?? null,
    };

    const existing = await localDb.books.get(book._id);
    const savedOrder = getLastChapterOrder(book._id);

    await localDb.books.put({
      ...readerBookToLocal(loadedBook),
      createdAt: existing?.createdAt ?? book.createdAt,
      lastChapterOrder: savedOrder ?? existing?.lastChapterOrder,
      originalFile: existing?.originalFile,
    });
    await localDb.chapters.bulkPut(readerChaptersToLocal(book._id, json.chapters));

    emitOfflineBooksChanged();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось скачать для офлайн-чтения",
    };
  }
}

export async function getOfflinePdfData(bookId: string): Promise<ArrayBuffer | null> {
  const book = await localDb.books.get(bookId);
  if (!book?.originalFile || book.originalFile.byteLength === 0) {
    return null;
  }
  return book.originalFile;
}

/** Persists PDF bytes in IndexedDB after a successful network load. */
export async function savePdfOriginalToLocalDb(
  bookId: string,
  originalFile: ArrayBuffer,
): Promise<void> {
  if (originalFile.byteLength === 0) {
    return;
  }

  const existing = await localDb.books.get(bookId);
  await localDb.books.put({
    id: bookId,
    title: existing?.title ?? "",
    authors: existing?.authors ?? "",
    coverUrl: existing?.coverUrl ?? "",
    format: existing?.format ?? "pdf",
    totalChapters: existing?.totalChapters,
    coverAssetId: existing?.coverAssetId,
    createdAt: existing?.createdAt,
    typography: existing?.typography ?? null,
    lastChapterOrder: existing?.lastChapterOrder,
    originalFile,
  });

  emitOfflineBooksChanged();
}
