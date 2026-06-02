"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReadingSelectionToolbar } from "@/components/bookified/reading-selection-toolbar";
import { useReadingTextSelection } from "@/hooks/use-reading-text-selection";
import { loadPdfBytesForViewer } from "@/lib/books/load-pdf-bytes";
import {
  DEFAULT_PDF_VIEWER_SETTINGS,
  getPdfViewerSettingsSnapshot,
  setPdfViewerSettings,
  subscribePdfViewerSettings,
} from "@/lib/books/reader-storage";
import { cn } from "@/lib/utils";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfReadingAreaProps {
  bookId: string;
  book?: {
    title: string;
    authors?: string[];
  };
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onAskAI?: (text: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function PdfReadingArea({
  bookId,
  book,
  totalPages,
  currentPage,
  onPageChange,
  onAskAI,
  isLoading: externalLoading = false,
  error: externalError = null,
}: PdfReadingAreaProps) {
  const t = useTranslations("reader");
  const containerRef = useRef<HTMLDivElement>(null);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [lastRenderedPageKey, setLastRenderedPageKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [resolvedPageCount, setResolvedPageCount] = useState(totalPages);

  const { zoom, fitWidth } = useSyncExternalStore(
    subscribePdfViewerSettings,
    getPdfViewerSettingsSnapshot,
    () => DEFAULT_PDF_VIEWER_SETTINGS,
  );

  const setZoom = useCallback((value: number | ((prev: number) => number)) => {
    const current = getPdfViewerSettingsSnapshot();
    const nextZoom = typeof value === "function" ? value(current.zoom) : value;
    setPdfViewerSettings({ ...current, zoom: nextZoom });
  }, []);

  const setFitWidth = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const current = getPdfViewerSettingsSnapshot();
    const nextFitWidth = typeof value === "function" ? value(current.fitWidth) : value;
    setPdfViewerSettings({ ...current, fitWidth: nextFitWidth });
  }, []);

  const derivedTitle = book?.title ?? "PDF";
  const pageCount = resolvedPageCount > 0 ? resolvedPageCount : totalPages;
  const progress = pageCount > 0 ? (currentPage / pageCount) * 100 : 0;
  const isLoading = externalLoading || loadingPdf;
  const error = externalError || loadError;

  const pdfFile = useMemo(
    () => (pdfData ? { data: pdfData.slice(0) } : null),
    [pdfData],
  );

  const {
    selectedText,
    selectionPosition,
    selectionToolbarRef,
    handleToolbarPointerDown,
    handleAskAboutSelection,
  } = useReadingTextSelection(pageContentRef, {
    enabled: !isLoading && !error && Boolean(pdfFile),
    onAskAI,
    resetKey: currentPage,
  });

  const pageWidth = useMemo(() => {
    if (containerWidth <= 0) {
      return undefined;
    }

    const padding = 48;
    const availableWidth = Math.max(containerWidth - padding, 320);

    if (fitWidth) {
      return availableWidth;
    }

    const zoomFactor = Math.min(Math.max(zoom / 100, 0.5), 1);
    return Math.floor(availableWidth * zoomFactor);
  }, [containerWidth, fitWidth, zoom]);

  const pageRenderKey = `${currentPage}:${pageWidth ?? 0}`;
  const pageRendering = lastRenderedPageKey !== pageRenderKey;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingPdf(true);
      setLoadError(null);
      setPdfData(null);

      try {
        const bytes = await loadPdfBytesForViewer(bookId);
        if (!cancelled) {
          setPdfData(bytes);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Не удалось загрузить PDF");
        }
      } finally {
        if (!cancelled) {
          setLoadingPdf(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && currentPage > 1) {
        onPageChange(currentPage - 1);
      }
      if (event.key === "ArrowRight" && currentPage < pageCount) {
        onPageChange(currentPage + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, pageCount, onPageChange]);

  const goPrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const goNext = () => {
    if (currentPage < pageCount) onPageChange(currentPage + 1);
  };

  return (
    <TooltipProvider>
      <div className="relative flex h-full flex-1 flex-col bg-reading-bg">
        <div className="absolute left-0 right-0 top-0 z-10 hidden h-1 overflow-hidden bg-border/30 lg:block">
          <div
            className="h-full origin-left bg-progress transition-transform duration-300 motion-reduce:transition-none"
            style={{ transform: `scaleX(${progress / 100})`, width: "100%" }}
          />
        </div>

        <div className="absolute right-2 top-3 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-1 rounded-2xl border border-border/50 bg-card p-1 shadow-lg sm:right-4 sm:top-6 sm:p-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={fitWidth ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={() => setFitWidth((value) => !value)}
                aria-label={t("pdfFitWidth")}
                aria-pressed={fitWidth}
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("pdfFitWidth")}</TooltipContent>
          </Tooltip>

          {!fitWidth && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl"
                disabled={zoom <= 50}
                onClick={() => setZoom((value) => Math.max(50, value - 10))}
                aria-label={t("pdfZoomOut")}
              >
                <Minus className="h-4 w-4" aria-hidden />
              </Button>
              <span className="w-10 text-center text-xs text-muted-foreground tabular-nums">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl"
                disabled={zoom >= 100}
                onClick={() => setZoom((value) => Math.min(100, value + 10))}
                aria-label={t("pdfZoomIn")}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </>
          )}
        </div>

        <div ref={containerRef} className="flex-1 overflow-auto px-3 py-6 pt-14 sm:px-4 sm:py-8 md:px-8">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              <p className="text-sm">{t("pdfLoading")}</p>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-lg font-medium text-destructive">{error}</p>
            </div>
          ) : pdfFile ? (
            <div className="mx-auto flex max-w-5xl flex-col items-center">
              <header className="mb-4 text-center">
                <p className="mb-2 text-sm font-medium tracking-wider text-muted-foreground">
                  {derivedTitle}
                </p>
              </header>

              <Document
                file={pdfFile}
                loading={
                  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                    <p className="text-sm">{t("pdfOpening")}</p>
                  </div>
                }
                onLoadSuccess={({ numPages }) => {
                  setResolvedPageCount(numPages);
                }}
                onLoadError={(e) => {
                  setLoadError(e.message || t("pdfLoadError"));
                }}
                className="pdf-reading-document"
              >
                <motion.div
                  ref={pageContentRef}
                  key={currentPage}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "pdf-reading-page relative overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-border/40",
                    pageRendering && "opacity-80",
                  )}
                >
                  <Page
                    pageNumber={currentPage}
                    width={pageWidth}
                    renderTextLayer
                    renderAnnotationLayer
                    onRenderSuccess={() => setLastRenderedPageKey(pageRenderKey)}
                    onRenderError={(e) => {
                      setLoadError(e.message || t("pdfRenderError"));
                    }}
                    loading={
                      <div className="flex min-h-[480px] items-center justify-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    }
                    className="pdf-reading-page__canvas"
                  />
                </motion.div>
              </Document>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border/30 bg-reading-bg px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-3">
          <Button
            variant="ghost"
            className="min-h-10 gap-1 rounded-xl px-2 sm:min-h-11 sm:gap-2 sm:px-4"
            disabled={currentPage <= 1 || isLoading}
            onClick={goPrev}
            aria-label={t("pdfPrevPage")}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t("pdfPrevPageShort")}</span>
          </Button>

          <div className="flex min-w-0 items-center gap-2 text-xs leading-none text-muted-foreground sm:text-sm">
            <span className="truncate tabular-nums">
              {t("pageOf", { current: currentPage, total: pageCount })}
            </span>
            <CircularProgress
              value={progress}
              size={16}
              strokeWidth={3}
              ariaLabel={t("readingProgress", { percent: Math.round(progress) })}
            />
          </div>

          <Button
            variant="ghost"
            className="min-h-10 gap-1 rounded-xl px-2 sm:min-h-11 sm:gap-2 sm:px-4"
            disabled={currentPage >= pageCount || isLoading}
            onClick={goNext}
            aria-label={t("pdfNextPage")}
          >
            <span className="hidden sm:inline">{t("pdfNextPageShort")}</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </div>

        <ReadingSelectionToolbar
          selectedText={selectedText}
          selectionPosition={selectionPosition}
          selectionToolbarRef={selectionToolbarRef}
          onToolbarPointerDown={handleToolbarPointerDown}
          onAskAboutSelection={handleAskAboutSelection}
        />
      </div>
    </TooltipProvider>
  );
}
