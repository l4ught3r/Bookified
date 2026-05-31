import { create } from "zustand";
import {
  addLibraryBookToLocalDb,
  fetchLibraryBooksFromApi,
  libraryBooksChanged,
  loadLibraryBooksFromLocalDb,
  removeLibraryBookFromLocalDb,
  sortLibraryBooks,
  syncLibraryBooksToLocalDb,
  type LibraryBook,
} from "@/lib/books/library-offline";
import {
  mergeReaderPosition,
  setLastRead,
  type ReaderPositionOptions,
} from "@/lib/books/reader-storage";
import type { ReadingTypographySettings } from "@/lib/books/reading-typography";
import type { TocItem } from "@/lib/db/types";
import { localDb, type LocalBook, type LocalChapter } from "@/lib/db/localDb";

export const COVER_CHAPTER_ID = "__cover__";

export type BookChapter = {
  id: string;
  title: string;
  href: string;
  order: number;
  wordCount: number;
  content?: string;
};

export type ReaderChapterInput = {
  id: string;
  title: string;
  href: string;
  order: number;
  wordCount: number;
  content: string;
};

export type CachedBookMeta = {
  _id: string;
  title: string;
  authors?: string[];
  format?: "epub" | "fb2" | "txt" | "pdf" | "mobi";
  totalChapters?: number;
  coverAssetId?: string | null;
  coverUrl?: string | null;
  readingTypography?: ReadingTypographySettings | null;
  toc?: TocItem[];
};

type CachedBookEntry = {
  chapters: BookChapter[];
  currentChapterIndex: number;
  book: CachedBookMeta;
};

type InitBookResult = {
  loaded: boolean;
  book: CachedBookMeta | null;
};

export type { ReaderPositionOptions };

type SyncLibraryResult =
  | { ok: true }
  | { ok: false; authRequired?: boolean; offline?: boolean; error?: string };

type BookStoreState = {
  bookId: string | null;
  chapters: BookChapter[];
  currentChapterIndex: number;
  isInitialLoading: boolean;
  isGlobalSyncing: boolean;
  libraryBooks: LibraryBook[];
  cachedBooks: Record<string, CachedBookEntry>;
  initBook: (bookId: string, position?: ReaderPositionOptions) => Promise<InitBookResult>;
  saveBookToOffline: (
    book: CachedBookMeta,
    chapters: ReaderChapterInput[],
    position?: ReaderPositionOptions,
  ) => Promise<void>;
  setGlobalSyncing: (value: boolean) => void;
  setLibraryBooks: (books: LibraryBook[]) => void;
  hydrateLibraryFromLocalDb: () => Promise<LibraryBook[]>;
  revalidateLibraryInBackground: () => Promise<void>;
  syncLibraryFromApi: () => Promise<SyncLibraryResult>;
  addLibraryBook: (book: LibraryBook) => Promise<void>;
  removeLibraryBook: (bookId: string) => Promise<void>;
  nextChapter: () => void;
  prevChapter: () => void;
  setCurrentChapterIndex: (index: number) => void;
  reset: () => void;
};

const COVER_PLACEHOLDER: BookChapter = {
  id: COVER_CHAPTER_ID,
  title: "",
  href: "",
  order: 0,
  wordCount: 0,
};

const activeInitialState = {
  bookId: null as string | null,
  chapters: [] as BookChapter[],
  currentChapterIndex: 0,
  isInitialLoading: true,
};

function resolveInitialChapterIndex(
  chapters: BookChapter[],
  position?: ReaderPositionOptions,
): number {
  if (position?.chapterOrder != null && position.chapterOrder > 0) {
    const byOrder = chapters.findIndex(
      (chapter) => chapter.id !== COVER_CHAPTER_ID && chapter.order === position.chapterOrder,
    );
    if (byOrder >= 0) {
      return byOrder;
    }
  }

  if (position?.chapterHref) {
    const normalizedHref = position.chapterHref.replace(/\\/g, "/").replace(/^\/+/, "");
    const matchIndex = chapters.findIndex((chapter) => {
      if (chapter.id === COVER_CHAPTER_ID) return false;
      const href = chapter.href.replace(/\\/g, "/").replace(/^\/+/, "");
      return href === normalizedHref;
    });

    if (matchIndex >= 0) {
      return matchIndex;
    }
  }

  return 0;
}

function firstContentChapterIndex(chapters: BookChapter[]): number {
  return chapters[0]?.id === COVER_CHAPTER_ID ? 1 : 0;
}

function chaptersWithCover(chapters: BookChapter[]): BookChapter[] {
  if (chapters[0]?.id === COVER_CHAPTER_ID) {
    return chapters;
  }
  return [COVER_PLACEHOLDER, ...chapters];
}

function localBookToMeta(local: LocalBook): CachedBookMeta {
  return {
    _id: local.id,
    title: local.title,
    authors: local.authors ? local.authors.split(", ").filter(Boolean) : [],
    format: local.format as CachedBookMeta["format"],
    totalChapters: local.totalChapters,
    coverAssetId: local.coverAssetId ?? null,
    coverUrl: local.coverUrl || null,
    readingTypography: local.typography ?? null,
  };
}

function metaToLocalBook(book: CachedBookMeta): LocalBook {
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

function readerChaptersToStore(chapters: ReaderChapterInput[]): BookChapter[] {
  return [...chapters]
    .sort((a, b) => a.order - b.order)
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      href: chapter.href,
      order: chapter.order,
      wordCount: chapter.wordCount,
      content: chapter.content,
    }));
}

function localChaptersToStore(chapters: LocalChapter[]): BookChapter[] {
  return chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    href: chapter.href,
    order: chapter.order,
    wordCount: chapter.wordCount,
    content: chapter.content,
  }));
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

function updateCachedChapterIndex(
  bookId: string | null,
  index: number,
  get: () => BookStoreState,
  set: (
    partial: Partial<BookStoreState> | ((state: BookStoreState) => Partial<BookStoreState>),
  ) => void,
) {
  if (!bookId) return;

  const chapter = get().chapters[index];
  if (chapter && chapter.id !== COVER_CHAPTER_ID) {
    setLastRead(bookId, chapter.order);
  }

  const cached = get().cachedBooks[bookId];
  if (cached) {
    set({
      currentChapterIndex: index,
      cachedBooks: {
        ...get().cachedBooks,
        [bookId]: {
          ...cached,
          currentChapterIndex: index,
        },
      },
    });
    return;
  }

  set({ currentChapterIndex: index });
}

function applyLoadedBook(
  bookId: string,
  book: CachedBookMeta,
  chapters: BookChapter[],
  currentChapterIndex: number,
  set: (
    partial: Partial<BookStoreState> | ((state: BookStoreState) => Partial<BookStoreState>),
  ) => void,
) {
  set((state) => ({
    bookId,
    chapters,
    currentChapterIndex,
    isInitialLoading: false,
    cachedBooks: {
      ...state.cachedBooks,
      [bookId]: {
        chapters,
        currentChapterIndex,
        book,
      },
    },
  }));
}

export const useBookStore = create<BookStoreState>((set, get) => ({
  ...activeInitialState,
  cachedBooks: {},
  isGlobalSyncing: false,
  libraryBooks: [],

  setGlobalSyncing: (value) => set({ isGlobalSyncing: value }),

  setLibraryBooks: (books) => set({ libraryBooks: sortLibraryBooks(books) }),

  hydrateLibraryFromLocalDb: async () => {
    const localBooks = await loadLibraryBooksFromLocalDb();
    set({ libraryBooks: localBooks });
    return localBooks;
  },

  revalidateLibraryInBackground: async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    try {
      const { books: apiBooks, authRequired } = await fetchLibraryBooksFromApi();
      if (authRequired) {
        return;
      }

      await syncLibraryBooksToLocalDb(apiBooks);
      const sorted = sortLibraryBooks(apiBooks);
      if (libraryBooksChanged(get().libraryBooks, sorted)) {
        set({ libraryBooks: sorted });
      }
    } catch {
      // Background revalidation fails silently; stale local data stays visible.
    }
  },

  syncLibraryFromApi: async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { ok: false, offline: true, error: "Нет подключения к интернету" };
    }

    set({ isGlobalSyncing: true });

    try {
      const { books: apiBooks, authRequired } = await fetchLibraryBooksFromApi();

      if (authRequired) {
        return {
          ok: false,
          authRequired: true,
          error: "Войдите, чтобы синхронизировать библиотеку",
        };
      }

      await syncLibraryBooksToLocalDb(apiBooks);
      set({ libraryBooks: sortLibraryBooks(apiBooks) });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Не удалось синхронизировать библиотеку",
      };
    } finally {
      set({ isGlobalSyncing: false });
    }
  },

  addLibraryBook: async (book) => {
    await addLibraryBookToLocalDb(book);
    set((state) => ({
      libraryBooks: sortLibraryBooks([
        book,
        ...state.libraryBooks.filter((item) => item._id !== book._id),
      ]),
    }));
  },

  removeLibraryBook: async (bookId) => {
    await removeLibraryBookFromLocalDb(bookId);
    set((state) => ({
      libraryBooks: state.libraryBooks.filter((book) => book._id !== bookId),
    }));
  },

  reset: () =>
    set((state) => ({
      ...state,
      ...activeInitialState,
    })),

  initBook: async (bookId, position) => {
    const sessionCached = get().cachedBooks[bookId];
    if (sessionCached) {
      const currentChapterIndex = position
        ? resolveInitialChapterIndex(sessionCached.chapters, position)
        : sessionCached.currentChapterIndex;

      set({
        bookId,
        chapters: sessionCached.chapters,
        currentChapterIndex,
        isInitialLoading: false,
        cachedBooks: {
          ...get().cachedBooks,
          [bookId]: {
            ...sessionCached,
            currentChapterIndex,
          },
        },
      });
      return { loaded: true, book: sessionCached.book };
    }

    const localBook = await localDb.books.get(bookId);
    const offlinePosition = localBook?.lastChapterOrder
      ? { chapterOrder: localBook.lastChapterOrder }
      : undefined;
    const effectivePosition = mergeReaderPosition(position, offlinePosition);

    if (localBook) {
      const localChapters = await localDb.chapters.where("bookId").equals(bookId).sortBy("order");

      const book = localBookToMeta(localBook);

      if (localChapters.length > 0) {
        const storeChapters = chaptersWithCover(localChaptersToStore(localChapters));
        const currentChapterIndex = resolveInitialChapterIndex(storeChapters, effectivePosition);

        applyLoadedBook(bookId, book, storeChapters, currentChapterIndex, set);
        return { loaded: true, book };
      }

      if (book.format === "pdf") {
        set((state) => ({
          bookId,
          chapters: [],
          currentChapterIndex: 0,
          isInitialLoading: false,
          cachedBooks: {
            ...state.cachedBooks,
            [bookId]: {
              chapters: [],
              currentChapterIndex: 0,
              book,
            },
          },
        }));
        return { loaded: true, book };
      }
    }

    set({
      bookId,
      chapters: [],
      currentChapterIndex: 0,
      isInitialLoading: true,
    });

    return { loaded: false, book: null };
  },

  saveBookToOffline: async (book, chapters, position) => {
    const localChapters = readerChaptersToLocal(book._id, chapters);
    const storeChapters = chaptersWithCover(readerChaptersToStore(chapters));
    const currentChapterIndex = resolveInitialChapterIndex(storeChapters, position);
    const currentChapter = storeChapters[currentChapterIndex];

    await localDb.books.put({
      ...metaToLocalBook(book),
      lastChapterOrder:
        currentChapter && currentChapter.id !== COVER_CHAPTER_ID
          ? currentChapter.order
          : (position?.chapterOrder ?? undefined),
    });
    await localDb.chapters.bulkPut(localChapters);

    applyLoadedBook(book._id, book, storeChapters, currentChapterIndex, set);
  },

  nextChapter: () => {
    const { bookId, chapters, currentChapterIndex } = get();
    if (currentChapterIndex >= chapters.length - 1) {
      return;
    }

    updateCachedChapterIndex(bookId, currentChapterIndex + 1, get, set);
  },

  prevChapter: () => {
    const { bookId, chapters, currentChapterIndex } = get();
    const minIndex = firstContentChapterIndex(chapters);
    if (currentChapterIndex <= minIndex) {
      return;
    }

    updateCachedChapterIndex(bookId, currentChapterIndex - 1, get, set);
  },

  setCurrentChapterIndex: (index) => {
    const { bookId, chapters } = get();
    if (index < 0 || index >= chapters.length) {
      return;
    }

    updateCachedChapterIndex(bookId, index, get, set);
  },
}));
