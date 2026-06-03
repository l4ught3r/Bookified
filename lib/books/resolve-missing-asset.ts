import { eq } from "drizzle-orm";
import { normalizeAssetHref } from "@/lib/books/find-book-asset";
import { readEpubEntryByHref } from "@/lib/books/read-epub-entry";
import { db } from "@/lib/db";
import { assets, books } from "@/lib/db/schema";
import type { AssetKind, AssetRecord } from "@/lib/db/types";
import { downloadBookFile, uploadBookFile } from "@/lib/storage/book-storage";

function detectAssetKind(mediaType: string, href: string): AssetKind {
  const normalizedType = mediaType.toLowerCase();
  const lowerHref = href.toLowerCase();

  if (normalizedType.startsWith("image/") || normalizedType.includes("svg")) return "image";
  if (normalizedType.includes("css")) return "style";
  if (
    normalizedType.includes("font") ||
    normalizedType.includes("opentype") ||
    normalizedType.includes("woff") ||
    normalizedType.includes("truetype")
  ) {
    return "font";
  }
  if (/\.(woff2?|otf|ttf|eot)(\?|$)/i.test(lowerHref)) return "font";
  if (/\.css(\?|$)/i.test(lowerHref)) return "style";
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(lowerHref)) return "image";
  return "other";
}

function guessMediaType(href: string): string {
  const ext = href.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "woff2":
      return "font/woff2";
    case "woff":
      return "font/woff";
    case "otf":
      return "font/otf";
    case "ttf":
      return "font/ttf";
    case "css":
      return "text/css";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export async function resolveMissingBookAsset(
  bookId: string,
  href: string,
): Promise<AssetRecord | null> {
  const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
  if (!book?.originalStoragePath || book.format !== "epub") {
    return null;
  }

  const normalizedHref = normalizeAssetHref(href);
  const epubBuffer = await downloadBookFile(book.originalStoragePath);
  const data = readEpubEntryByHref(epubBuffer, normalizedHref);
  if (!data || data.length === 0) {
    return null;
  }

  const mediaType = guessMediaType(normalizedHref);
  const storagePath = await uploadBookFile(
    data,
    `assets/${bookId}/${normalizedHref}`,
    mediaType,
  );

  const [asset] = await db
    .insert(assets)
    .values({
      bookId,
      href: normalizedHref,
      mediaType,
      kind: detectAssetKind(mediaType, normalizedHref),
      storagePath,
    })
    .returning();

  return asset ?? null;
}
