"use client";

import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReaderBookmark } from "@/lib/books/reader-storage";
import { cn } from "@/lib/utils";

type ReadingBookmarkMarkersProps = {
  bookmarks: ReaderBookmark[];
  onNavigate: (bookmark: ReaderBookmark) => void;
  isMobileLayout?: boolean;
};

function bookmarkMarkerClass(isMobileLayout: boolean) {
  return cn(
    "pointer-events-auto absolute -translate-y-1/2 flex items-center justify-center transition-colors",
    isMobileLayout
      ? "right-0 h-8 w-8 rounded-md border border-primary/30 bg-card text-primary shadow-sm hover:border-primary/50 hover:bg-secondary"
      : cn(
          "-right-14 h-9 w-9 rounded-lg border border-primary/30 bg-card shadow-md backdrop-blur-sm",
          "hover:border-primary/50 hover:bg-secondary",
        ),
  );
}

function bookmarkIconClass() {
  return "h-4 w-4 fill-primary text-primary";
}

export function ReadingBookmarkMarkers({
  bookmarks,
  onNavigate,
  isMobileLayout = false,
}: ReadingBookmarkMarkersProps) {
  const t = useTranslations("reader");

  if (bookmarks.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {bookmarks.map((bookmark) => (
        <button
          key={bookmark.id}
          type="button"
          className={bookmarkMarkerClass(isMobileLayout)}
          style={{ top: bookmark.scrollTop }}
          aria-label={t("openBookmark")}
          onClick={() => onNavigate(bookmark)}
        >
          <Bookmark className={bookmarkIconClass()} aria-hidden />
        </button>
      ))}
    </div>
  );
}
