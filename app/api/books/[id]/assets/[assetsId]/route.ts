import { NextResponse } from "next/server";
import {
  bookAccessError,
  requireBookAccess,
  updateBookById,
} from "@/lib/auth/require-book-access";
import { resolveBookCoverAsset } from "@/lib/books/find-book-asset";
import { downloadBookFile } from "@/lib/storage/book-storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; assetsId: string }> },
) {
  try {
    const { id, assetsId } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    const { asset, source } = await resolveBookCoverAsset(
      access.book._id,
      assetsId,
      access.book.coverAssetId,
    );

    if (!asset) {
      if (access.book.coverAssetId) {
        await updateBookById(access.book._id, { coverAssetId: null });
      }

      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (
      asset.id !== access.book.coverAssetId &&
      (source === "coverKind" || source === "coverHref" || source === "bookCoverAssetId")
    ) {
      await updateBookById(access.book._id, { coverAssetId: asset.id });
    }

    const data = await downloadBookFile(asset.storagePath);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": asset.mediaType,
        "Cache-Control": "private, max-age=3600",
        "Content-Length": data.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
