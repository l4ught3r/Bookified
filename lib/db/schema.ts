import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ReadingTypographySettings } from "@/lib/books/reading-typography";
import type { TocItem } from "@/lib/db/types";

export const bookFormatEnum = pgEnum("book_format", ["epub", "fb2", "txt", "pdf", "mobi"]);
export const bookStatusEnum = pgEnum("book_status", ["uploaded", "parsing", "parsed", "error"]);
export const assetKindEnum = pgEnum("asset_kind", ["image", "style", "font", "cover", "other"]);

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull().default("Без названия"),
    authors: text("authors").array().notNull().default([]),
    language: text("language").notNull().default("none"),
    description: text("description").notNull().default(""),
    identifier: text("identifier").notNull().default(""),
    identifierNormalized: text("identifier_normalized").notNull().default(""),
    publisher: text("publisher").notNull().default(""),
    publishDate: text("publish_date").notNull().default(""),
    format: bookFormatEnum("format").notNull(),
    coverAssetId: uuid("cover_asset_id"),
    toc: jsonb("toc").$type<TocItem[]>().notNull().default([]),
    totalChapters: integer("total_chapters").notNull().default(0),
    totalWords: integer("total_words").notNull().default(0),
    status: bookStatusEnum("status").notNull().default("uploaded"),
    errorMessage: text("error_message").notNull().default(""),
    originalStoragePath: text("original_storage_path"),
    contentHash: text("content_hash").notNull().default(""),
    readingTypography: jsonb("reading_typography").$type<ReadingTypographySettings | null>(),
    typographyStoragePath: text("typography_storage_path"),
    typographyExtractedAt: timestamp("typography_extracted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("books_user_id_idx").on(table.userId),
    index("books_content_hash_idx").on(table.contentHash),
    index("books_identifier_normalized_idx").on(table.identifierNormalized),
    index("books_status_idx").on(table.status),
  ],
);

export const chapters = pgTable(
  "chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    title: text("title").notNull().default(""),
    href: text("href").notNull().default(""),
    storagePath: text("storage_path").notNull(),
    wordCount: integer("word_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("chapters_book_id_idx").on(table.bookId),
    uniqueIndex("chapters_book_id_order_idx").on(table.bookId, table.order),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    href: text("href").notNull(),
    mediaType: text("media_type").notNull().default("application/octet-stream"),
    kind: assetKindEnum("kind").notNull().default("other"),
    storagePath: text("storage_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assets_book_id_href_idx").on(table.bookId, table.href)],
);

export const booksRelations = relations(books, ({ many }) => ({
  chapters: many(chapters),
  assets: many(assets),
}));

export const chaptersRelations = relations(chapters, ({ one }) => ({
  book: one(books, {
    fields: [chapters.bookId],
    references: [books.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  book: one(books, {
    fields: [assets.bookId],
    references: [books.id],
  }),
}));

export type BookRow = typeof books.$inferSelect;
export type BookInsert = typeof books.$inferInsert;
export type ChapterRow = typeof chapters.$inferSelect;
export type ChapterInsert = typeof chapters.$inferInsert;
export type AssetRow = typeof assets.$inferSelect;
export type AssetInsert = typeof assets.$inferInsert;
