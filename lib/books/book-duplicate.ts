import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import type { BookFormat } from "@/lib/db/types";

export type DuplicateBookSummary = {
  _id: string;
  title: string;
  authors: string[];
  format: BookFormat;
};

export function computeBookContentHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function normalizeBookIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase().replace(/[\s-]+/g, "");
}

function toDuplicateSummary(book: {
  id: string;
  title: string;
  authors: string[] | null;
  format: BookFormat;
}): DuplicateBookSummary {
  return {
    _id: book.id,
    title: book.title,
    authors: book.authors ?? [],
    format: book.format,
  };
}

export async function findDuplicateBook(options: {
  contentHash: string;
  userId: string;
  identifier?: string;
}): Promise<DuplicateBookSummary | null> {
  const [byHash] = await db
    .select({
      id: books.id,
      title: books.title,
      authors: books.authors,
      format: books.format,
    })
    .from(books)
    .where(and(eq(books.contentHash, options.contentHash), eq(books.userId, options.userId)))
    .limit(1);

  if (byHash) {
    return toDuplicateSummary(byHash);
  }

  const identifierNormalized = options.identifier ? normalizeBookIdentifier(options.identifier) : "";
  if (!identifierNormalized) {
    return null;
  }

  const [byIdentifier] = await db
    .select({
      id: books.id,
      title: books.title,
      authors: books.authors,
      format: books.format,
    })
    .from(books)
    .where(
      and(eq(books.identifierNormalized, identifierNormalized), eq(books.userId, options.userId)),
    )
    .limit(1);

  if (!byIdentifier) {
    return null;
  }

  return toDuplicateSummary(byIdentifier);
}

export async function findDuplicateByIdentifier(
  identifier: string | undefined,
  userId: string,
): Promise<DuplicateBookSummary | null> {
  const identifierNormalized = identifier ? normalizeBookIdentifier(identifier) : "";
  if (!identifierNormalized) {
    return null;
  }

  const [byIdentifier] = await db
    .select({
      id: books.id,
      title: books.title,
      authors: books.authors,
      format: books.format,
    })
    .from(books)
    .where(
      and(eq(books.identifierNormalized, identifierNormalized), eq(books.userId, userId)),
    )
    .limit(1);

  if (!byIdentifier) {
    return null;
  }

  return toDuplicateSummary(byIdentifier);
}
