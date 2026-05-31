"use client";

import { useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  LibraryBookGridCard,
  LibraryBookListRow,
} from "@/components/bookified/library-book-card";
import { useLibraryColumnCount } from "@/hooks/use-library-column-count";
import type { LibraryBook } from "@/lib/books/library-offline";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const VIRTUALIZE_THRESHOLD = 24;
const LIST_ROW_ESTIMATE = 96;
const GRID_ROW_ESTIMATE = 320;

export type LibraryBookCardHandlers = {
  isFavorite: (bookId: string) => boolean;
  isDeleting: (bookId: string) => boolean;
  onToggleFavorite: (bookId: string) => void;
  onDelete: (bookId: string, title: string, author?: string, format?: string, coverAssetId?: string | null) => void;
};

type LibraryBooksViewProps = {
  books: LibraryBook[];
  viewMode: "grid" | "list";
  progressByBookId: Map<string, number>;
  handlers: LibraryBookCardHandlers;
};

function useMainScrollElement() {
  const [scrollElement] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.getElementById("main-content") : null,
  );

  return scrollElement;
}

function LibraryBooksGrid({
  books,
  progressByBookId,
  handlers,
}: Omit<LibraryBooksViewProps, "viewMode">) {
  const columnCount = useLibraryColumnCount();
  const scrollElement = useMainScrollElement();
  const rowCount = Math.ceil(books.length / columnCount);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns unstable refs by design
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => GRID_ROW_ESTIMATE,
    overscan: 2,
  });

  return (
    <div
      className="relative w-full"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const startIndex = virtualRow.index * columnCount;
        const rowBooks = books.slice(startIndex, startIndex + columnCount);

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 top-0 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            {rowBooks.map((book, columnIndex) => {
              const index = startIndex + columnIndex;
              return (
                <LibraryBookGridCard
                  key={book._id}
                  book={book}
                  index={index}
                  progress={progressByBookId.get(book._id) ?? 0}
                  isFavorite={handlers.isFavorite(book._id)}
                  isDeleting={handlers.isDeleting(book._id)}
                  onToggleFavorite={handlers.onToggleFavorite}
                  onDelete={handlers.onDelete}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function LibraryBooksList({
  books,
  progressByBookId,
  handlers,
}: Omit<LibraryBooksViewProps, "viewMode">) {
  const scrollElement = useMainScrollElement();

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual returns unstable refs by design
  const rowVirtualizer = useVirtualizer({
    count: books.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => LIST_ROW_ESTIMATE,
    overscan: 6,
  });

  return (
    <div
      className="relative flex flex-col divide-y divide-border/50 rounded-xl border border-border/50 bg-card/50 px-4"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const book = books[virtualRow.index];
        if (!book) return null;

        return (
          <div
            key={book._id}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 top-0 w-full px-0"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            <VirtualLibraryListItem
              book={book}
              index={virtualRow.index}
              progress={progressByBookId.get(book._id) ?? 0}
              handlers={handlers}
            />
          </div>
        );
      })}
    </div>
  );
}

function VirtualLibraryListItem({
  book,
  index,
  progress,
  handlers,
}: {
  book: LibraryBook;
  index: number;
  progress: number;
  handlers: LibraryBookCardHandlers;
}) {
  return (
    <LibraryBookListRow
      book={book}
      index={index}
      progress={progress}
      isFavorite={handlers.isFavorite(book._id)}
      isDeleting={handlers.isDeleting(book._id)}
      onToggleFavorite={handlers.onToggleFavorite}
      onDelete={handlers.onDelete}
    />
  );
}

export function LibraryBooksView({
  books,
  viewMode,
  progressByBookId,
  handlers,
}: LibraryBooksViewProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const useVirtual = books.length >= VIRTUALIZE_THRESHOLD;

  const staticGrid = (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
        !prefersReducedMotion && "animate-in fade-in duration-300",
      )}
    >
      {books.map((book, index) => (
        <LibraryBookGridCard
          key={book._id}
          book={book}
          index={index}
          progress={progressByBookId.get(book._id) ?? 0}
          isFavorite={handlers.isFavorite(book._id)}
          isDeleting={handlers.isDeleting(book._id)}
          onToggleFavorite={handlers.onToggleFavorite}
          onDelete={handlers.onDelete}
        />
      ))}
    </div>
  );

  const staticList = (
    <div
      className={cn(
        "flex flex-col divide-y divide-border/50 rounded-xl border border-border/50 bg-card/50 px-4",
        !prefersReducedMotion && "animate-in fade-in duration-300",
      )}
    >
      {books.map((book, index) => (
        <VirtualLibraryListItem
          key={book._id}
          book={book}
          index={index}
          progress={progressByBookId.get(book._id) ?? 0}
          handlers={handlers}
        />
      ))}
    </div>
  );

  if (!useVirtual) {
    return viewMode === "grid" ? staticGrid : staticList;
  }

  return viewMode === "grid" ? (
    <LibraryBooksGrid books={books} progressByBookId={progressByBookId} handlers={handlers} />
  ) : (
    <LibraryBooksList books={books} progressByBookId={progressByBookId} handlers={handlers} />
  );
}
