// src/app/api/books/route.ts
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { serializeBook, type BookStatus } from "@/lib/db/types";

const libraryListColumns = {
  id: books.id,
  title: books.title,
  authors: books.authors,
  format: books.format,
  coverAssetId: books.coverAssetId,
  totalChapters: books.totalChapters,
  createdAt: books.createdAt,
};

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireUser(request);
    if (authResult.unauthorized) {
      return authResult.unauthorized;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const isListView = searchParams.get("view") === "list";

    const filters = [eq(books.userId, authResult.userId)];
    if (status) {
      filters.push(eq(books.status, status as BookStatus));
    }
    if (search) {
      const pattern = `%${search}%`;
      filters.push(or(ilike(books.title, pattern), ilike(books.description, pattern))!);
    }

    const whereClause = and(...filters);
    const skip = (page - 1) * limit;

    if (isListView) {
      const rows = await db
        .select(libraryListColumns)
        .from(books)
        .where(whereClause)
        .orderBy(desc(books.createdAt))
        .limit(limit);

      return NextResponse.json({
        books: rows.map((book) => ({ ...book, _id: book.id })),
        pagination: {
          page: 1,
          limit,
          total: rows.length,
          pages: 1,
        },
      });
    }

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(books)
        .where(whereClause)
        .orderBy(desc(books.createdAt))
        .offset(skip)
        .limit(limit),
      db.select({ total: count() }).from(books).where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return NextResponse.json({
      books: rows.map((book) => {
        const { toc, ...withoutToc } = serializeBook(book);
        void toc;
        return withoutToc;
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load books";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
