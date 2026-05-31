"use client";

import type { ChapterBlock } from "@/lib/books/chapter-blocks";
import { cn } from "@/lib/utils";

type ChapterBlockViewProps = {
  block: ChapterBlock;
};

export function ChapterBlockView({ block }: ChapterBlockViewProps) {
  if (block.kind === "heading") {
    const level = block.level ?? 2;
    if (level <= 2) {
      return (
        <h2
          className={cn(
            level === 1 ? "text-2xl font-semibold" : "text-xl text-muted-foreground",
          )}
        >
          {block.text}
        </h2>
      );
    }

    return <h3 className="text-lg font-semibold">{block.text}</h3>;
  }

  if (block.kind === "list-item") {
    return <p className="pl-4">{block.text}</p>;
  }

  if (block.kind === "quote") {
    return (
      <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground">
        {block.text}
      </blockquote>
    );
  }

  if (block.kind === "pre") {
    return (
      <pre className="overflow-x-auto rounded-sm bg-secondary/40 p-4 text-sm">{block.text}</pre>
    );
  }

  return <p>{block.text}</p>;
}
