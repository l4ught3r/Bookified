"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Grid3X3, List, Plus, RefreshCw, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  LibraryBooksView,
  type LibraryBookCardHandlers,
} from "@/components/bookified/library-books-view";
import { DeleteBookDialog } from "@/components/bookified/delete-book-dialog";
import { TopNavbar } from "@/components/bookified/top-navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibraryBooks } from "@/hooks/use-library-books";
import { toast } from "@/hooks/use-toast";
import {
  clearLastReadIfBook,
  getFavoriteBookIds,
  getReadingProgress,
  getRecentBooks,
  READER_STORAGE_EVENT,
  toggleFavoriteBook,
} from "@/lib/books/reader-storage";
import { Link } from "@/lib/i18n/navigation";
import { useBookStore } from "@/lib/store/useBookStore";
import { cn } from "@/lib/utils";

const filterKeys = ["all", "reading", "finished", "favorites", "notStarted"] as const;

type FilterKey = (typeof filterKeys)[number];

const DELETE_DIALOG_CLOSE_MS = 220;

export default function LibraryPage() {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { books, loading } = useLibraryBooks({ isAuthLoaded, isSignedIn: Boolean(isSignedIn) });
  const removeLibraryBook = useBookStore((state) => state.removeLibraryBook);
  const syncLibraryFromApi = useBookStore((state) => state.syncLibraryFromApi);
  const hydrateLibraryFromLocalDb = useBookStore((state) => state.hydrateLibraryFromLocalDb);
  const isGlobalSyncing = useBookStore((state) => state.isGlobalSyncing);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookPendingDelete, setBookPendingDelete] = useState<{
    id: string;
    title: string;
    author?: string;
    format?: string;
    coverAssetId?: string | null;
  } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [progressTick, setProgressTick] = useState(0);
  const clearPendingDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePendingDeleteClear = useCallback(() => {
    if (clearPendingDeleteTimeoutRef.current) {
      clearTimeout(clearPendingDeleteTimeoutRef.current);
    }
    clearPendingDeleteTimeoutRef.current = setTimeout(() => {
      setBookPendingDelete(null);
      clearPendingDeleteTimeoutRef.current = null;
    }, DELETE_DIALOG_CLOSE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (clearPendingDeleteTimeoutRef.current) {
        clearTimeout(clearPendingDeleteTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const refreshProgress = () => setProgressTick((tick) => tick + 1);
    window.addEventListener(READER_STORAGE_EVENT, refreshProgress);
    window.addEventListener("storage", refreshProgress);
    return () => {
      window.removeEventListener(READER_STORAGE_EVENT, refreshProgress);
      window.removeEventListener("storage", refreshProgress);
    };
  }, []);

  useEffect(() => {
    const refreshFavorites = () => setFavoriteIds(getFavoriteBookIds());
    refreshFavorites();
    window.addEventListener(READER_STORAGE_EVENT, refreshFavorites);
    window.addEventListener("storage", refreshFavorites);
    return () => {
      window.removeEventListener(READER_STORAGE_EVENT, refreshFavorites);
      window.removeEventListener("storage", refreshFavorites);
    };
  }, []);

  const requestDeleteBook = useCallback(
    (bookId: string, title: string, author?: string, format?: string, coverAssetId?: string | null) => {
      if (clearPendingDeleteTimeoutRef.current) {
        clearTimeout(clearPendingDeleteTimeoutRef.current);
        clearPendingDeleteTimeoutRef.current = null;
      }
      setBookPendingDelete({ id: bookId, title, author, format, coverAssetId });
      setDeleteDialogOpen(true);
    },
    [],
  );

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      setDeleteDialogOpen(open);
      if (!open && !deletingId) {
        schedulePendingDeleteClear();
      }
    },
    [deletingId, schedulePendingDeleteClear],
  );

  const confirmDeleteBook = async () => {
    if (!bookPendingDelete) return;

    const { id: bookId } = bookPendingDelete;
    setDeletingId(bookId);

    try {
      const res = await fetch(`/api/books/${encodeURIComponent(bookId)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || t("deleteFailed"));
      }

      clearLastReadIfBook(bookId);
      await removeLibraryBook(bookId);
      setDeleteDialogOpen(false);
      schedulePendingDeleteClear();

      toast({
        title: t("deleteSuccess"),
        description: t("deleteSuccessDescription"),
      });
    } catch (error) {
      toast({
        title: t("deleteFailed"),
        description: error instanceof Error ? error.message : tCommon("tryLater"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleFavorite = useCallback((bookId: string) => {
    toggleFavoriteBook(bookId);
    setFavoriteIds(getFavoriteBookIds());
  }, []);

  const isRefreshBusy = isRefreshing || isGlobalSyncing;

  const handleRefreshLibrary = useCallback(async () => {
    if (isRefreshBusy || !isAuthLoaded || loading) {
      return;
    }

    setIsRefreshing(true);

    try {
      if (isSignedIn) {
        const result = await syncLibraryFromApi();

        if (result.ok) {
          toast({
            title: t("syncUpdated"),
            description: t("syncUpdatedDescription"),
          });
          return;
        }

        if (result.authRequired) {
          toast({
            title: t("syncUnavailable"),
            description: result.error ?? tCommon("signIn"),
            variant: "destructive",
          });
          return;
        }

        if (result.offline) {
          toast({
            title: t("offlineNeedInternet"),
            variant: "destructive",
          });
          return;
        }

        toast({
          title: t("syncFailed"),
          description: result.error ?? tCommon("tryLater"),
          variant: "destructive",
        });
        return;
      }

      await hydrateLibraryFromLocalDb();
    } finally {
      setIsRefreshing(false);
    }
  }, [
    hydrateLibraryFromLocalDb,
    isAuthLoaded,
    isRefreshBusy,
    isSignedIn,
    loading,
    syncLibraryFromApi,
    t,
    tCommon,
  ]);

  const filteredBooks = useMemo(() => {
    void progressTick;
    const q = searchQuery.trim().toLowerCase();
    const recentIds = new Set(getRecentBooks().map((entry) => entry.bookId));
    const favoriteSet = new Set(favoriteIds);

    return books.filter((book) => {
      const author = book.authors?.[0] ?? "";
      const matchesSearch =
        !q || book.title.toLowerCase().includes(q) || author.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const progress = getReadingProgress(book._id, book.totalChapters);
      const hasStarted = recentIds.has(book._id) || progress > 0;

      switch (activeFilter) {
        case "reading":
          return hasStarted && progress < 100;
        case "finished":
          return book.totalChapters ? progress >= 100 : false;
        case "favorites":
          return favoriteSet.has(book._id);
        case "notStarted":
          return !hasStarted;
        default:
          return true;
      }
    });
  }, [books, searchQuery, activeFilter, favoriteIds, progressTick]);

  const progressByBookId = useMemo(() => {
    void progressTick;
    const map = new Map<string, number>();
    for (const book of books) {
      map.set(book._id, getReadingProgress(book._id, book.totalChapters));
    }
    return map;
  }, [books, progressTick]);

  const cardHandlers = useMemo<LibraryBookCardHandlers>(
    () => ({
      isFavorite: (bookId) => favoriteIds.includes(bookId),
      isDeleting: (bookId) => deletingId === bookId,
      onToggleFavorite: handleToggleFavorite,
      onDelete: requestDeleteBook,
    }),
    [favoriteIds, deletingId, handleToggleFavorite, requestDeleteBook],
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopNavbar />

      <main
        id="main-content"
        className="surface-library min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-5 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[calc(5rem+env(safe-area-inset-bottom))] [scrollbar-gutter:stable] sm:py-6 sm:pl-4 sm:pr-4 md:pl-8 md:pr-8 lg:px-12 lg:pb-6"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-3 sm:mb-4">
            <h1 className="type-page-title">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              {loading ? t("loadingBooks") : t("booksCount", { count: books.length })}
            </p>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md md:flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="library-search"
                aria-label={t("searchLabel")}
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl border-border/50 bg-card pl-10 focus-visible:border-border/50 focus-visible:ring-0"
              />
            </div>

            <div className="flex w-full items-center justify-start gap-2 md:w-auto md:justify-end">
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center rounded-xl bg-secondary p-1"
                  role="group"
                  aria-label={t("viewMode")}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    aria-label={t("gridView")}
                    aria-pressed={viewMode === "grid"}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      viewMode === "grid"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Grid3X3 className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    aria-label={t("listView")}
                    aria-pressed={viewMode === "list"}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      viewMode === "list"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <List className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleRefreshLibrary()}
                  disabled={isRefreshBusy || loading}
                  aria-label={t("refreshLibrary")}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  )}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", isRefreshBusy && "animate-spin")}
                    aria-hidden
                  />
                </button>
              </div>
            </div>
          </div>

          <div
            className="-mx-3 mb-5 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:mb-6 sm:px-0 [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label={t("filtersLabel")}
          >
            <span className="mr-1 hidden shrink-0 self-center text-xs font-medium uppercase tracking-wider text-muted-foreground sm:inline">
              {t("filtersLabel")}
            </span>
            {filterKeys.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={activeFilter === key}
                onClick={() => setActiveFilter(key)}
                className={cn(
                  "min-h-10 shrink-0 snap-start whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-11 sm:px-3.5 sm:py-2.5",
                  activeFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {t(`filters.${key}`)}
              </button>
            ))}
          </div>

          <LibraryBooksView
            key={viewMode}
            books={filteredBooks}
            viewMode={viewMode}
            progressByBookId={progressByBookId}
            handlers={cardHandlers}
          />

          {!loading && filteredBooks.length === 0 && (
            <div className="empty-state-panel mx-auto max-w-md py-14">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                {books.length === 0 ? t("emptyAddBook") : t("emptyTitle")}
              </h2>
              {books.length === 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t("emptyAddBookDescription")}
                </p>
              ) : null}
              {books.length === 0 ? (
                <Button asChild className="mt-6 rounded-lg">
                  <Link href="/add-book">
                    <Plus className="h-4 w-4" aria-hidden />
                    {tNav("addBook")}
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-6 rounded-lg"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("all");
                  }}
                >
                  {t("resetFilters")}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      <DeleteBookDialog
        open={deleteDialogOpen}
        bookId={bookPendingDelete?.id ?? null}
        bookTitle={bookPendingDelete?.title ?? null}
        bookAuthor={bookPendingDelete?.author ?? null}
        bookFormat={bookPendingDelete?.format ?? null}
        coverAssetId={bookPendingDelete?.coverAssetId ?? null}
        isDeleting={Boolean(bookPendingDelete && deletingId === bookPendingDelete.id)}
        onOpenChange={handleDeleteDialogOpenChange}
        onConfirm={() => void confirmDeleteBook()}
      />
    </div>
  );
}
