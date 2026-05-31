import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isBookIdUuid } from "@/lib/books/book-id";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { serializeBook, type BookWithLegacyId } from "@/lib/db/types";

export async function requireBookAccess(
  bookId: string,
  request: NextRequest | Request,
) {
  if (!isBookIdUuid(bookId)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Book not found" }, { status: 404 }),
    };
  }

  const authResult = await requireUser(request);
  if (authResult.unauthorized) {
    return { ok: false as const, response: authResult.unauthorized };
  }

  const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
  if (!book || book.userId !== authResult.userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Book not found" }, { status: 404 }),
    };
  }

  const bookWithLegacyId: BookWithLegacyId = serializeBook(book);

  return {
    ok: true as const,
    userId: authResult.userId,
    book: bookWithLegacyId,
  };
}

export function bookAccessError(result: { response: NextResponse }): NextResponse {
  return result.response;
}

export async function getBookById(bookId: string) {
  const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
  return book ?? null;
}

export async function updateBookById(
  bookId: string,
  values: Partial<typeof books.$inferInsert>,
) {
  const [updated] = await db
    .update(books)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(books.id, bookId))
    .returning();

  return updated ?? null;
}
