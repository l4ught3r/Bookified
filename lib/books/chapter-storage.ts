import { downloadBookFile, uploadBookFile } from "@/lib/storage/book-storage";

export type ChapterContent = {
  html: string;
  text: string;
};

const CHAPTER_CACHE_TTL_MS = 5 * 60 * 1000;
const chapterContentCache = new Map<string, { content: ChapterContent; expiresAt: number }>();

export function chapterStoragePath(bookId: string, order: number): string {
  return `chapters/${bookId}/${order}.json`;
}

export async function uploadChapterContent(
  bookId: string,
  order: number,
  content: ChapterContent,
): Promise<string> {
  const path = chapterStoragePath(bookId, order);
  const buffer = Buffer.from(JSON.stringify(content), "utf-8");
  return uploadBookFile(buffer, path, "application/json");
}

export async function downloadChapterContent(storagePath: string): Promise<ChapterContent> {
  const cached = chapterContentCache.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.content;
  }

  const buffer = await downloadBookFile(storagePath);
  const parsed = JSON.parse(buffer.toString("utf-8")) as Partial<ChapterContent>;

  const content = {
    html: parsed.html ?? "",
    text: parsed.text ?? "",
  };

  chapterContentCache.set(storagePath, {
    content,
    expiresAt: Date.now() + CHAPTER_CACHE_TTL_MS,
  });

  return content;
}
