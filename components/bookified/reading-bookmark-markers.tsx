"use client";

import { Bookmark } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReaderBookmark } from "@/lib/books/reader-storage";
import { cn } from "@/lib/utils";

type ReadingBookmarkMarkersProps = {
  bookmarks: ReaderBookmark[];
  onNavigate: (bookmark: ReaderBookmark) => void;
};

export function ReadingBookmarkMarkers({ bookmarks, onNavigate }: ReadingBookmarkMarkersProps) {
  const t = useTranslations("reader");

  if (bookmarks.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {bookmarks.map((bookmark) => (
        <button
          key={bookmark.id}
          type="button"
          className={cn(
            "pointer-events-auto absolute -right-14 flex -translate-y-1/2",
            "h-9 w-9 items-center justify-center rounded-lg border border-primary/30",
            "bg-card shadow-md backdrop-blur-sm transition-colors",
            "hover:border-primary/50 hover:bg-secondary",
          )}
          style={{ top: bookmark.scrollTop }}
          aria-label={t("openBookmark")}
          onClick={() => onNavigate(bookmark)}
        >
          <Bookmark className="h-4 w-4 fill-primary text-primary" aria-hidden />
        </button>
      ))}
    </div>
  );
}
