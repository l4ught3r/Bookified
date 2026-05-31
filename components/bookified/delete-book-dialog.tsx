"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { getFormatMeta } from "@/lib/books/book-formats";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { isAuthenticatedBookAssetUrl } from "@/lib/books/asset-url";
import { cn } from "@/lib/utils";

export type DeleteBookDialogProps = {
  open: boolean;
  bookId?: string | null;
  bookTitle: string | null;
  bookAuthor?: string | null;
  bookFormat?: string | null;
  coverAssetId?: string | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

function BookCoverThumb({
  bookId,
  bookTitle,
  coverAssetId,
}: {
  bookId?: string | null;
  bookTitle: string | null;
  coverAssetId?: string | null;
}) {
  const coverSrc =
    bookId && coverAssetId ? `/api/books/${bookId}/assets/${coverAssetId}` : null;
  const [failed, setFailed] = useState(false);

  const initials = (bookTitle ?? "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative aspect-2/3 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted shadow-sm">
      {coverSrc && !failed ? (
        <Image
          src={coverSrc}
          alt=""
          fill
          className="object-cover"
          sizes="72px"
          unoptimized={isAuthenticatedBookAssetUrl(coverSrc)}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-1.5">
          <span className="text-center text-xs font-semibold leading-tight text-muted-foreground">
            {initials || "?"}
          </span>
        </div>
      )}
    </div>
  );
}

function SoftFormatTag({ format }: { format?: string | null }) {
  const meta = getFormatMeta(format);
  if (!meta) return null;

  return (
    <span className="inline-flex rounded-md border border-primary/15 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
      {meta.label}
    </span>
  );
}

export function DeleteBookDialog({
  open,
  bookId,
  bookTitle,
  bookAuthor,
  bookFormat,
  coverAssetId,
  isDeleting,
  onOpenChange,
  onConfirm,
}: DeleteBookDialogProps) {
  const t = useTranslations("deleteBook");
  const tCommon = useTranslations("common");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isDeleting) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!isDeleting}
        className={cn(
          "gap-0 overflow-hidden rounded-2xl border-border/60 p-0",
          "shadow-[0_20px_60px_-20px_var(--shadow-soft)] sm:max-w-[26rem]",
        )}
      >
        <div className="border-b border-border/50 px-5 py-4 pr-12">
          <DialogTitle className="font-display text-left text-lg font-semibold tracking-tight">
            {t("title")}
          </DialogTitle>
        </div>

        <div className="space-y-4 px-5 py-5">
          {bookTitle ? (
            <div className="flex gap-4 rounded-xl border border-border/50 bg-secondary/40 p-4">
              <BookCoverThumb
                bookId={bookId}
                bookTitle={bookTitle}
                coverAssetId={coverAssetId}
              />
              <div className="min-w-0 flex-1">
                <p className="font-display line-clamp-2 text-base font-semibold leading-snug tracking-tight">
                  {bookTitle}
                </p>
                {bookAuthor ? (
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{bookAuthor}</p>
                ) : null}
                {bookFormat ? (
                  <div className="mt-2.5">
                    <SoftFormatTag format={bookFormat} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/8 px-3.5 py-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              aria-hidden
            />
            <DialogDescription className="text-left text-sm leading-relaxed text-destructive/90">
              {t("description")}
            </DialogDescription>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 bg-secondary/25 px-5 py-4">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              className="h-10 min-w-[5.5rem] rounded-xl px-4"
            >
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            className="h-10 min-w-[5.5rem] rounded-xl px-4"
            onClick={onConfirm}
          >
            {isDeleting ? (
              <>
                <Spinner className="h-4 w-4" />
                {tCommon("deleting")}
              </>
            ) : (
              tCommon("delete")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
