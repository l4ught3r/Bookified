"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ListTree, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { isAuthenticatedBookAssetUrl } from "@/lib/books/asset-url";
import type { ReaderBookmark } from "@/lib/books/reader-storage";
import { cn } from "@/lib/utils";

export type ReaderChapterItem = {
  order: number;
  title: string;
};

type ReaderContentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  bookAuthor?: string;
  coverUrl?: string | null;
  chapters: ReaderChapterItem[];
  currentChapterOrder?: number;
  currentChapterScrollPercent?: number;
  bookmarks: ReaderBookmark[];
  onChapterSelect: (order: number) => void;
  onBookmarkSelect: (bookmark: ReaderBookmark) => void;
  onBookmarkRemove: (bookmarkId: string) => void;
};

type ContentsTab = "toc" | "bookmarks";

export function ReaderContentsDialog({
  open,
  onOpenChange,
  bookTitle,
  bookAuthor,
  coverUrl,
  chapters,
  currentChapterOrder,
  currentChapterScrollPercent = 0,
  bookmarks,
  onChapterSelect,
  onBookmarkSelect,
  onBookmarkRemove,
}: ReaderContentsDialogProps) {
  const t = useTranslations("reader");
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<ContentsTab>("toc");
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = Boolean(coverUrl) && !coverFailed;

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  const handleChapterClick = (order: number) => {
    onChapterSelect(order);
    onOpenChange(false);
  };

  const handleBookmarkClick = (bookmark: ReaderBookmark) => {
    onBookmarkSelect(bookmark);
    onOpenChange(false);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-100 cursor-default bg-overlay/30 touch-none"
        aria-label={t("contentsClose")}
        onClick={() => onOpenChange(false)}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed z-101 flex flex-col overflow-hidden border border-border/50 bg-card shadow-2xl",
          "max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:max-h-[min(82dvh,640px)] max-lg:w-full max-lg:rounded-t-2xl max-lg:rounded-b-none",
          "max-lg:animate-in max-lg:fade-in-0 max-lg:slide-in-from-bottom-4 max-lg:duration-200",
          "lg:top-14 lg:bottom-14 lg:right-10 lg:left-auto lg:w-[min(88%,28rem)] lg:rounded-2xl",
          "lg:animate-in lg:fade-in-0 lg:slide-in-from-right-4 lg:duration-200 motion-reduce:animate-none",
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border/50 px-4 py-3 max-lg:pt-4 sm:px-5 sm:py-4">
          <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md border border-border/40 bg-background shadow-sm max-lg:h-14 max-lg:w-10 sm:h-[72px] sm:w-12">
            {showCover ? (
              <Image
                src={coverUrl!}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
                unoptimized={isAuthenticatedBookAssetUrl(coverUrl!)}
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">
                <ListTree className="h-5 w-5 text-muted-foreground/60" aria-hidden />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id={titleId}
              className="font-display line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight sm:text-base"
            >
              {bookTitle}
            </h2>
            {bookAuthor ? (
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{bookAuthor}</p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            onClick={() => onOpenChange(false)}
            aria-label={t("contentsClose")}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div
          className="flex shrink-0 border-b border-border/50 px-4 sm:px-5"
          role="tablist"
          aria-label={t("contentsTabs")}
        >
          {(
            [
              { id: "toc" as const, label: t("toc") },
              { id: "bookmarks" as const, label: t("bookmarksTab") },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={cn(
                "relative -mb-px min-h-11 px-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {activeTab === tab.id ? (
                <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {activeTab === "toc" ? (
            <ul className="divide-y divide-border/40">
              {chapters.map((chapter) => {
                const isCurrent = chapter.order === currentChapterOrder;
                const progressLabel = isCurrent ? `${currentChapterScrollPercent}%` : null;

                return (
                  <li key={chapter.order}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 sm:px-5 sm:py-3.5",
                        isCurrent && "bg-secondary/30",
                      )}
                      onClick={() => handleChapterClick(chapter.order)}
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-sm leading-snug",
                          isCurrent ? "font-medium text-primary" : "text-foreground",
                        )}
                      >
                        {chapter.title}
                      </span>
                      {progressLabel != null ? (
                        <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                          {progressLabel}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : bookmarks.length > 0 ? (
            <ul className="divide-y divide-border/40">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="group flex items-stretch">
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-secondary/40 sm:px-5 sm:py-3.5"
                    onClick={() => handleBookmarkClick(bookmark)}
                  >
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                      {bookmark.chapterTitle}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("bookmarkChapterLabel", { order: bookmark.chapterOrder })}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="my-2 mr-3 h-9 w-9 shrink-0 rounded-lg opacity-70 group-hover:opacity-100"
                    aria-label={t("removeBookmark")}
                    onClick={() => onBookmarkRemove(bookmark.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5 sm:py-10">
              {t("bookmarksEmpty")}
            </p>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}
