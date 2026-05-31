import { NextResponse } from "next/server";
import { bookAccessError, requireBookAccess } from "@/lib/auth/require-book-access";
import { findBookAssetByHref } from "@/lib/books/find-book-asset";
import { resolveMissingBookAsset } from "@/lib/books/resolve-missing-asset";
import { downloadBookFile } from "@/lib/storage/book-storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; href: string[] }> },
) {
  try {
    const { id, href } = await params;
    const access = await requireBookAccess(id, request);
    if (!access.ok) {
      return bookAccessError(access);
    }

    const assetHref = href.map((part) => decodeURIComponent(part)).join("/");
    let asset = await findBookAssetByHref(access.book._id, assetHref);
    if (!asset) {
      asset = await resolveMissingBookAsset(id, assetHref);
    }
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const data = await downloadBookFile(asset.storagePath);
    const isFont =
      asset.kind === "font" ||
      asset.mediaType.includes("font") ||
      asset.mediaType.includes("opentype") ||
      asset.mediaType.includes("woff");

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": asset.mediaType,
        "Cache-Control": isFont
          ? "private, max-age=604800, immutable"
          : "private, max-age=3600",
        "Content-Length": data.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
