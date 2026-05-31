"use client";

import { useState } from "react";
import { Bookmark, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { BookCoverFormatBadge } from "@/components/bookified/book-format-badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isAuthenticatedBookAssetUrl } from "@/lib/books/asset-url";
import type { LibraryBook } from "@/lib/books/library-offline";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

type LibraryBookCardProps = {
  book: LibraryBook;
  index: number;
  progress: number;
  isFavorite: boolean;
  isDeleting: boolean;
  onToggleFavorite: (bookId: string) => void;
  onDelete: (
    bookId: string,
    title: string,
    author?: string,
    format?: string,
    coverAssetId?: string | null,
  ) => void;
};

const coverActionClass =
  "h-9 w-9 rounded-lg shadow-sm transition-colors sm:h-11 sm:w-11 sm:rounded-xl";

const listActionClass =
  "h-9 w-9 rounded-lg shadow-sm transition-colors sm:h-11 sm:w-11 sm:rounded-xl";

function stopCardNavigation(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function CoverProgress({ progress }: { progress: number }) {
  if (progress <= 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 h-1.5 overflow-hidden bg-foreground/15">
      <div
        className="h-full origin-left bg-primary transition-transform duration-300"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}

function BookCoverPlaceholder({ title }: { title: string }) {
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary p-4">
      <span className="text-center text-lg font-semibold leading-tight text-foreground/70">
        {initials || "?"}
      </span>
    </div>
  );
}

function BookCoverImage({
  book,
  index,
  className,
  imageClassName,
  sizes,
  width,
  height,
}: {
  book: LibraryBook;
  index: number;
  className?: string;
  imageClassName?: string;
  sizes: string;
  width: number;
  height: number;
}) {
  const coverSrc = book.coverAssetId ? `/api/books/${book._id}/assets/${book.coverAssetId}` : null;
  const [coverFailed, setCoverFailed] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-secondary transition-[filter,box-shadow] duration-300 [@media(hover:hover)]:group-hover:brightness-105 [@media(hover:hover)]:group-hover:ring-2 [@media(hover:hover)]:group-hover:ring-primary/15",
        className,
      )}
    >
      {coverSrc && !coverFailed ? (
        <Image
          src={coverSrc}
          alt={book.title}
          className={cn("h-full w-full object-cover", imageClassName)}
          width={width}
          height={height}
          sizes={sizes}
          priority={index < 5}
          loading={index < 5 ? undefined : "lazy"}
          unoptimized={isAuthenticatedBookAssetUrl(coverSrc)}
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <BookCoverPlaceholder title={book.title} />
      )}
    </div>
  );
}

function BookMeta({ book, className }: { book: LibraryBook; className?: string }) {
  const tCommon = useTranslations("common");
  const author = book.authors?.[0]?.trim();

  return (
    <div className={className}>
      <h3 className="font-display line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight">
        {book.title}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
        {author || tCommon("unknownAuthor")}
      </p>
    </div>
  );
}

function DeleteBookButton({
  book,
  isDeleting,
  onDelete,
  className,
}: Pick<LibraryBookCardProps, "book" | "isDeleting" | "onDelete"> & {
  className: string;
}) {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={className}
          disabled={isDeleting}
          onClick={(event) => {
            stopCardNavigation(event);
            onDelete(book._id, book.title, book.authors?.[0], book.format, book.coverAssetId);
          }}
          aria-label={isDeleting ? tCommon("deleting") : t("deleteBook")}
        >
          {isDeleting ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isDeleting ? tCommon("deleting") : t("deleteBook")}
      </TooltipContent>
    </Tooltip>
  );
}

export function LibraryBookGridCard({
  book,
  index,
  progress,
  isFavorite,
  isDeleting,
  onToggleFavorite,
  onDelete,
}: LibraryBookCardProps) {
  const t = useTranslations("library");
  const href = `/reader/${book._id}`;

  return (
    <article className="@container group [contain-intrinsic-size:auto_300px] [content-visibility:auto]">
      <div className="relative mb-3 aspect-2/3 overflow-hidden rounded-xl">
        <Link
          href={href}
          className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <BookCoverImage
            book={book}
            index={index}
            className="h-full rounded-xl"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            width={200}
            height={300}
          />
          <BookCoverFormatBadge format={book.format} />
          <CoverProgress progress={progress} />
        </Link>

        <div className="absolute left-1.5 top-1.5 z-20 sm:left-2 sm:top-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={isFavorite ? "default" : "secondary"}
                size="icon"
                className={coverActionClass}
                onClick={(event) => {
                  stopCardNavigation(event);
                  onToggleFavorite(book._id);
                }}
                aria-label={isFavorite ? t("favoriteRemove") : t("favoriteAdd")}
              >
                <Bookmark className={cn("h-4 w-4", isFavorite && "fill-current")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isFavorite ? t("favoriteRemove") : t("favoriteAdd")}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="absolute right-1.5 top-1.5 z-20 sm:right-2 sm:top-2">
          <DeleteBookButton
            book={book}
            isDeleting={isDeleting}
            onDelete={onDelete}
            className={coverActionClass}
          />
        </div>
      </div>

      <Link
        href={href}
        className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BookMeta book={book} />
      </Link>
    </article>
  );
}

export function LibraryBookListRow({
  book,
  index,
  progress,
  isFavorite,
  isDeleting,
  onToggleFavorite,
  onDelete,
}: LibraryBookCardProps) {
  const t = useTranslations("library");

  return (
    <article className="@container group flex items-center gap-3 py-1 sm:gap-4 [contain-intrinsic-size:auto_96px] [content-visibility:auto] transition-colors duration-200 [@media(hover:hover)]:hover:bg-secondary/30">
      <Link
        href={`/reader/${book._id}`}
        className="relative flex h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-20 sm:w-14"
      >
        <BookCoverImage
          book={book}
          index={index}
          className="h-full rounded-lg"
          sizes="56px"
          width={56}
          height={84}
        />
        <BookCoverFormatBadge format={book.format} className="bottom-1.5 left-1 scale-90" />
        <CoverProgress progress={progress} />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/reader/${book._id}`}
          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BookMeta book={book} />
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={isFavorite ? "default" : "secondary"}
              size="icon"
              className={listActionClass}
              onClick={() => onToggleFavorite(book._id)}
              aria-label={isFavorite ? t("favoriteRemove") : t("favoriteAdd")}
            >
              <Bookmark className={cn("h-4 w-4", isFavorite && "fill-current")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isFavorite ? t("favoriteRemove") : t("favoriteAdd")}
          </TooltipContent>
        </Tooltip>

        <DeleteBookButton
          book={book}
          isDeleting={isDeleting}
          onDelete={onDelete}
          className={listActionClass}
        />
      </div>
    </article>
  );
}
