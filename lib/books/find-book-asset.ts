import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import type { AssetRecord } from "@/lib/db/types";

export function normalizeAssetHref(href: string): string {
  return href.replace(/\\/g, "/").replace(/^\/+/, "");
}

import { BOOK_ID_UUID_RE } from "@/lib/books/book-id";

export async function findBookAssetByHref(
  bookId: string,
  href: string,
): Promise<AssetRecord | null> {
  const normalized = normalizeAssetHref(href);

  const [exact] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.bookId, bookId), eq(assets.href, normalized)))
    .limit(1);

  if (exact) return exact;

  const basename = normalized.split("/").pop();
  if (!basename) return null;

  const [byBasename] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.bookId, bookId), like(assets.href, `%/${basename}`)))
    .limit(1);

  return byBasename ?? null;
}

export async function findBookCoverAsset(bookId: string): Promise<AssetRecord | null> {
  const [cover] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.bookId, bookId), eq(assets.kind, "cover")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  return cover ?? null;
}

export async function findBookAssetById(
  bookId: string,
  assetId: string,
): Promise<AssetRecord | null> {
  if (BOOK_ID_UUID_RE.test(assetId)) {
    const [byId] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.bookId, bookId)))
      .limit(1);

    if (byId) return byId;
  }

  const [byStoragePath] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.bookId, bookId), eq(assets.storagePath, assetId)))
    .limit(1);

  if (byStoragePath) return byStoragePath;

  return findBookAssetByHref(bookId, decodeURIComponent(assetId));
}
