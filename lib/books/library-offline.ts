import { localDb, type LocalBook } from "@/lib/db/localDb";

export type LibraryBook = {
  _id: string;
  title: string;
  authors?: string[];
  format?: "epub" | "fb2" | "txt" | "pdf" | "mobi";
  coverAssetId?: string | null;
  totalChapters?: number;
  createdAt?: string;
};

function localToLibraryBook(local: LocalBook): LibraryBook {
  return {
    _id: local.id,
    title: local.title,
    authors: local.authors ? local.authors.split(", ").filter(Boolean) : [],
    format: local.format as LibraryBook["format"],
    coverAssetId: local.coverAssetId,
    totalChapters: local.totalChapters,
    createdAt: local.createdAt,
  };
}

function apiToLocalBook(api: LibraryBook): LocalBook {
  return {
    id: api._id,
    title: api.title,
    authors: api.authors?.join(", ") ?? "",
    coverUrl: api.coverAssetId ? `/api/books/${api._id}/assets/${api.coverAssetId}` : "",
    format: api.format ?? "epub",
    totalChapters: api.totalChapters,
    coverAssetId: api.coverAssetId,
    createdAt: api.createdAt,
  };
}

export function sortLibraryBooks(books: LibraryBook[]): LibraryBook[] {
  return [...books].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}

function libraryBooksSignature(books: LibraryBook[]): string {
  return sortLibraryBooks(books)
    .map(
      (book) =>
        `${book._id}:${book.title}:${book.authors?.join("|") ?? ""}:${book.format ?? ""}:${book.coverAssetId ?? ""}:${book.totalChapters ?? 0}:${book.createdAt ?? ""}`,
    )
    .join(";");
}

export async function loadLibraryBooksFromLocalDb(): Promise<LibraryBook[]> {
  const localBooks = await localDb.books.toArray();
  return sortLibraryBooks(localBooks.map(localToLibraryBook));
}

export async function syncLibraryBooksToLocalDb(apiBooks: LibraryBook[]): Promise<void> {
  const apiIds = new Set(apiBooks.map((book) => book._id));
  const localBooks = await localDb.books.toArray();
  const staleIds = localBooks.filter((book) => !apiIds.has(book.id)).map((book) => book.id);

  for (const bookId of staleIds) {
    await removeLibraryBookFromLocalDb(bookId);
  }

  if (apiBooks.length === 0) {
    return;
  }

  const existingBooks = await localDb.books.bulkGet(apiBooks.map((book) => book._id));

  const records = apiBooks.map((apiBook, index) => {
    const existing = existingBooks[index];
    return {
      ...apiToLocalBook(apiBook),
      typography: existing?.typography ?? null,
      originalFile: existing?.originalFile,
      lastChapterOrder: existing?.lastChapterOrder,
    };
  });

  await localDb.books.bulkPut(records);
}

export async function addLibraryBookToLocalDb(book: LibraryBook): Promise<void> {
  const existing = await localDb.books.get(book._id);
  await localDb.books.put({
    ...apiToLocalBook(book),
    typography: existing?.typography ?? null,
    originalFile: existing?.originalFile,
    lastChapterOrder: existing?.lastChapterOrder,
  });
}

export async function removeLibraryBookFromLocalDb(bookId: string): Promise<void> {
  await localDb.books.delete(bookId);
  await localDb.chapters.where("bookId").equals(bookId).delete();
}

export function libraryBooksChanged(a: LibraryBook[], b: LibraryBook[]): boolean {
  return libraryBooksSignature(a) !== libraryBooksSignature(b);
}

const LIBRARY_BOOK_FORMATS = ["epub", "fb2", "txt", "pdf", "mobi"] as const;

function normalizeLibraryBookFormat(format?: string | null): LibraryBook["format"] | undefined {
  if (!format) {
    return undefined;
  }

  return LIBRARY_BOOK_FORMATS.includes(format as (typeof LIBRARY_BOOK_FORMATS)[number])
    ? (format as LibraryBook["format"])
    : undefined;
}

export function libraryBookFromApiPayload(book: {
  _id?: string;
  id?: string;
  title?: string;
  authors?: string[];
  format?: string;
  coverAssetId?: string | null;
  totalChapters?: number;
  createdAt?: string | Date;
}): LibraryBook | null {
  const id = book._id ?? book.id;
  if (!id || !book.title) {
    return null;
  }

  const createdAt =
    book.createdAt instanceof Date
      ? book.createdAt.toISOString()
      : typeof book.createdAt === "string"
        ? book.createdAt
        : new Date().toISOString();

  return {
    _id: id,
    title: book.title,
    authors: book.authors ?? [],
    format: normalizeLibraryBookFormat(book.format),
    coverAssetId: book.coverAssetId ?? null,
    totalChapters: book.totalChapters,
    createdAt,
  };
}

let inflightLibraryFetch: Promise<{
  books: LibraryBook[];
  authRequired: boolean;
}> | null = null;

export function fetchLibraryBooksFromApi(): Promise<{
  books: LibraryBook[];
  authRequired: boolean;
}> {
  if (!inflightLibraryFetch) {
    inflightLibraryFetch = (async () => {
      const res = await fetch("/api/books?limit=100&view=list", { cache: "no-store" });

      if (res.status === 401) {
        return { books: [], authRequired: true };
      }

      if (!res.ok) {
        throw new Error("Failed to load books");
      }

      const json = (await res.json()) as { books?: LibraryBook[] };
      return {
        books: sortLibraryBooks(json.books ?? []),
        authRequired: false,
      };
    })().finally(() => {
      inflightLibraryFetch = null;
    });
  }

  return inflightLibraryFetch;
}
