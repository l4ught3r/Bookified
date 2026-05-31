// src/lib/parsers/BaseParser.ts
import type { ReadingTypographySettings } from "../books/reading-typography";
import type { EpubTypographyDocument } from "../core/typography/types";

export interface ParsedChapter {
  order: number;
  title: string;
  href: string;
  html: string;
  text: string;
  wordCount: number;
}

export interface ParsedAsset {
  href: string;
  mediaType: string;
  kind: "image" | "style" | "font" | "cover" | "other";
  data: Buffer;
}

export interface ParsedTocItem {
  title: string;
  href: string;
  order: number;
  level: number;
}

export interface ParsedBook {
  title: string;
  authors: string[];
  language: string;
  description: string;
  identifier: string;
  publisher: string;
  publishDate: string;
  chapters: ParsedChapter[];
  assets: ParsedAsset[];
  toc: ParsedTocItem[];
  coverData: Buffer | null;
  coverMediaType: string;
  typography?: ReadingTypographySettings;
  typographyDocument?: EpubTypographyDocument;
}

export abstract class BaseParser {
  protected buffer: Buffer;
  protected bookId: string;

  constructor(buffer: Buffer, bookId: string) {
    this.buffer = buffer;
    this.bookId = bookId;
  }

  abstract parse(): Promise<ParsedBook>;
}
