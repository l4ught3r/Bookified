"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type TouchEvent } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ListTree,
  Loader2,
  Sparkles,
  Type,
} from "lucide-react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import type { ReaderChapterItem } from "@/components/bookified/reader-contents-dialog";
import { ReadingBookmarkMarkers } from "@/components/bookified/reading-bookmark-markers";
import { ReadingChapterBody } from "@/components/bookified/reading-chapter-body";
import { ReadingSelectionToolbar } from "@/components/bookified/reading-selection-toolbar";
import { useReadingFonts } from "@/components/providers/reading-fonts-provider";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobileLayout } from "@/hooks/use-media-query";
import { useReadingTextSelection } from "@/hooks/use-reading-text-selection";
import { htmlToChapterBlocks, textToChapterBlocks } from "@/lib/books/chapter-blocks";
import {
  BOOKMARK_SCROLL_TOLERANCE,
  clearReadingTypographySettings,
  getBookmarkAnchorScrollTop,
  getBookmarkScrollTarget,
  getChapterScrollPosition,
  getReaderBookmarksSnapshot,
  getReadingTypographySettingsSnapshot,
  mergeReadingTypographyWithStored,
  READER_STORAGE_EVENT,
  removeReaderBookmark,
  setChapterScrollPosition,
  setReadingTypographySettings,
  subscribeReadingTypographySettings,
  toggleReaderBookmark,
  type ReaderBookmark,
  type StoredReadingTypographySettings,
} from "@/lib/books/reader-storage";
import {
  BOOK_ORIGINAL_FONT_ID,
  getReadingFontById,
  getReadingFontPickerOptions,
} from "@/lib/books/reading-fonts";
import {
  DEFAULT_READING_TYPOGRAPHY,
  getPlatformDefaultReadingTypography,
  isBookOriginalFont,
  MOBILE_DEFAULT_READING_FONT_SIZE,
  MOBILE_DEFAULT_READING_LINE_HEIGHT,
  normalizeReadingTypography,
  resolveReadingFontFamily,
  type ReadingTypographySettings,
} from "@/lib/books/reading-typography";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const ReaderContentsDialog = dynamic(
  () =>
    import("@/components/bookified/reader-contents-dialog").then(
      (module) => module.ReaderContentsDialog,
    ),
  { ssr: false },
);

function subscribeReaderBookmarks(onStoreChange: () => void) {
  window.addEventListener(READER_STORAGE_EVENT, onStoreChange);
  return () => window.removeEventListener(READER_STORAGE_EVENT, onStoreChange);
}

interface ReadingAreaProps {
  bookId: string;
  onAskAI: (text: string) => void;
  chapters?: ReaderChapterItem[];
  coverUrl?: string | null;
  onChapterSelect?: (order: number) => void;
  book?: {
    title: string;
    authors?: string[];
  };
  chapter?: {
    title?: string;
    html?: string;
    text?: string;
    order?: number;
    totalChapters?: number;
  };
  isLoading?: boolean;
  error?: string | null;
  onPrevChapter?: () => void;
  onNextChapter?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  typography?: ReadingTypographySettings | null;
  mobileSidebarChrome?: {
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;
    onOpenLeftSidebar: () => void;
    onOpenRightSidebar: () => void;
  };
  navbarVisible?: boolean;
  onNavbarVisibleChange?: (visible: boolean) => void;
}

export function ReadingArea({
  bookId,
  onAskAI,
  chapters = [],
  coverUrl,
  onChapterSelect,
  book,
  chapter,
  typography,
  isLoading = false,
  error = null,
  onPrevChapter,
  onNextChapter,
  canGoPrev = false,
  canGoNext = false,
  mobileSidebarChrome,
  navbarVisible: navbarVisibleProp = true,
  onNavbarVisibleChange,
}: ReadingAreaProps) {
  const t = useTranslations("reader");
  const locale = useLocale();
  const messages = useMessages();
  const { ensureFontIds, preloadPickerFonts } = useReadingFonts();
  const bookOriginalFontLabel =
    (messages.reader as { bookOriginalFont?: string } | undefined)?.bookOriginalFont ??
    (locale === "ru" ? "Исходный шрифт" : "Original typeface");
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobileLayout = useIsMobileLayout();
  const platformDefaultTypography = useMemo(
    () => getPlatformDefaultReadingTypography(isMobileLayout),
    [isMobileLayout],
  );
  const bookTypography = useMemo(
    () => normalizeReadingTypography(typography ?? platformDefaultTypography),
    [typography, platformDefaultTypography],
  );

  const storedTypography = useSyncExternalStore(
    subscribeReadingTypographySettings,
    getReadingTypographySettingsSnapshot,
    () => null,
  );

  const activeTypography = useMemo(() => {
    const merged = mergeReadingTypographyWithStored(bookTypography, storedTypography);

    if (!isMobileLayout || storedTypography != null) {
      return merged;
    }

    const mobilePatch: Partial<ReadingTypographySettings> = {};

    if (typography?.fontSize == null || typography.fontSize === DEFAULT_READING_TYPOGRAPHY.fontSize) {
      mobilePatch.fontSize = MOBILE_DEFAULT_READING_FONT_SIZE;
    }

    if (
      typography?.lineHeight == null ||
      typography.lineHeight === DEFAULT_READING_TYPOGRAPHY.lineHeight
    ) {
      mobilePatch.lineHeight = MOBILE_DEFAULT_READING_LINE_HEIGHT;
    }

    if (Object.keys(mobilePatch).length === 0) {
      return merged;
    }

    return normalizeReadingTypography({
      ...merged,
      ...mobilePatch,
    });
  }, [bookTypography, storedTypography, isMobileLayout, typography]);

  const updateTypography = useCallback(
    (patch: Partial<StoredReadingTypographySettings>) => {
      const current: StoredReadingTypographySettings = storedTypography ?? {
        fontId: activeTypography.fontId,
        fontSize: activeTypography.fontSize,
        lineHeight: activeTypography.lineHeight,
        letterSpacing: activeTypography.letterSpacing,
        wordSpacing: activeTypography.wordSpacing,
        textAlign: activeTypography.textAlign,
        fontWeightBold: activeTypography.fontWeightBold,
        overrideBookFont: false,
      };

      const nextStored: StoredReadingTypographySettings = {
        ...current,
        ...patch,
      };

      if (patch.fontId != null) {
        nextStored.overrideBookFont = patch.fontId !== BOOK_ORIGINAL_FONT_ID;
      }

      setReadingTypographySettings(nextStored);
    },
    [activeTypography, storedTypography],
  );

  const resetTypography = useCallback(() => {
    clearReadingTypographySettings();
  }, []);

  const {
    fontId: selectedFontId,
    fontSize,
    lineHeight,
    letterSpacing,
    wordSpacing,
    textAlign,
    fontWeightBold,
  } = activeTypography;
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingBookmarkScrollRef = useRef<ReaderBookmark | null>(null);
  const readingContentRef = useRef<HTMLDivElement>(null);
  const scrollPersistReadyRef = useRef(false);
  const tapTrackerRef = useRef({ x: 0, y: 0, moved: false });
  const chapterOrder = chapter?.order;
  const [readerUi, setReaderUi] = useState({
    chapterOrder,
    typographyOpen: false,
    contentsOpen: false,
  });

  if (readerUi.chapterOrder !== chapterOrder) {
    setReaderUi({
      chapterOrder,
      typographyOpen: false,
      contentsOpen: false,
    });
  }

  const typographyOpen = readerUi.typographyOpen;
  const contentsOpen = readerUi.contentsOpen;
  const typographyDismissPendingRef = useRef(false);
  const closeTypography = useCallback(() => {
    setReaderUi((prev) => (prev.typographyOpen ? { ...prev, typographyOpen: false } : prev));
  }, []);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [chapterScrollPercent, setChapterScrollPercent] = useState(0);

  const {
    selectedText,
    selectionPosition,
    selectionToolbarRef,
    handleToolbarPointerDown,
    handleAskAboutSelection,
  } = useReadingTextSelection(readingContentRef, {
    enabled: Boolean(chapter) && !isLoading,
    onAskAI,
    resetKey: chapter?.order,
  });
  const restoredScrollRef = useRef(0);

  const derivedTitle = book?.title ?? "Книга";
  const derivedAuthor = book?.authors?.join(", ") ?? "Неизвестный автор";
  const derivedChapterTitle = chapter?.title ?? "Глава";
  const derivedOrder = chapter?.order ?? 0;
  const derivedTotal = chapter?.totalChapters ?? 0;
  const progress = derivedTotal > 0 ? (derivedOrder / derivedTotal) * 100 : 0;

  const bookmarks = useSyncExternalStore(
    subscribeReaderBookmarks,
    () => getReaderBookmarksSnapshot(bookId),
    () => [],
  );

  const chapterBookmarks = useMemo(() => {
    const order = chapter?.order;
    if (order == null) return [];
    return bookmarks.filter((bookmark) => bookmark.chapterOrder === order);
  }, [bookmarks, chapter]);

  const bookmarkAnchorScroll = useMemo(
    () => getBookmarkAnchorScrollTop(scrollTop, viewportHeight),
    [scrollTop, viewportHeight],
  );

  const isBookmarkedHere = useMemo(() => {
    const order = chapter?.order;
    if (order == null) return false;
    return bookmarks.some(
      (bookmark) =>
        bookmark.chapterOrder === order &&
        Math.abs(bookmark.scrollTop - bookmarkAnchorScroll) < BOOKMARK_SCROLL_TOLERANCE,
    );
  }, [bookmarks, chapter, bookmarkAnchorScroll]);

  const chapterHtml = chapter?.html;
  const chapterText = chapter?.text;

  const contentBlocks = useMemo(() => {
    if (chapterHtml) return htmlToChapterBlocks(chapterHtml);
    if (chapterText) return textToChapterBlocks(chapterText);
    return [];
  }, [chapterHtml, chapterText]);

  useEffect(() => {
    const container = contentRef.current;
    const chapterOrder = chapter?.order;
    if (!container || chapterOrder == null || isLoading) return;

    scrollPersistReadyRef.current = false;
    const savedScroll = getChapterScrollPosition(bookId, chapterOrder);
    restoredScrollRef.current = savedScroll;

    let cancelled = false;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const tryRestore = () => {
      if (cancelled) return true;

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      const target = Math.min(savedScroll, maxScroll);

      if (savedScroll > 0 && maxScroll < savedScroll - 8 && attempts < 40) {
        attempts += 1;
        return false;
      }

      const pending = pendingBookmarkScrollRef.current;
      const scrollTarget =
        pending?.chapterOrder === chapterOrder
          ? getBookmarkScrollTarget(pending.scrollTop, container.clientHeight)
          : target;

      if (pending?.chapterOrder === chapterOrder) {
        pendingBookmarkScrollRef.current = null;
      }

      container.scrollTop = scrollTarget;
      setScrollTop(scrollTarget);
      setChapterScrollPercent(
        Math.min(100, Math.round((scrollTarget / Math.max(1, maxScroll)) * 100)),
      );
      scrollPersistReadyRef.current = true;
      return true;
    };

    const scheduleRetry = () => {
      if (cancelled || tryRestore()) {
        observer?.disconnect();
        observer = null;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        return;
      }

      retryTimer = setTimeout(scheduleRetry, 50);
    };

    frame = window.requestAnimationFrame(() => {
      if (tryRestore()) return;

      observer = new ResizeObserver(scheduleRetry);
      observer.observe(container);
      if (readingContentRef.current) {
        observer.observe(readingContentRef.current);
      }

      scheduleRetry();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [bookId, chapter?.order, chapterHtml, chapterText, isLoading]);

  useEffect(() => {
    const container = contentRef.current;
    const chapterOrder = chapter?.order;
    if (!container || chapterOrder == null) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    const persistScroll = () => {
      if (!scrollPersistReadyRef.current) return;

      const scrollTop = container.scrollTop;
      if (scrollTop === 0 && restoredScrollRef.current > 0) {
        return;
      }

      setChapterScrollPosition(bookId, chapterOrder, scrollTop);
      restoredScrollRef.current = scrollTop;
    };

    const updateScrollMetrics = () => {
      const scrollTopValue = container.scrollTop;
      setScrollTop(scrollTopValue);
      setViewportHeight(container.clientHeight);
      const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight);
      setChapterScrollPercent(Math.min(100, Math.round((scrollTopValue / maxScroll) * 100)));
    };

    const handleScroll = () => {
      scrollPersistReadyRef.current = true;
      updateScrollMetrics();

      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(persistScroll, 150);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollMetrics();

    const resizeObserver = new ResizeObserver(updateScrollMetrics);
    resizeObserver.observe(container);

    const saveNow = () => {
      scrollPersistReadyRef.current = true;
      persistScroll();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveNow();
      }
    };

    const handlePageHide = () => {
      saveNow();
    };

    window.addEventListener("beforeunload", saveNow);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener("beforeunload", saveNow);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resizeObserver.disconnect();
      container.removeEventListener("scroll", handleScroll);
    };
  }, [bookId, chapter?.order]);

  const scrollToBookmarkPosition = useCallback((anchorScrollTop: number) => {
    const container = contentRef.current;
    if (!container) return;

    const scrollTarget = getBookmarkScrollTarget(anchorScrollTop, container.clientHeight);
    container.scrollTo({ top: scrollTarget, behavior: "smooth" });
    scrollPersistReadyRef.current = true;
    restoredScrollRef.current = scrollTarget;
    setScrollTop(scrollTarget);
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    setChapterScrollPercent(
      Math.min(100, Math.round((scrollTarget / Math.max(1, maxScroll)) * 100)),
    );
  }, []);

  const handleToggleBookmark = useCallback(() => {
    const chapterOrder = chapter?.order;
    const container = contentRef.current;
    if (chapterOrder == null || !container) return;

    const anchorScroll = getBookmarkAnchorScrollTop(container.scrollTop, container.clientHeight);
    toggleReaderBookmark(bookId, {
      chapterOrder,
      chapterTitle:
        chapter?.title ??
        t("chapterOf", { current: chapterOrder, total: derivedTotal || chapterOrder }),
      scrollTop: anchorScroll,
    });
  }, [bookId, chapter?.order, chapter?.title, derivedTotal, t]);

  const handleBookmarkRemove = useCallback(
    (bookmarkId: string) => {
      removeReaderBookmark(bookId, bookmarkId);
    },
    [bookId],
  );

  const handleBookmarkSelect = useCallback(
    (bookmark: ReaderBookmark) => {
      setReaderUi((prev) => ({ ...prev, contentsOpen: false }));

      const container = contentRef.current;
      const viewport = container?.clientHeight ?? viewportHeight;
      const scrollTarget = getBookmarkScrollTarget(bookmark.scrollTop, viewport);
      setChapterScrollPosition(bookId, bookmark.chapterOrder, scrollTarget);

      if (bookmark.chapterOrder !== chapter?.order) {
        pendingBookmarkScrollRef.current = bookmark;
        onChapterSelect?.(bookmark.chapterOrder);
        return;
      }

      scrollToBookmarkPosition(bookmark.scrollTop);
    },
    [bookId, chapter?.order, onChapterSelect, scrollToBookmarkPosition, viewportHeight],
  );

  const showLoading = isLoading && !chapter;
  const showError = Boolean(error) && !chapter;
  const fontPickerOptions = useMemo(
    () =>
      getReadingFontPickerOptions().map((font) =>
        font.id === BOOK_ORIGINAL_FONT_ID ? { ...font, name: bookOriginalFontLabel } : font,
      ),
    [bookOriginalFontLabel],
  );

  useEffect(() => {
    ensureFontIds([selectedFontId]);
  }, [ensureFontIds, selectedFontId]);
  const selectedFont = getReadingFontById(selectedFontId);
  const usesCustomReadingFont = storedTypography?.overrideBookFont === true;
  const usesEmbeddedBookFont =
    isBookOriginalFont(activeTypography) && Boolean(activeTypography.customFontFamily);
  const selectedFontPreviewFamily =
    isBookOriginalFont(activeTypography) && activeTypography.customFontFamily
      ? `"${activeTypography.customFontFamily.replace(/"/g, "")}"`
      : selectedFont.family;
  const readingFontFamily = resolveReadingFontFamily(
    activeTypography,
    (id) => getReadingFontById(id).family,
  );

  const readingContentClassName = useMemo(
    () =>
      cn(
        "reading-text",
        usesCustomReadingFont && "reading-font-overridden",
        usesEmbeddedBookFont && "reading-embedded-book-font",
      ),
    [usesCustomReadingFont, usesEmbeddedBookFont],
  );

  const readingContentStyle = useMemo(
    () => ({
      ...(usesCustomReadingFont || usesEmbeddedBookFont ? { fontFamily: readingFontFamily } : {}),
      fontSize: `${fontSize}px`,
      lineHeight: lineHeight,
      letterSpacing: `${letterSpacing}px`,
      wordSpacing: `${wordSpacing}px`,
      textAlign: textAlign,
      ["--reading-text-align" as string]: textAlign,
    }),
    [
      usesCustomReadingFont,
      usesEmbeddedBookFont,
      readingFontFamily,
      fontSize,
      lineHeight,
      letterSpacing,
      wordSpacing,
      textAlign,
    ],
  );

  const chapterHtmlMarkup = useMemo(
    () => (chapterHtml ? { __html: chapterHtml } : null),
    [chapterHtml],
  );

  const chapterContentClassName = useMemo(
    () => cn("book-chapter-content", fontWeightBold && "reading-font-bold"),
    [fontWeightBold],
  );

  const useMobileTopChrome = isMobileLayout && mobileSidebarChrome != null;

  const shouldIgnoreNavbarToggle = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    if (
      target.closest(
        "a, button, input, textarea, select, [role='button'], [data-no-chrome-toggle]",
      )
    ) {
      return true;
    }
    const selection = window.getSelection();
    return Boolean(selection && !selection.isCollapsed);
  }, []);

  const handleContentTouchStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      typographyDismissPendingRef.current = typographyOpen;
      if (!isMobileLayout || event.touches.length !== 1) return;
      const touch = event.touches[0];
      tapTrackerRef.current = { x: touch.clientX, y: touch.clientY, moved: false };
    },
    [isMobileLayout, typographyOpen],
  );

  const handleContentTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (!isMobileLayout || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const { x, y } = tapTrackerRef.current;
      if (Math.hypot(touch.clientX - x, touch.clientY - y) > 10) {
        tapTrackerRef.current.moved = true;
      }
    },
    [isMobileLayout],
  );

  const toggleNavbar = useCallback(() => {
    onNavbarVisibleChange?.(!navbarVisibleProp);
  }, [navbarVisibleProp, onNavbarVisibleChange]);

  const handleContentTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (typographyDismissPendingRef.current) {
        typographyDismissPendingRef.current = false;
        return;
      }
      if (!isMobileLayout || !onNavbarVisibleChange || tapTrackerRef.current.moved) return;
      if (shouldIgnoreNavbarToggle(event.target)) return;
      toggleNavbar();
    },
    [isMobileLayout, onNavbarVisibleChange, shouldIgnoreNavbarToggle, toggleNavbar],
  );

  const handleContentClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (typographyOpen) return;
      if (!isMobileLayout || !onNavbarVisibleChange || window.matchMedia("(pointer: coarse)").matches) {
        return;
      }
      if (shouldIgnoreNavbarToggle(event.target)) return;
      toggleNavbar();
    },
    [isMobileLayout, onNavbarVisibleChange, shouldIgnoreNavbarToggle, toggleNavbar, typographyOpen],
  );

  const readerChromeActions = (
    <>
      <Popover
        open={typographyOpen}
        onOpenChange={(open) => setReaderUi((prev) => ({ ...prev, typographyOpen: open }))}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl hover:bg-secondary sm:h-11 sm:w-11"
                aria-label={t("readingSettings")}
              >
                <Type className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>

          <TooltipContent>{t("readingSettings")}</TooltipContent>
        </Tooltip>
        <PopoverContent
          className={cn(
            "z-[70] overflow-visible rounded-xl border-border/50 p-4",
            isMobileLayout
              ? "w-[calc(100vw-1rem)] max-w-md"
              : "w-[min(calc(100vw-2rem),20rem)]",
          )}
          align={isMobileLayout ? "center" : "end"}
          side={isMobileLayout ? "bottom" : "bottom"}
          sideOffset={isMobileLayout ? 10 : 8}
          collisionPadding={12}
        >
          <div className="space-y-5">
            <div className={cn(isMobileLayout ? "space-y-0" : "space-y-2")}>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedFontId}
                  onValueChange={(value) => updateTypography({ fontId: value })}
                  onOpenChange={(open) => {
                    if (open) preloadPickerFonts();
                  }}
                >
                  <SelectTrigger
                    size="default"
                    className={cn(
                      "w-full rounded-sm border-border/50 bg-secondary/50",
                      isMobileLayout && "h-9",
                    )}
                    style={{ fontFamily: selectedFontPreviewFamily }}
                  >
                    <span
                      className="text-sm font-medium pl-2"
                      style={{ fontFamily: "var(--font-geist-sans)" }}
                    >
                      {t("font")}
                    </span>
                    <div className="mx-2 h-5 w-px border-r-2 bg-border" />
                    <SelectValue placeholder={t("fontPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="z-[80] max-h-none overflow-visible rounded-sm **:data-[slot=select-scroll-down-button]:hidden **:data-[slot=select-scroll-up-button]:hidden">
                    <SelectGroup>
                      {fontPickerOptions.map((font) => (
                        <SelectItem
                          key={font.id}
                          value={font.id}
                          style={{
                            fontFamily:
                              font.id === BOOK_ORIGINAL_FONT_ID && bookTypography.customFontFamily
                                ? `"${bookTypography.customFontFamily.replace(/"/g, "")}"`
                                : font.family,
                          }}
                          className="text-sm font-medium px-4"
                        >
                          {font.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={cn(isMobileLayout ? "space-y-0" : "space-y-2")}>
              {!isMobileLayout ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("fontSize")}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined shrink-0 text-[1.125rem]" aria-hidden>
                  format_size
                </span>
                <Slider
                  value={[fontSize]}
                  onValueChange={([value]) => updateTypography({ fontSize: value })}
                  min={12}
                  max={28}
                  step={1}
                  className="flex-1"
                  aria-label={t("fontSize")}
                />
                <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted-foreground sm:w-10 sm:text-sm">
                  {fontSize.toFixed(0)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="material-symbols-outlined shrink-0 text-[1.125rem]">
                  format_bold
                </span>
                <span className={cn("font-medium", isMobileLayout ? "text-xs" : "text-sm")}>
                  {t("boldFont")}
                </span>
              </div>
              <Switch
                checked={fontWeightBold}
                onCheckedChange={(checked) => updateTypography({ fontWeightBold: checked })}
                aria-label={t("boldFont")}
              />
            </div>

            <div className={cn(isMobileLayout ? "space-y-0" : "space-y-2")}>
              {!isMobileLayout ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("lineHeight")}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined shrink-0 text-[1.125rem]" aria-hidden>
                  format_line_spacing
                </span>

                <Slider
                  value={[lineHeight * 10]}
                  onValueChange={([value]) => updateTypography({ lineHeight: value / 10 })}
                  min={12.0}
                  max={20.0}
                  step={0.5}
                  className="flex-1"
                  aria-label={t("lineHeight")}
                />

                <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted-foreground sm:w-10 sm:text-sm">
                  {lineHeight.toFixed(2)}
                </span>
              </div>
            </div>

            <div className={cn(isMobileLayout ? "space-y-0" : "space-y-2")}>
              {!isMobileLayout ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("letterSpacing")}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined shrink-0 text-[1.125rem]" aria-hidden>
                  format_letter_spacing_2
                </span>

                <Slider
                  value={[letterSpacing * 10 + 10]}
                  onValueChange={([value]) =>
                    updateTypography({ letterSpacing: (value - 10) / 10 })
                  }
                  min={0}
                  max={20}
                  step={1}
                  className="flex-1"
                  aria-label={t("letterSpacing")}
                />
                <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted-foreground sm:w-10 sm:text-sm">
                  {(letterSpacing * 10).toFixed(0)} %
                </span>
              </div>
            </div>

            <div className={cn(isMobileLayout ? "space-y-0" : "space-y-2")}>
              {!isMobileLayout ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t("wordSpacing")}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined shrink-0 text-[1.125rem]" aria-hidden>
                  format_letter_spacing
                </span>
                <Slider
                  value={[wordSpacing + 10]}
                  onValueChange={([value]) => updateTypography({ wordSpacing: value - 10 })}
                  min={0}
                  max={20}
                  step={1}
                  className="flex-1"
                  aria-label={t("wordSpacing")}
                />
                <span className="w-9 shrink-0 text-right tabular-nums text-xs text-muted-foreground sm:w-10 sm:text-sm">
                  {wordSpacing.toFixed(0)}%
                </span>
              </div>
            </div>

            <div className={cn(isMobileLayout ? "flex items-center gap-2" : "space-y-1")}>
              {!isMobileLayout ? (
                <span className="flex text-center text-sm font-medium">{t("alignment")}</span>
              ) : null}

              <div
                className={cn(
                  "flex gap-0.5",
                  isMobileLayout ? "flex-1 justify-center pt-0" : "justify-center pt-0.5",
                )}
              >
                {[
                  { value: "justify" as const, icon: AlignJustify, label: t("alignJustify") },
                  { value: "center" as const, icon: AlignCenter, label: t("alignCenter") },
                  { value: "left" as const, icon: AlignLeft, label: t("alignLeft") },
                  { value: "right" as const, icon: AlignRight, label: t("alignRight") },
                ].map(({ value, icon: Icon, label }) => (
                  <Button
                    key={value}
                    variant={textAlign === value ? "secondary" : "ghost"}
                    size="icon"
                    className={cn("rounded-lg", isMobileLayout ? "h-9 w-9" : "h-11 w-11")}
                    onClick={() => updateTypography({ textAlign: value })}
                    aria-label={label}
                    aria-pressed={textAlign === value}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className={cn("w-full rounded-lg", isMobileLayout && "h-9")}
              onClick={resetTypography}
            >
              {t("resetSettings")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {!useMobileTopChrome ? <div className="mx-1 hidden h-5 w-px bg-border sm:block" /> : null}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl sm:h-11 sm:w-11"
            onClick={() => setReaderUi((prev) => ({ ...prev, contentsOpen: true }))}
            aria-label={t("tableOfContents")}
          >
            <ListTree className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("tableOfContents")}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isBookmarkedHere ? "secondary" : "ghost"}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl sm:h-11 sm:w-11"
            onClick={handleToggleBookmark}
            aria-label={t("bookmarkToggle")}
            aria-pressed={isBookmarkedHere}
          >
            <Bookmark className={cn("h-4 w-4", isBookmarkedHere && "fill-primary text-primary")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("bookmarkToggle")}</TooltipContent>
      </Tooltip>
    </>
  );

  return (
    <TooltipProvider>
      {typographyOpen ? (
        <div
          className="fixed inset-0 z-[60]"
          aria-hidden
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            closeTypography();
          }}
        />
      ) : null}
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-reading-bg">
        <div className="absolute left-0 right-0 top-0 z-10 hidden h-1 overflow-hidden bg-border/30 lg:block">
          <div
            className="h-full origin-left bg-progress transition-transform duration-300 motion-reduce:transition-none"
            style={{ transform: `scaleX(${progress / 100})`, width: "100%" }}
          />
        </div>

        {useMobileTopChrome ? (
          <div
            className="z-20 flex w-full shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-card py-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] lg:hidden"
          >
            <Button
              type="button"
              variant={mobileSidebarChrome.leftSidebarOpen ? "secondary" : "outline"}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={mobileSidebarChrome.onOpenLeftSidebar}
              aria-expanded={mobileSidebarChrome.leftSidebarOpen}
              aria-label={t("showLibrary")}
            >
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
            </Button>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5">
              {readerChromeActions}
            </div>

            <Button
              type="button"
              variant={mobileSidebarChrome.rightSidebarOpen ? "secondary" : "outline"}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
              onClick={mobileSidebarChrome.onOpenRightSidebar}
              aria-expanded={mobileSidebarChrome.rightSidebarOpen}
              aria-label={t("askAi")}
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="absolute right-2 top-3 z-20 flex max-w-[calc(100%-1rem)] items-center gap-0.5 overflow-x-auto rounded-2xl border border-border/50 bg-card p-1 shadow-sm sm:right-5 sm:top-4 sm:gap-1 sm:p-1.5">
            {readerChromeActions}
          </div>
        )}

        <div
          ref={contentRef}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto lg:px-24 lg:py-10",
            useMobileTopChrome
              ? "max-lg:px-0 max-lg:py-6"
              : "px-4 py-10 pt-12 sm:px-6 sm:py-12 sm:pt-16 md:px-8",
          )}
          onTouchStart={handleContentTouchStart}
          onTouchMove={handleContentTouchMove}
          onTouchEnd={handleContentTouchEnd}
          onClick={handleContentClick}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-3xl",
              useMobileTopChrome && "px-4 sm:px-6 lg:px-0",
            )}
          >
            {showLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">{t("loadingBook")}</p>
              </div>
            ) : showError ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-lg font-medium text-destructive">{error}</p>
                <p className="text-sm text-muted-foreground">
                  Проверьте, что книга существует и была успешно загружена.
                </p>
              </div>
            ) : (
              <div className="relative">
                <ReadingChapterBody
                  ref={readingContentRef}
                  chapterOrder={chapter?.order}
                  prefersReducedMotion={prefersReducedMotion}
                  derivedTitle={derivedTitle}
                  derivedAuthor={derivedAuthor}
                  derivedChapterTitle={derivedChapterTitle}
                  readingContentClassName={readingContentClassName}
                  readingContentStyle={readingContentStyle}
                  chapterHtmlMarkup={chapterHtmlMarkup}
                  contentBlocks={contentBlocks}
                  isLoading={isLoading}
                  hasChapter={Boolean(chapter)}
                  chapterContentClassName={chapterContentClassName}
                  loadingChapterLabel={t("loadingChapter")}
                  emptyChapterLabel={t("emptyChapter")}
                />
                <ReadingBookmarkMarkers
                  bookmarks={chapterBookmarks}
                  onNavigate={handleBookmarkSelect}
                  isMobileLayout={isMobileLayout}
                />
              </div>
            )}
          </div>
        </div>

        <ReadingSelectionToolbar
          selectedText={selectedText}
          selectionPosition={selectionPosition}
          selectionToolbarRef={selectionToolbarRef}
          onToolbarPointerDown={handleToolbarPointerDown}
          onAskAboutSelection={handleAskAboutSelection}
        />

        {contentsOpen ? (
          <ReaderContentsDialog
            open={contentsOpen}
            onOpenChange={(open) => setReaderUi((prev) => ({ ...prev, contentsOpen: open }))}
            bookTitle={derivedTitle}
            bookAuthor={derivedAuthor}
            coverUrl={coverUrl}
            chapters={chapters}
            currentChapterOrder={chapter?.order}
            currentChapterScrollPercent={chapterScrollPercent}
            bookmarks={bookmarks}
            onChapterSelect={(order) => onChapterSelect?.(order)}
            onBookmarkSelect={handleBookmarkSelect}
            onBookmarkRemove={handleBookmarkRemove}
          />
        ) : null}

        <div className="sticky bottom-0 z-10 flex w-full shrink-0 items-center justify-between gap-2 border-t border-border/30 bg-reading-bg py-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:py-3 sm:pl-6 sm:pr-6">
          <Button
            variant="ghost"
            className="min-h-10 gap-1 rounded-xl px-2 select-none sm:min-h-11 sm:gap-2 sm:px-4"
            disabled={!canGoPrev || isLoading}
            onClick={onPrevChapter}
            aria-label={t("prevChapter")}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t("prevChapter")}</span>
          </Button>

          <div className="flex min-w-0 items-center gap-2 text-xs leading-none text-muted-foreground sm:text-sm">
            {derivedTotal > 0 ? (
              <>
                <span className="truncate tabular-nums">
                  {t("chapterOf", { current: derivedOrder, total: derivedTotal })}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex shrink-0 items-center gap-2">
                      <CircularProgress
                        value={progress}
                        size={16}
                        strokeWidth={3}
                        ariaLabel={t("readingProgress", {
                          percent: Math.round(progress),
                        })}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{progress.toFixed(0)}%</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <span>—</span>
            )}
          </div>

          <Button
            variant="ghost"
            className="min-h-10 gap-1 rounded-xl px-2 select-none sm:min-h-11 sm:gap-2 sm:px-4"
            disabled={!canGoNext || isLoading}
            onClick={onNextChapter}
            aria-label={t("nextChapter")}
          >
            <span className="hidden sm:inline">{t("nextChapter")}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
