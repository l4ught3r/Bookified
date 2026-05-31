import { NextResponse } from "next/server";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";
import { downloadBookFile } from "@/lib/storage/book-storage";

const FORMAT_EXTENSION: Record<string, string> = {
  pdf: "pdf",
  epub: "epub",
  fb2: "fb2",
  txt: "txt",
  mobi: "mobi",
};

const FORMAT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  fb2: "application/x-fictionbook+xml",
  txt: "text/plain; charset=utf-8",
  mobi: "application/x-mobipocket-ebook",
};

function sanitizeFilename(title: string, extension: string): string {
  const base = title.replace(/[^\w\s.-]/gi, "").trim() || "book";
  return `${base}.${extension}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    const book = access.book;

    if (!book.originalStoragePath) {
      return NextResponse.json({ error: "Original file not found" }, { status: 404 });
    }

    const data = await downloadBookFile(book.originalStoragePath);
    const format = book.format ?? "bin";
    const extension = FORMAT_EXTENSION[format] ?? "bin";
    const filename = sanitizeFilename(book.title || "book", extension);
    const contentType = FORMAT_MIME[format] ?? "application/octet-stream";
    const download = new URL(request.url).searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": download
          ? `attachment; filename="${encodeURIComponent(filename)}"`
          : `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": data.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load book file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
