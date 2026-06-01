"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { AISidebar } from "@/components/bookified/ai-sidebar";
import { BookCoverView } from "@/components/bookified/book-cover-view";
import { LeftSidebar } from "@/components/bookified/left-sidebar";
import { ReadingArea } from "@/components/bookified/reading-area";
import { TopNavbar } from "@/components/bookified/top-navbar";
import { ReadingFontsProvider } from "@/components/providers/reading-fonts-provider";
import { Button } from "@/components/ui/button";
import { useIsMobileLayout } from "@/hooks/use-media-query";
import type { AiChatLocale } from "@/lib/ai/book-context";
import { isBookIdUuid } from "@/lib/books/book-id";
import {
  buildNavigationDisplayItems,
  toNavigationItemInput,
  type NavigationKindLabels,
} from "@/lib/books/navigation-labels";
import {
  clearLastReadIfBook,
  getLastChapterOrder,
  getSavedReaderPosition,
  setLastRead,
} from "@/lib/books/reader-storage";
import { buildTocHrefTitleMap } from "@/lib/books/toc-titles";
import { Link, useRouter } from "@/lib/i18n/navigation";
import {
  COVER_CHAPTER_ID,
  useBookStore,
  type CachedBookMeta,
  type ReaderChapterInput,
} from "@/lib/store/useBookStore";
import { cn } from "@/lib/utils";

const PdfReadingArea = dynamic(
  () => import("@/components/bookified/pdf-reading-area").then((mod) => mod.PdfReadingArea),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-reading-bg text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <p className="text-sm">Загрузка PDF…</p>
      </div>
    ),
  },
);

type ReaderBookMeta = CachedBookMeta;

type ChapterSummary = {
  order: number;
  title: string;
};

function applySavedChapterOrder(bookId: string, savedOrder: number | null) {
  if (savedOrder == null || savedOrder <= 0) {
    return;
  }

  const { chapters, currentChapterIndex, setCurrentChapterIndex } = useBookStore.getState();
  if (chapters.length === 0) {
    return;
  }

  const savedIndex = chapters.findIndex(
    (chapter) => chapter.id !== COVER_CHAPTER_ID && chapter.order === savedOrder,
  );

  if (savedIndex >= 0 && savedIndex !== currentChapterIndex) {
    setCurrentChapterIndex(savedIndex);
  }
}

interface ReaderViewProps {
  bookId: string;
}

function ReaderLoadingScreen({ title }: { title?: string }) {
  const t = useTranslations("reader");

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-reading-bg px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-border/40 bg-card shadow-sm">
          <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-medium">{t("loadingBook")}</p>
          {title ? (
            <p className="max-w-sm text-sm text-muted-foreground">{title}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("preparingText")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReaderView({ bookId }: ReaderViewProps) {
  const t = useTranslations("reader");
  const locale = useLocale() as AiChatLocale;
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [aiPrompt, setAiPrompt] = useState<string | undefined>();
  const isMobileLayout = useIsMobileLayout();

  const [book, setBook] = useState<ReaderBookMeta | null>(null);
  const [loadingBook, setLoadingBook] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number | null>(null);

  const {
    chapters,
    currentChapterIndex,
    initBook,
    saveBookToOffline,
    nextChapter,
    prevChapter,
    setCurrentChapterIndex,
    reset,
  } = useBookStore();

  const isPdf = book?.format === "pdf";
  const totalPages = book?.totalChapters ?? 0;
  const pdfPages = useMemo<ChapterSummary[]>(() => {
    if (!isPdf || totalPages <= 0) return [];

    return Array.from({ length: totalPages }, (_, index) => ({
      order: index + 1,
      title: String(index + 1),
    }));
  }, [isPdf, totalPages]);

  const navigationLabels = useMemo(
    (): NavigationKindLabels => ({
      cover: t("navCover"),
      titlePage: t("navTitlePage"),
      frontMatter: t("navFrontMatter"),
      appendix: t("navAppendix"),
      section: t("navSection"),
      chapterNumber: (index) => t("navChapterNumber", { index }),
    }),
    [t],
  );

  const tocByHref = useMemo(() => buildTocHrefTitleMap(book?.toc ?? []), [book?.toc]);

  const sidebarChapters: ChapterSummary[] = useMemo(() => {
    if (isPdf) return pdfPages;

    const textChapters = chapters.filter((chapter) => chapter.id !== COVER_CHAPTER_ID);
    return buildNavigationDisplayItems(
      textChapters.map((chapter) => toNavigationItemInput(chapter)),
      navigationLabels,
      { tocByHref },
    ).map(({ order, title }) => ({ order, title }));
  }, [chapters, isPdf, navigationLabels, pdfPages, tocByHref]);

  const currentChapter = chapters[currentChapterIndex];
  const currentChapterDisplayTitle = useMemo(() => {
    if (!currentChapter || currentChapter.id === COVER_CHAPTER_ID) {
      return undefined;
    }
    return (
      sidebarChapters.find((item) => item.order === currentChapter.order)?.title ??
      currentChapter.title
    );
  }, [currentChapter, sidebarChapters]);
  const isCoverPage = !isPdf && !loadingBook && currentChapterIndex === 0;

  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 1023px)");

    const applyLayout = () => {
      if (mqMobile.matches) {
        setLeftSidebarOpen(false);
        setRightSidebarOpen(false);
        return;
      }

      setLeftSidebarOpen(true);
      setRightSidebarOpen(true);
    };

    applyLayout();
    mqMobile.addEventListener("change", applyLayout);

    return () => {
      mqMobile.removeEventListener("change", applyLayout);
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingBook(true);
      setError(null);
      setBook(null);

      const savedOrder = getLastChapterOrder(bookId);
      const readerPosition = getSavedReaderPosition(bookId);

      reset();

      try {
        if (!isBookIdUuid(bookId)) {
          clearLastReadIfBook(bookId);
          router.replace("/library");
          return;
        }

        const offlineResult = await initBook(bookId, readerPosition);

        if (cancelled) return;

        applySavedChapterOrder(bookId, savedOrder);

        const { chapters: loadedChapters } = useBookStore.getState();

        if (offlineResult.loaded && offlineResult.book) {
          if (offlineResult.book.format === "pdf") {
            const total = offlineResult.book.totalChapters ?? 1;
            const initialPage =
              savedOrder && savedOrder >= 1 && savedOrder <= total ? savedOrder : 1;
            setPdfCurrentPage(initialPage);
            setBook(offlineResult.book);
            return;
          }

          if (loadedChapters.length > 0) {
            setBook(offlineResult.book);
            return;
          }
        }

        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

        if (isOffline) {
          throw new Error(t("offlineUnavailable"));
        }

        if (!isSignedIn) {
          throw new Error(t("signInToLoad"));
        }

        const res = await fetch(`/api/books/${encodeURIComponent(bookId)}/reader`, {
          cache: "no-store",
        });

        if (res.status === 401) {
          router.replace("/");
          return;
        }

        if (res.status === 404) {
          clearLastReadIfBook(bookId);
          router.replace("/library");
          return;
        }

        if (!res.ok) {
          throw new Error(t("bookNotFound"));
        }

        const json = (await res.json()) as {
          book: ReaderBookMeta;
          chapters: ReaderChapterInput[];
        };

        if (cancelled) return;

        const loadedBook: ReaderBookMeta = {
          _id: json.book._id,
          title: json.book.title,
          authors: json.book.authors,
          format: json.book.format,
          totalChapters: json.book.totalChapters,
          coverAssetId: json.book.coverAssetId,
          coverUrl: json.book.coverUrl,
          readingTypography: json.book.readingTypography ?? null,
          toc: json.book.toc ?? [],
        };

        setBook(loadedBook);

        if (loadedBook.format === "pdf") {
          const total = loadedBook.totalChapters ?? 1;
          const initialPage = savedOrder && savedOrder >= 1 && savedOrder <= total ? savedOrder : 1;
          setPdfCurrentPage(initialPage);
          setLastRead(bookId, initialPage);
          return;
        }

        const savedChapter = json.chapters.find((chapter) => chapter.order === savedOrder);

        await saveBookToOffline(loadedBook, json.chapters, {
          chapterOrder: savedOrder,
          chapterHref: savedChapter?.href ?? null,
        });

        applySavedChapterOrder(bookId, savedOrder);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("loadError"));
        }
      } finally {
        if (!cancelled) setLoadingBook(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId, isAuthLoaded, isSignedIn, initBook, reset, router, saveBookToOffline, t]);

  useEffect(() => {
    if (
      isPdf ||
      loadingBook ||
      isCoverPage ||
      !currentChapter ||
      currentChapter.id === COVER_CHAPTER_ID
    ) {
      return;
    }

    setLastRead(bookId, currentChapter.order);
  }, [bookId, currentChapter, currentChapterIndex, isCoverPage, isPdf, loadingBook]);

  const handlePdfPageChange = useCallback(
    (page: number) => {
      setPdfCurrentPage(page);
      setLastRead(bookId, page);
    },
    [bookId],
  );

  const handleChapterSelect = useCallback(
    (order: number) => {
      const index = chapters.findIndex(
        (chapter) => chapter.id !== COVER_CHAPTER_ID && chapter.order === order,
      );
      if (index >= 0) {
        setCurrentChapterIndex(index);
      }
    },
    [chapters, setCurrentChapterIndex],
  );

  const handleAskAI = (text: string) => {
    setAiPrompt(text);
    setRightSidebarOpen(true);
  };

  const firstContentChapterIndex = chapters[0]?.id === COVER_CHAPTER_ID ? 1 : 0;
  const canGoPrev = currentChapterIndex > firstContentChapterIndex;
  const canGoNext = currentChapterIndex < chapters.length - 1;

  const coverUrl =
    book?.coverUrl ??
    (book?.coverAssetId ? `/api/books/${bookId}/assets/${book.coverAssetId}` : null);

  if (loadingBook) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <TopNavbar />
        <main id="main-content" className="flex flex-1 flex-col">
          <ReaderLoadingScreen title={book?.title} />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <TopNavbar />
        <main
          id="main-content"
          className="flex flex-1 flex-col items-center justify-center gap-3 bg-reading-bg px-4 py-6 text-center sm:px-6"
        >
          <p className="text-lg font-medium text-destructive">{error}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t("bookNotFoundHint")}</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/library">{t("backToLibrary")}</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <ReadingFontsProvider className="flex h-dvh flex-col bg-background">
      <TopNavbar />

      {isMobileLayout && (isPdf || isCoverPage) ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-card px-3 py-2 lg:hidden">
          <Button
            type="button"
            variant={leftSidebarOpen ? "secondary" : "outline"}
            size="sm"
            className="min-h-10 min-w-20 rounded-xl"
            onClick={() => setLeftSidebarOpen(true)}
            aria-expanded={leftSidebarOpen}
          >
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
          <Button
            type="button"
            variant={rightSidebarOpen ? "secondary" : "outline"}
            size="sm"
            className="min-h-10 min-w-20 rounded-xl"
            onClick={() => setRightSidebarOpen(true)}
            aria-expanded={rightSidebarOpen}
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftSidebar
          isOpen={leftSidebarOpen}
          onToggle={() => setLeftSidebarOpen((open) => !open)}
          bookId={bookId}
          bookTitle={book?.title}
          chapters={sidebarChapters}
          currentChapterOrder={isPdf ? (pdfCurrentPage ?? undefined) : currentChapter?.order}
          onChapterSelect={isPdf ? handlePdfPageChange : handleChapterSelect}
          tocTitle={isPdf ? t("pages") : t("toc")}
        />

        <main id="main-content" className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          {isPdf ? (
            <PdfReadingArea
              bookId={bookId}
              book={book ?? undefined}
              totalPages={book?.totalChapters ?? 1}
              currentPage={pdfCurrentPage ?? 1}
              onPageChange={handlePdfPageChange}
              onAskAI={handleAskAI}
              isLoading={false}
              error={error}
            />
          ) : isCoverPage ? (
            <BookCoverView
              title={book?.title ?? ""}
              authors={book?.authors}
              coverUrl={coverUrl}
              onStartReading={nextChapter}
            />
          ) : (
            <ReadingArea
              bookId={bookId}
              onAskAI={handleAskAI}
              chapters={sidebarChapters}
              coverUrl={coverUrl}
              onChapterSelect={handleChapterSelect}
              book={book ?? undefined}
              typography={book?.readingTypography ?? null}
              chapter={
                currentChapter
                  ? {
                      title: currentChapterDisplayTitle ?? currentChapter.title,
                      html: currentChapter.content,
                      order: currentChapter.order,
                      totalChapters: book?.totalChapters,
                    }
                  : undefined
              }
              isLoading={false}
              error={error}
              onPrevChapter={prevChapter}
              onNextChapter={nextChapter}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              mobileSidebarChrome={{
                leftSidebarOpen,
                rightSidebarOpen,
                onOpenLeftSidebar: () => setLeftSidebarOpen(true),
                onOpenRightSidebar: () => setRightSidebarOpen(true),
              }}
            />
          )}
        </main>

        <AISidebar
          isOpen={rightSidebarOpen}
          onToggle={() => setRightSidebarOpen((open) => !open)}
          initialPrompt={aiPrompt}
          onClearPrompt={() => setAiPrompt(undefined)}
          bookId={bookId}
          bookTitle={book?.title}
          bookAuthor={book?.authors?.[0]}
          chapterTitle={isCoverPage || !currentChapter ? undefined : currentChapterDisplayTitle}
          chapterOrder={
            isCoverPage || !currentChapter || currentChapter.id === COVER_CHAPTER_ID
              ? undefined
              : currentChapter.order
          }
          locale={locale}
        />
      </div>
    </ReadingFontsProvider>
  );
}

export function ReaderEmptyState() {
  const t = useTranslations("reader");
  const tNav = useTranslations("nav");
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const isMobileLayout = useIsMobileLayout();

  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 1023px)");
    const applyLayout = () => {
      if (mqMobile.matches) {
        setLeftSidebarOpen(false);
        setRightSidebarOpen(false);
      } else {
        setLeftSidebarOpen(true);
        setRightSidebarOpen(true);
      }
    };

    applyLayout();
    mqMobile.addEventListener("change", applyLayout);
    return () => mqMobile.removeEventListener("change", applyLayout);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <TopNavbar />

      {isMobileLayout ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-card px-3 py-2 lg:hidden">
          <Button
            type="button"
            variant={leftSidebarOpen ? "secondary" : "outline"}
            size="sm"
            className="min-h-10 flex-1 rounded-xl"
            onClick={() => setLeftSidebarOpen(true)}
            aria-expanded={leftSidebarOpen}
          >
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t("showLibrary")}</span>
          </Button>
          <Button
            type="button"
            variant={rightSidebarOpen ? "secondary" : "outline"}
            size="sm"
            className="min-h-10 flex-1 rounded-xl"
            onClick={() => setRightSidebarOpen(true)}
            aria-expanded={rightSidebarOpen}
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t("askAi")}</span>
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftSidebar
          isOpen={leftSidebarOpen}
          onToggle={() => setLeftSidebarOpen((open) => !open)}
        />

        <main id="main-content" className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-full flex-col items-center justify-center gap-5 bg-reading-bg px-4 py-6 text-center sm:px-6">
            <div className="max-w-md space-y-2">
              <h1 className="type-page-title">{t("selectBook")}</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("selectBookDescription")}
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Button asChild className="rounded-xl">
                <Link href="/library">{t("goToLibrary")}</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/add-book">{tNav("addBook")}</Link>
              </Button>
            </div>
          </div>
        </main>

        <AISidebar
          isOpen={rightSidebarOpen}
          onToggle={() => setRightSidebarOpen((open) => !open)}
          onClearPrompt={() => {}}
        />
      </div>
    </div>
  );
}
