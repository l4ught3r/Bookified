"use client";

import { forwardRef, memo } from "react";
import { Loader2 } from "lucide-react";
import { ChapterBlockView } from "@/components/bookified/chapter-block-view";
import type { ChapterBlock } from "@/lib/books/chapter-blocks";
import { cn } from "@/lib/utils";

export type ReadingChapterBodyProps = {
  chapterOrder: number | undefined;
  prefersReducedMotion: boolean;
  derivedTitle: string;
  derivedAuthor: string;
  derivedChapterTitle: string;
  readingContentClassName: string;
  readingContentStyle: React.CSSProperties;
  chapterHtmlMarkup: { __html: string } | null;
  contentBlocks: ChapterBlock[];
  isLoading: boolean;
  hasChapter: boolean;
  chapterContentClassName: string;
  loadingChapterLabel: string;
  emptyChapterLabel: string;
};

/** Isolated chapter DOM — must not re-render when selection toolbar state changes. */
export const ReadingChapterBody = memo(
  forwardRef<HTMLDivElement, ReadingChapterBodyProps>(function ReadingChapterBody(
    {
      chapterOrder,
      prefersReducedMotion,
      derivedTitle,
      derivedAuthor,
      derivedChapterTitle,
      readingContentClassName,
      readingContentStyle,
      chapterHtmlMarkup,
      contentBlocks,
      isLoading,
      hasChapter,
      chapterContentClassName,
      loadingChapterLabel,
      emptyChapterLabel,
    },
    ref,
  ) {
    return (
      <article
        key={chapterOrder ?? "empty"}
        className={cn(
          "mx-auto max-w-3xl",
          !prefersReducedMotion &&
            "animate-in fade-in-0 slide-in-from-bottom-4 duration-500 motion-reduce:animate-none",
        )}
      >
        <div ref={ref} className={readingContentClassName} style={readingContentStyle}>
          <header className="mb-12 text-center">
            <p className="mb-2 text-sm font-medium tracking-wider text-muted-foreground font-sans">
              {derivedTitle} - {derivedAuthor}
            </p>
            <h2 className="text-sm font-sans text-muted-foreground">{derivedChapterTitle}</h2>
          </header>

          <div className="space-y-6">
            {isLoading && hasChapter ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {loadingChapterLabel}
              </div>
            ) : chapterHtmlMarkup ? (
              <div
                className={chapterContentClassName}
                dangerouslySetInnerHTML={chapterHtmlMarkup}
              />
            ) : contentBlocks.length > 0 ? (
              <div className={chapterContentClassName}>
                {contentBlocks.map((block) => (
                  <ChapterBlockView key={block.id} block={block} />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground">{emptyChapterLabel}</p>
            )}
          </div>
        </div>
      </article>
    );
  }),
);

ReadingChapterBody.displayName = "ReadingChapterBody";
