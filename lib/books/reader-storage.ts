import { isBookIdUuid } from "@/lib/books/book-id";
import { BOOK_ORIGINAL_FONT_ID } from "@/lib/books/reading-fonts";
import type { ReadingTypographySettings } from "@/lib/books/reading-typography";
import { getDefaultBookFontId, normalizeReadingTypography } from "@/lib/books/reading-typography";

const LAST_BOOK_KEY = "bookified:lastBookId";
const RECENT_BOOKS_KEY = "bookified:recentBooks";
const FAVORITES_KEY = "bookified:favorites";
const PDF_VIEWER_SETTINGS_KEY = "bookified:pdfViewerSettings";
const READING_TYPOGRAPHY_SETTINGS_KEY = "bookified:readingTypographySettings";
export const READER_STORAGE_EVENT = "bookified:reader-storage-changed";

export type PdfViewerSettings = {
  fitWidth: boolean;
  zoom: number;
};

export const DEFAULT_PDF_VIEWER_SETTINGS: PdfViewerSettings = {
  fitWidth: false,
  zoom: 70,
};

const MIN_PDF_ZOOM = 50;
const MAX_PDF_ZOOM = 100;

const MAX_RECENT_BOOKS = 20;
const EMPTY_RECENT: RecentBookEntry[] = [];
const EMPTY_FAVORITES: string[] = [];

let cachedRecentRaw: string | null = null;
let cachedRecentSnapshot: RecentBookEntry[] = EMPTY_RECENT;
let cachedFavoritesRaw: string | null = null;
let cachedFavoritesSnapshot: string[] = EMPTY_FAVORITES;

export type ReaderPositionOptions = {
  chapterHref?: string | null;
  chapterOrder?: number | null;
};

export type RecentBookEntry = {
  bookId: string;
  readAt: number;
  chapterOrder: number;
};

export type ReaderBookmark = {
  id: string;
  chapterOrder: number;
  chapterTitle: string;
  scrollTop: number;
  createdAt: number;
};

export const BOOKMARK_SCROLL_TOLERANCE = 240;
export const BOOKMARK_VIEWPORT_RATIO = 1 / 3;

/** Document Y aligned with the reading anchor line (~⅓ viewport from top). */
export function getBookmarkAnchorScrollTop(scrollTop: number, viewportHeight: number): number {
  return Math.max(0, Math.round(scrollTop + viewportHeight * BOOKMARK_VIEWPORT_RATIO));
}

/** Scroll position so the stored anchor sits at ~⅓ viewport height. */
export function getBookmarkScrollTarget(anchorScrollTop: number, viewportHeight: number): number {
  return Math.max(0, Math.round(anchorScrollTop - viewportHeight * BOOKMARK_VIEWPORT_RATIO));
}

function chapterKey(bookId: string) {
  return `bookified:lastChapterOrder:${bookId}`;
}

function chapterScrollKey(bookId: string, chapterOrder: number) {
  return `bookified:chapterScroll:${bookId}:${chapterOrder}`;
}

function bookmarksKey(bookId: string) {
  return `bookified:bookmarks:${bookId}`;
}

const bookmarkSnapshots = new Map<string, { raw: string; list: ReaderBookmark[] }>();

function emitStorageChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(READER_STORAGE_EVENT));
}

function clampPdfZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PDF_VIEWER_SETTINGS.zoom;
  return Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, Math.round(value)));
}

const pdfSettingsSubscribers = new Set<() => void>();
let cachedPdfSettingsRaw: string | null = null;
let cachedPdfSettingsSnapshot: PdfViewerSettings = DEFAULT_PDF_VIEWER_SETTINGS;

function parsePdfViewerSettings(raw: string | null): PdfViewerSettings {
  if (!raw) return DEFAULT_PDF_VIEWER_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<PdfViewerSettings>;
    return {
      fitWidth: Boolean(parsed.fitWidth),
      zoom: clampPdfZoom(parsed.zoom ?? DEFAULT_PDF_VIEWER_SETTINGS.zoom),
    };
  } catch {
    return DEFAULT_PDF_VIEWER_SETTINGS;
  }
}

function invalidatePdfViewerSettingsCache() {
  cachedPdfSettingsRaw = null;
}

export function subscribePdfViewerSettings(listener: () => void): () => void {
  pdfSettingsSubscribers.add(listener);
  return () => pdfSettingsSubscribers.delete(listener);
}

export function getPdfViewerSettings(): PdfViewerSettings {
  return getPdfViewerSettingsSnapshot();
}

export function getPdfViewerSettingsSnapshot(): PdfViewerSettings {
  if (typeof window === "undefined") return DEFAULT_PDF_VIEWER_SETTINGS;

  const raw = localStorage.getItem(PDF_VIEWER_SETTINGS_KEY);
  const cacheKey = raw ?? "__default__";

  if (cacheKey === cachedPdfSettingsRaw) {
    return cachedPdfSettingsSnapshot;
  }

  cachedPdfSettingsRaw = cacheKey;
  cachedPdfSettingsSnapshot = parsePdfViewerSettings(raw);
  return cachedPdfSettingsSnapshot;
}

export function setPdfViewerSettings(settings: PdfViewerSettings): void {
  if (typeof window === "undefined") return;

  const normalized: PdfViewerSettings = {
    fitWidth: settings.fitWidth,
    zoom: clampPdfZoom(settings.zoom),
  };

  const serialized = JSON.stringify(normalized);
  localStorage.setItem(PDF_VIEWER_SETTINGS_KEY, serialized);
  cachedPdfSettingsRaw = serialized;
  cachedPdfSettingsSnapshot = normalized;
  pdfSettingsSubscribers.forEach((listener) => listener());
}

export type StoredReadingTypographySettings = Pick<
  ReadingTypographySettings,
  | "fontId"
  | "fontSize"
  | "lineHeight"
  | "letterSpacing"
  | "wordSpacing"
  | "textAlign"
  | "fontWeightBold"
> & {
  /** When true, user-selected font replaces the book's embedded font. */
  overrideBookFont?: boolean;
};

const readingTypographySubscribers = new Set<() => void>();
let cachedReadingTypographyRaw: string | null = null;
let cachedReadingTypographySnapshot: StoredReadingTypographySettings | null = null;

function parseReadingTypographySettings(
  raw: string | null,
): StoredReadingTypographySettings | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredReadingTypographySettings>;
    const normalized = normalizeReadingTypography(parsed);
    return {
      fontId: normalized.fontId,
      fontSize: normalized.fontSize,
      lineHeight: normalized.lineHeight,
      letterSpacing: normalized.letterSpacing,
      wordSpacing: normalized.wordSpacing,
      textAlign: normalized.textAlign,
      fontWeightBold: parsed.fontWeightBold === true,
      overrideBookFont: parsed.overrideBookFont === true,
    };
  } catch {
    return null;
  }
}

function invalidateReadingTypographySettingsCache() {
  cachedReadingTypographyRaw = null;
}

export function subscribeReadingTypographySettings(listener: () => void): () => void {
  readingTypographySubscribers.add(listener);
  return () => readingTypographySubscribers.delete(listener);
}

export function getReadingTypographySettingsSnapshot(): StoredReadingTypographySettings | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(READING_TYPOGRAPHY_SETTINGS_KEY);
  const cacheKey = raw ?? "__empty__";

  if (cacheKey === cachedReadingTypographyRaw) {
    return cachedReadingTypographySnapshot;
  }

  cachedReadingTypographyRaw = cacheKey;
  cachedReadingTypographySnapshot = parseReadingTypographySettings(raw);
  return cachedReadingTypographySnapshot;
}

export function setReadingTypographySettings(settings: StoredReadingTypographySettings): void {
  if (typeof window === "undefined") return;

  const normalized = normalizeReadingTypography(settings);
  const stored: StoredReadingTypographySettings = {
    fontId: normalized.fontId,
    fontSize: normalized.fontSize,
    lineHeight: normalized.lineHeight,
    letterSpacing: normalized.letterSpacing,
    wordSpacing: normalized.wordSpacing,
    textAlign: normalized.textAlign,
    fontWeightBold: normalized.fontWeightBold,
    overrideBookFont: settings.overrideBookFont === true,
  };

  const serialized = JSON.stringify(stored);
  localStorage.setItem(READING_TYPOGRAPHY_SETTINGS_KEY, serialized);
  cachedReadingTypographyRaw = serialized;
  cachedReadingTypographySnapshot = stored;
  readingTypographySubscribers.forEach((listener) => listener());
}

export function clearReadingTypographySettings(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(READING_TYPOGRAPHY_SETTINGS_KEY);
  cachedReadingTypographyRaw = "__empty__";
  cachedReadingTypographySnapshot = null;
  readingTypographySubscribers.forEach((listener) => listener());
}

export function mergeReadingTypographyWithStored(
  bookDefaults: ReadingTypographySettings,
  stored: StoredReadingTypographySettings | null,
): ReadingTypographySettings {
  const defaultFontId = getDefaultBookFontId(bookDefaults);
  const useBookOriginalFont =
    !stored ||
    stored.fontId === BOOK_ORIGINAL_FONT_ID ||
    (stored.overrideBookFont !== true && stored.fontId === defaultFontId);

  return normalizeReadingTypography({
    ...bookDefaults,
    ...(stored ?? {}),
    fontId: useBookOriginalFont ? BOOK_ORIGINAL_FONT_ID : (stored?.fontId ?? defaultFontId),
    ...(useBookOriginalFont
      ? {
          customFontFamily: bookDefaults.customFontFamily,
          customFontAssetHref: bookDefaults.customFontAssetHref,
        }
      : {
          customFontFamily: undefined,
          customFontAssetHref: undefined,
        }),
  });
}

function readRecentBooks(): RecentBookEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(RECENT_BOOKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentBookEntry[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.bookId === "string" &&
        typeof entry.readAt === "number" &&
        typeof entry.chapterOrder === "number",
    );
  } catch {
    return [];
  }
}

function invalidateReaderStorageCache() {
  cachedRecentRaw = null;
  cachedFavoritesRaw = null;
  invalidatePdfViewerSettingsCache();
  invalidateReadingTypographySettingsCache();
}

function writeRecentBooks(entries: RecentBookEntry[]) {
  if (typeof window === "undefined") return;
  invalidateReaderStorageCache();
  localStorage.setItem(RECENT_BOOKS_KEY, JSON.stringify(entries.slice(0, MAX_RECENT_BOOKS)));
}

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeFavorites(bookIds: string[]) {
  if (typeof window === "undefined") return;
  invalidateReaderStorageCache();
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(bookIds));
}

function touchRecentBook(bookId: string, chapterOrder: number) {
  const entries = readRecentBooks().filter((entry) => entry.bookId !== bookId);
  entries.unshift({ bookId, readAt: Date.now(), chapterOrder });
  writeRecentBooks(entries);
}

export function getLastBookId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_BOOK_KEY);
}

function pruneInvalidReaderBookIds(): void {
  if (typeof window === "undefined") return;

  const lastBookId = localStorage.getItem(LAST_BOOK_KEY);
  if (lastBookId && !isBookIdUuid(lastBookId)) {
    removeBookFromReaderStorage(lastBookId);
    localStorage.removeItem(LAST_BOOK_KEY);
  }

  const recent = readRecentBooks();
  const validRecent = recent.filter((entry) => isBookIdUuid(entry.bookId));
  if (validRecent.length !== recent.length) {
    writeRecentBooks(validRecent);
  }

  const favorites = readFavorites();
  const validFavorites = favorites.filter((id) => isBookIdUuid(id));
  if (validFavorites.length !== favorites.length) {
    writeFavorites(validFavorites);
  }
}

export function getReaderNavigationPath(): string {
  pruneInvalidReaderBookIds();

  const lastBookId = getLastBookId();
  if (lastBookId && isBookIdUuid(lastBookId)) {
    return `/reader/${lastBookId}`;
  }

  const recent = getRecentBooks();
  if (recent[0]?.bookId && isBookIdUuid(recent[0].bookId)) {
    return `/reader/${recent[0].bookId}`;
  }

  return "/";
}

export function getReaderNavigationPathSnapshot(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  migrateLegacyReaderStorage();
  return getReaderNavigationPath();
}

export function subscribeReaderNavigationPath(onStoreChange: () => void): () => void {
  window.addEventListener(READER_STORAGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(READER_STORAGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function getLastChapterOrder(bookId: string): number | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(chapterKey(bookId));
  if (!value) return null;
  const order = Number.parseInt(value, 10);
  return Number.isFinite(order) ? order : null;
}

export function getChapterScrollPosition(bookId: string, chapterOrder: number): number {
  if (typeof window === "undefined") return 0;

  const value = localStorage.getItem(chapterScrollKey(bookId, chapterOrder));
  if (!value) return 0;

  const scrollTop = Number.parseInt(value, 10);
  return Number.isFinite(scrollTop) && scrollTop >= 0 ? scrollTop : 0;
}

export function setChapterScrollPosition(
  bookId: string,
  chapterOrder: number,
  scrollTop: number,
): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    chapterScrollKey(bookId, chapterOrder),
    String(Math.max(0, Math.round(scrollTop))),
  );
}

function readBookmarks(bookId: string): ReaderBookmark[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(bookmarksKey(bookId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReaderBookmark[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry) =>
          entry &&
          typeof entry.id === "string" &&
          typeof entry.chapterOrder === "number" &&
          typeof entry.chapterTitle === "string" &&
          typeof entry.scrollTop === "number" &&
          typeof entry.createdAt === "number",
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeBookmarks(bookId: string, bookmarks: ReaderBookmark[]) {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(bookmarks);
  localStorage.setItem(bookmarksKey(bookId), serialized);
  bookmarkSnapshots.set(bookId, { raw: serialized, list: bookmarks });
  emitStorageChange();
}

function invalidateBookmarksCache(bookId: string) {
  bookmarkSnapshots.delete(bookId);
}

export function getReaderBookmarksSnapshot(bookId: string): ReaderBookmark[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(bookmarksKey(bookId)) ?? "[]";
  const cached = bookmarkSnapshots.get(bookId);
  if (cached?.raw === raw) return cached.list;

  const list = readBookmarks(bookId);
  bookmarkSnapshots.set(bookId, { raw, list });
  return list;
}

export function addReaderBookmark(
  bookId: string,
  data: Pick<ReaderBookmark, "chapterOrder" | "chapterTitle" | "scrollTop">,
): ReaderBookmark {
  const bookmarks = readBookmarks(bookId);
  const scrollTop = Math.max(0, Math.round(data.scrollTop));
  const existing = bookmarks.find(
    (bookmark) =>
      bookmark.chapterOrder === data.chapterOrder &&
      Math.abs(bookmark.scrollTop - scrollTop) < BOOKMARK_SCROLL_TOLERANCE,
  );

  if (existing) {
    existing.chapterTitle = data.chapterTitle;
    existing.createdAt = Date.now();
    writeBookmarks(bookId, bookmarks);
    return existing;
  }

  const bookmark: ReaderBookmark = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    chapterOrder: data.chapterOrder,
    chapterTitle: data.chapterTitle,
    scrollTop,
    createdAt: Date.now(),
  };

  bookmarks.unshift(bookmark);
  writeBookmarks(bookId, bookmarks);
  return bookmark;
}

export function removeReaderBookmark(bookId: string, bookmarkId: string): void {
  const bookmarks = readBookmarks(bookId).filter((bookmark) => bookmark.id !== bookmarkId);
  writeBookmarks(bookId, bookmarks);
}

export function findReaderBookmarkNear(
  bookId: string,
  chapterOrder: number,
  scrollTop: number,
): ReaderBookmark | undefined {
  return readBookmarks(bookId).find(
    (bookmark) =>
      bookmark.chapterOrder === chapterOrder &&
      Math.abs(bookmark.scrollTop - scrollTop) < BOOKMARK_SCROLL_TOLERANCE,
  );
}

export function hasReaderBookmarkNear(
  bookId: string,
  chapterOrder: number,
  scrollTop: number,
): boolean {
  return findReaderBookmarkNear(bookId, chapterOrder, scrollTop) != null;
}

export function toggleReaderBookmark(
  bookId: string,
  data: Pick<ReaderBookmark, "chapterOrder" | "chapterTitle" | "scrollTop">,
): { action: "added" | "removed"; bookmark?: ReaderBookmark } {
  const scrollTop = Math.max(0, Math.round(data.scrollTop));
  const existing = findReaderBookmarkNear(bookId, data.chapterOrder, scrollTop);

  if (existing) {
    removeReaderBookmark(bookId, existing.id);
    return { action: "removed" };
  }

  const bookmark = addReaderBookmark(bookId, { ...data, scrollTop });
  return { action: "added", bookmark };
}

export function getSavedReaderPosition(bookId: string): ReaderPositionOptions | undefined {
  const chapterOrder = getLastChapterOrder(bookId);
  if (chapterOrder == null || chapterOrder <= 0) {
    return undefined;
  }

  return { chapterOrder };
}

export function mergeReaderPosition(
  primary?: ReaderPositionOptions,
  fallback?: ReaderPositionOptions,
): ReaderPositionOptions | undefined {
  const chapterOrder = primary?.chapterOrder ?? fallback?.chapterOrder;
  const chapterHref = primary?.chapterHref ?? fallback?.chapterHref;

  if ((chapterOrder == null || chapterOrder <= 0) && !chapterHref) {
    return undefined;
  }

  return {
    chapterOrder: chapterOrder != null && chapterOrder > 0 ? chapterOrder : null,
    chapterHref: chapterHref ?? null,
  };
}

export function getRecentBooks(): RecentBookEntry[] {
  return readRecentBooks();
}

export function getRecentBooksSnapshot(): RecentBookEntry[] {
  if (typeof window === "undefined") return EMPTY_RECENT;

  migrateLegacyReaderStorage();

  const raw = localStorage.getItem(RECENT_BOOKS_KEY) ?? "[]";
  if (raw === cachedRecentRaw) return cachedRecentSnapshot;

  cachedRecentRaw = raw;
  const entries = readRecentBooks();
  cachedRecentSnapshot = entries.length === 0 ? EMPTY_RECENT : entries;
  return cachedRecentSnapshot;
}

export function migrateLegacyReaderStorage() {
  if (typeof window === "undefined") return;
  if (readRecentBooks().length > 0) return;

  const lastBookId = localStorage.getItem(LAST_BOOK_KEY);
  if (!lastBookId) return;

  const chapterOrder = getLastChapterOrder(lastBookId);
  if (chapterOrder === null) return;

  touchRecentBook(lastBookId, chapterOrder);
}

export function getFavoriteBookIds(): string[] {
  return readFavorites();
}

export function getFavoriteBookIdsSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY_FAVORITES;

  const raw = localStorage.getItem(FAVORITES_KEY) ?? "[]";
  if (raw === cachedFavoritesRaw) return cachedFavoritesSnapshot;

  cachedFavoritesRaw = raw;
  const ids = readFavorites();
  cachedFavoritesSnapshot = ids.length === 0 ? EMPTY_FAVORITES : ids;
  return cachedFavoritesSnapshot;
}

export function isFavoriteBook(bookId: string): boolean {
  return readFavorites().includes(bookId);
}

export function toggleFavoriteBook(bookId: string): boolean {
  const favorites = readFavorites();
  const index = favorites.indexOf(bookId);

  if (index >= 0) {
    favorites.splice(index, 1);
    writeFavorites(favorites);
    emitStorageChange();
    return false;
  }

  favorites.unshift(bookId);
  writeFavorites(favorites);
  emitStorageChange();
  return true;
}

export function getReadingProgress(bookId: string, totalChapters?: number): number {
  const order = getLastChapterOrder(bookId);
  if (!order || !totalChapters || totalChapters <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((order / totalChapters) * 100)));
}

export function setLastRead(bookId: string, chapterOrder: number) {
  if (typeof window === "undefined") return;
  invalidateReaderStorageCache();
  localStorage.setItem(LAST_BOOK_KEY, bookId);
  localStorage.setItem(chapterKey(bookId), String(chapterOrder));
  touchRecentBook(bookId, chapterOrder);
  emitStorageChange();

  void import("@/lib/db/localDb")
    .then(({ localDb }) => localDb.books.update(bookId, { lastChapterOrder: chapterOrder }))
    .catch(() => undefined);
}

export function removeBookFromReaderStorage(bookId: string) {
  if (typeof window === "undefined") return;

  if (localStorage.getItem(LAST_BOOK_KEY) === bookId) {
    localStorage.removeItem(LAST_BOOK_KEY);
  }

  localStorage.removeItem(chapterKey(bookId));

  const scrollPrefix = `bookified:chapterScroll:${bookId}:`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(scrollPrefix)) {
      localStorage.removeItem(key);
    }
  }

  const prefix = `bookified:highlights:${bookId}:`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  }

  writeRecentBooks(readRecentBooks().filter((entry) => entry.bookId !== bookId));
  writeFavorites(readFavorites().filter((id) => id !== bookId));
  localStorage.removeItem(bookmarksKey(bookId));
  invalidateBookmarksCache(bookId);
  emitStorageChange();
}

export function clearLastReadIfBook(bookId: string) {
  removeBookFromReaderStorage(bookId);
}

export function clearReaderSession() {
  if (typeof window === "undefined") return;
  invalidateReaderStorageCache();
  localStorage.removeItem(LAST_BOOK_KEY);
  emitStorageChange();
}
