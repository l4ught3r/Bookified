"use client";

import { useState } from "react";
import Image from "next/image";
import { isAuthenticatedBookAssetUrl } from "@/lib/books/asset-url";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
        "flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-reading-bg px-4 py-8 sm:px-6 sm:py-10",
        className,
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="relative mb-8 aspect-[2/3] w-full max-w-[280px] overflow-hidden rounded-2xl border border-border/40 bg-card shadow-lg">
          {showCover && coverUrl ? (
            <Image
              src={coverUrl}
              alt={title}
              fill
              className="object-cover"
              sizes="280px"
              priority
              unoptimized={isAuthenticatedBookAssetUrl(coverUrl)}
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-secondary p-8">
              <span className="text-balance text-2xl font-semibold leading-tight text-foreground/80">
                {title}
              </span>
            </div>
          )}
        </div>

        <h1 className="text-balance text-[clamp(1.5rem,2vw+1rem,1.875rem)] font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-muted-foreground">{authorLine}</p>

        <Button className="mt-8 gap-2 rounded-xl px-8" size="lg" onClick={onStartReading}>
          {t("startReading")}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
