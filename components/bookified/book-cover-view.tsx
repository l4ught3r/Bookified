"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { isAuthenticatedBookAssetUrl } from "@/lib/books/asset-url";
import { cn } from "@/lib/utils";

type BookCoverViewProps = {
  title: string;
  authors?: string[];
  coverUrl?: string | null;
  onStartReading: () => void;
  className?: string;
};

export function BookCoverView({
  title,
  authors = [],
  coverUrl,
  onStartReading,
  className,
}: BookCoverViewProps) {
  const t = useTranslations("reader");
  const tCommon = useTranslations("common");
  const authorLine = authors.length > 0 ? authors.join(", ") : tCommon("unknownAuthor");
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = Boolean(coverUrl) && !coverFailed;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col items-center overflow-y-auto bg-reading-bg px-4 py-6 sm:justify-center sm:px-6 sm:py-10",
        className,
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="relative mb-5 aspect-2/3 w-28 shrink-0 overflow-hidden rounded-2xl border border-border/40 bg-card shadow-lg sm:mb-8 sm:w-full sm:max-w-[280px]">
          {showCover && coverUrl ? (
            <Image
              src={coverUrl}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 112px, 280px"
              priority
              unoptimized={isAuthenticatedBookAssetUrl(coverUrl)}
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary p-3 sm:p-8">
              <span className="text-balance text-sm font-semibold leading-tight text-foreground/80 sm:text-2xl">
                {title}
              </span>
            </div>
          )}
        </div>

        <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-[clamp(1.5rem,2vw+1rem,1.875rem)]">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:mt-2 sm:text-base">{authorLine}</p>

        <Button
          className="mt-6 gap-2 rounded-xl px-8 sm:mt-8"
          size="lg"
          onClick={onStartReading}
        >
          {t("startReading")}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
