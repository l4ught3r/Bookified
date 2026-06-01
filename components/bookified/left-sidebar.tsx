"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Heart,
  PanelLeftClose,
  Search,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getFavoriteBookIdsSnapshot,
  getReadingProgress,
  getRecentBooksSnapshot,
  READER_STORAGE_EVENT,
} from "@/lib/books/reader-storage";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { useIsMobileLayout } from "@/hooks/use-media-query";
import { useRouter } from "@/lib/i18n/navigation";
import { useBookStore } from "@/lib/store/useBookStore";
import { cn } from "@/lib/utils";

type ChapterSummary = {
  order: number;
  title: string;
};

type LibraryBook = {
  _id: string;
  title: string;
  authors?: string[];
  coverAssetId?: string | null;
  totalChapters?: number;
};

interface LeftSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  bookId?: string;
  bookTitle?: string;
  chapters?: ChapterSummary[];
  currentChapterOrder?: number;
  onChapterSelect?: (order: number) => void;
  tocTitle?: string;
}

function subscribeReaderStorage(onStoreChange: () => void) {
  window.addEventListener(READER_STORAGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(READER_STORAGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function LeftSidebar({ isOpen, onToggle, bookId, chapters = [] }: LeftSidebarProps) {
  const t = useTranslations("reader");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const isMobileLayout = useIsMobileLayout();
  const showMobileOverlay = isMobileLayout && isOpen;

  useLockBodyScroll(showMobileOverlay);

  useEffect(() => {
    if (!showMobileOverlay) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMobileOverlay, onToggle]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const libraryBooks = useBookStore((state) => state.libraryBooks);
  const recentEntries = useSyncExternalStore(
    subscribeReaderStorage,
    getRecentBooksSnapshot,
    getRecentBooksSnapshot,
  );
  const favoriteIds = useSyncExternalStore(
    subscribeReaderStorage,
    getFavoriteBookIdsSnapshot,
    getFavoriteBookIdsSnapshot,
  );

  useEffect(() => {
    if (useBookStore.getState().libraryBooks.length > 0) {
      return;
    }

    void useBookStore.getState().hydrateLibraryFromLocalDb();
  }, []);

  const booksById = useMemo(
    () => new Map(libraryBooks.map((book) => [book._id, book])),
    [libraryBooks],
  );

  const sortedBooks = useMemo(
    () => [...libraryBooks].sort((a, b) => a.title.localeCompare(b.title, locale)),
    [libraryBooks, locale],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];

    return sortedBooks.filter(
      (book) =>
        book.title.toLowerCase().includes(normalizedSearch) ||
        book.authors?.some((author) => author.toLowerCase().includes(normalizedSearch)),
    );
  }, [normalizedSearch, sortedBooks]);

  const showSearchResults = searchFocused && normalizedSearch.length > 0;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleBookSelect = (selectedBookId: string) => {
    setSearchQuery("");
    setSearchFocused(false);
    if (selectedBookId !== bookId) {
      router.push(`/reader/${selectedBookId}`);
    }
  };

  const recentBooks = useMemo(() => {
    return recentEntries
      .map((entry) => {
        const book = booksById.get(entry.bookId);
        if (!book) return null;

        return {
          book,
          progress: getReadingProgress(book._id, book.totalChapters),
          active: book._id === bookId,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [recentEntries, booksById, bookId]);

  const favoriteBooks = useMemo(() => {
    return favoriteIds
      .map((id) => booksById.get(id))
      .filter((book): book is LibraryBook => Boolean(book))
      .map((book) => ({
        book,
        active: book._id === bookId,
        progress: getReadingProgress(book._id, book.totalChapters),
      }));
  }, [favoriteIds, booksById, bookId]);

  const favoriteCount = favoriteBooks.length;
  const [favoritesUi, setFavoritesUi] = useState({
    count: favoriteCount,
    expanded: favoriteCount > 0,
  });

  if (favoritesUi.count !== favoriteCount) {
    setFavoritesUi({ count: favoriteCount, expanded: favoriteCount > 0 });
  }

  const favoritesExpanded = favoritesUi.expanded;

  return (
    <>
      {showMobileOverlay ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
          aria-label={t("hideLibrary")}
          onClick={onToggle}
        />
      ) : null}

      <aside
        className={cn(
          "relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border/50 bg-card",
          isMobileLayout
            ? isOpen
              ? "fixed inset-y-0 left-0 z-50 w-[min(100vw,320px)] shadow-xl lg:static lg:z-auto lg:w-[280px] lg:shadow-none"
              : "w-0 border-0 lg:w-11 lg:border-r"
            : isOpen
              ? "w-[280px]"
              : "w-11",
        )}
        aria-label={t("showLibrary")}
        aria-hidden={isMobileLayout && !isOpen ? true : undefined}
      >
        {isOpen ? (
          <div
            className={cn(
              "absolute inset-0 flex flex-col",
              isMobileLayout ? "w-[min(100vw,320px)] lg:w-[280px]" : "w-[280px]",
            )}
          >
          <div className="relative z-20 shrink-0 p-4 pb-0">
            <div ref={searchContainerRef} className="relative">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setSearchFocused(false);
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder={t("searchPlaceholder")}
                    aria-label={t("searchBooks")}
                    aria-expanded={showSearchResults}
                    aria-controls="sidebar-book-search-results"
                    className="h-11 rounded-xl border-border/50 bg-secondary/50 pl-9 text-base placeholder:text-muted-foreground focus-visible:border-border/50 focus-visible:ring-0"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  aria-label={t("hideLibrary")}
                  className="h-11 w-11 shrink-0 rounded-xl"
                >
                  <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              {showSearchResults && (
                <div
                  id="sidebar-book-search-results"
                  className="absolute inset-x-0 top-[calc(100%+8px)] overflow-hidden rounded-xl border border-border/50 bg-popover shadow-lg"
                >
                  <div className="max-h-[280px] overflow-y-auto p-1">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                        {t("searchEmpty")}
                      </p>
                    ) : (
                      searchResults.map((book) => (
                        <button
                          key={book._id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleBookSelect(book._id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary",
                            book._id === bookId && "bg-primary/10",
                          )}
                        >
                          <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded-sm bg-secondary">
                            {book.coverAssetId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/books/${book._id}/assets/${book.coverAssetId}`}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <BookOpen className="h-4 w-4 text-muted-foreground/60" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{book.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {book.authors?.join(", ") ?? tCommon("unknownAuthor")}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
            <Section
              title={t("recent")}
              icon={<Clock className="h-4 w-4" aria-hidden />}
              expanded={recentExpanded}
              onToggle={() => setRecentExpanded(!recentExpanded)}
              className={chapters.length > 0 ? "mt-0" : undefined}
            >
              <div className="space-y-2">
                {recentBooks.length === 0 ? (
                  <EmptySectionMessage icon={Clock} text={t("recentEmpty")} />
                ) : (
                  recentBooks.map(({ book, progress, active }) => (
                    <SidebarBookCard
                      key={book._id}
                      book={book}
                      active={active}
                      progress={progress}
                      onSelect={handleBookSelect}
                      openLabel={t("openBook", { title: book.title })}
                      unknownAuthor={tCommon("unknownAuthor")}
                    />
                  ))
                )}
              </div>
            </Section>

            <Section
              title={t("favorites")}
              icon={<Heart className="h-4 w-4" aria-hidden />}
              expanded={favoritesExpanded}
              onToggle={() =>
                setFavoritesUi((prev) => ({ ...prev, expanded: !prev.expanded }))
              }
              className="mt-4"
            >
              <div className="space-y-2">
                {favoriteBooks.length === 0 ? (
                  <EmptySectionMessage icon={Heart} text={t("favoritesEmpty")} />
                ) : (
                  favoriteBooks.map(({ book, progress, active }) => (
                    <SidebarBookCard
                      key={book._id}
                      book={book}
                      active={active}
                      progress={progress}
                      onSelect={handleBookSelect}
                      openLabel={t("openBook", { title: book.title })}
                      unknownAuthor={tCommon("unknownAuthor")}
                    />
                  ))
                )}
              </div>
            </Section>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 hidden w-11 flex-col items-center gap-3 py-4 lg:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-label={t("showLibrary")}
            className="h-11 w-11 rounded-xl"
          >
            <PanelLeftClose className="h-4 w-4 rotate-180 text-muted-foreground" />
          </Button>
          <BookOpen className="h-4 w-4 text-muted-foreground/60" aria-hidden />
        </div>
      )}
      </aside>
    </>
  );
}

function Section({
  title,
  icon,
  expanded,
  onToggle,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full min-h-11 items-center justify-between py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden />
        )}
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function EmptySectionMessage({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="rounded-sm bg-secondary/40 px-3 py-4 text-center">
      <Icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function SidebarBookCard({
  book,
  active,
  progress,
  onSelect,
  openLabel,
  unknownAuthor,
}: {
  book: LibraryBook;
  active: boolean;
  progress: number;
  onSelect: (bookId: string) => void;
  openLabel: string;
  unknownAuthor: string;
}) {
  const coverUrl = book.coverAssetId ? `/api/books/${book._id}/assets/${book.coverAssetId}` : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(book._id)}
      aria-label={openLabel}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-sm p-2 text-left transition-colors duration-300",
        active
          ? "border border-secondary/50 bg-primary/10 shadow-sm hover:bg-primary/15"
          : "hover:bg-secondary hover:shadow-sm",
      )}
    >
      <div className="relative h-16 w-12 shrink-0 self-center overflow-hidden rounded-[15%] shadow-md">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <BookOpen className="h-5 w-5 text-muted-foreground/60" aria-hidden />
          </div>
        )}
        {active ? (
          <div
            className="absolute inset-0 bg-linear-to-t from-primary/30 to-transparent"
            aria-hidden
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="line-clamp-2 max-w-35 text-sm font-semibold leading-tight tracking-tight">
          {book.title}
        </span>
        <span className="truncate text-xs text-muted-foreground/80">
          {book.authors?.join(", ") ?? unknownAuthor}
        </span>

        <div className="flex items-center gap-2 pr-2">
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="absolute inset-y-0 left-0 origin-left rounded-full bg-primary/70 transition-transform duration-500"
              style={{ transform: `scaleX(${progress / 100})`, width: "100%" }}
            />
          </div>
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
            {progress}%
          </span>
        </div>
      </div>
    </button>
  );
}
