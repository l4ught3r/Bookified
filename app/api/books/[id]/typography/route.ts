import { NextResponse } from "next/server";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";
import { loadTypographyDocument } from "@/lib/books/typography-document-storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    const book = access.book;

    if (!book.typographyStoragePath) {
      return NextResponse.json({ error: "Typography document not found" }, { status: 404 });
    }

    const document = await loadTypographyDocument(book.typographyStoragePath);
    if (!document) {
      return NextResponse.json({ error: "Typography document is unreadable" }, { status: 404 });
    }

    return NextResponse.json({
      extractedAt: book.typographyExtractedAt,
      document,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load typography document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
