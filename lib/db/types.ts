import type { ReadingTypographySettings } from "@/lib/books/reading-typography";

export type BookFormat = "epub" | "fb2" | "txt" | "pdf" | "mobi";
export type BookStatus = "uploaded" | "parsing" | "parsed" | "error";
export type AssetKind = "image" | "style" | "font" | "cover" | "other";

export type TocItem = {
  title: string;
  href: string;
  order: number;
  level: number;
  chapterId?: string;
};

export type BookRecord = {
  id: string;
  userId: string;
  title: string;
  authors: string[];
  language: string;
  description: string;
  identifier: string;
  identifierNormalized: string;
  publisher: string;
  publishDate: string;
  format: BookFormat;
  coverAssetId: string | null;
  toc: TocItem[];
  totalChapters: number;
  totalWords: number;
  status: BookStatus;
  errorMessage: string;
  originalStoragePath: string | null;
  contentHash: string;
  readingTypography: ReadingTypographySettings | null;
  typographyStoragePath: string | null;
  typographyExtractedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChapterRecord = {
  id: string;
  bookId: string;
  order: number;
  title: string;
  href: string;
  storagePath: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AssetRecord = {
  id: string;
  bookId: string;
  href: string;
  mediaType: string;
  kind: AssetKind;
  storagePath: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BookWithLegacyId = BookRecord & { _id: string };
export type ChapterWithLegacyId = ChapterRecord & { _id: string };
export type AssetWithLegacyId = AssetRecord & { _id: string };

export function withLegacyId<T extends { id: string }>(row: T): T & { _id: string } {
  return { ...row, _id: row.id };
}

export function serializeBook(book: BookRecord): BookWithLegacyId {
  return withLegacyId(book);
}

export function serializeChapter(chapter: ChapterRecord): ChapterWithLegacyId {
  return withLegacyId(chapter);
}

export function serializeAsset(asset: AssetRecord): AssetWithLegacyId {
  return withLegacyId(asset);
}
