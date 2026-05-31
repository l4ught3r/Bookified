import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { deleteBookFile, uploadBookFile } from "@/lib/storage/book-storage";

const MAX_COVER_BYTES = 5 * 1024 * 1024;

const ALLOWED_COVER_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type ResolvedCoverUpload = {
  buffer: Buffer;
  mediaType: string;
};

function inferMediaTypeFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function normalizeCoverMediaType(mediaType: string | null | undefined, fallback = "image/jpeg"): string {
  const normalized = mediaType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (ALLOWED_COVER_TYPES.has(normalized)) {
    return normalized;
  }
  return fallback;
}

export async function resolveCustomCoverUpload(formData: FormData): Promise<ResolvedCoverUpload | null> {
  const coverFile = formData.get("cover");
  if (coverFile instanceof File && coverFile.size > 0) {
    const buffer = Buffer.from(await coverFile.arrayBuffer());
    if (buffer.length > MAX_COVER_BYTES) {
      throw new Error("Обложка слишком большая (максимум 5 MB)");
    }

    const mediaType = normalizeCoverMediaType(coverFile.type);
    if (!coverFile.type.startsWith("image/") && !ALLOWED_COVER_TYPES.has(mediaType)) {
      throw new Error("Обложка должна быть изображением (JPEG, PNG, WEBP, GIF)");
    }

    return { buffer, mediaType };
  }

  const coverUrl = String(formData.get("coverUrl") ?? "").trim();
  if (!coverUrl) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(coverUrl);
  } catch {
    throw new Error("Некорректный URL обложки");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("URL обложки должен начинаться с http:// или https://");
  }

  const response = await fetch(parsedUrl.toString(), {
    headers: { Accept: "image/*" },
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить обложку по указанному URL");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Файл обложки пустой");
  }
  if (buffer.length > MAX_COVER_BYTES) {
    throw new Error("Обложка по URL слишком большая (максимум 5 MB)");
  }

  const mediaType = normalizeCoverMediaType(
    response.headers.get("content-type"),
    inferMediaTypeFromUrl(parsedUrl.pathname),
  );

  return { buffer, mediaType };
}

export async function saveBookCoverAsset(
  bookId: string,
  cover: ResolvedCoverUpload,
  uploadedStoragePaths: string[] = [],
): Promise<string> {
  const oldCovers = await db
    .select()
    .from(assets)
    .where(and(eq(assets.bookId, bookId), eq(assets.kind, "cover")));

  for (const asset of oldCovers) {
    try {
      await deleteBookFile(asset.storagePath);
    } catch (error) {
      console.error(`Failed to delete old cover file ${asset.storagePath}:`, error);
    }
  }

  await db.delete(assets).where(and(eq(assets.bookId, bookId), eq(assets.kind, "cover")));

  const coverPath = await uploadBookFile(cover.buffer, `covers/${bookId}/cover`, cover.mediaType);
  uploadedStoragePaths.push(coverPath);

  const [coverAsset] = await db
    .insert(assets)
    .values({
      bookId,
      href: "__cover__",
      mediaType: cover.mediaType,
      kind: "cover",
      storagePath: coverPath,
    })
    .returning();

  if (!coverAsset) {
    throw new Error("Failed to save cover asset");
  }

  return coverAsset.id;
}

export async function applyCustomCoverIfProvided(
  bookId: string,
  formData: FormData,
  uploadedStoragePaths: string[],
): Promise<string | null> {
  const cover = await resolveCustomCoverUpload(formData);
  if (!cover) {
    return null;
  }

  return saveBookCoverAsset(bookId, cover, uploadedStoragePaths);
}
