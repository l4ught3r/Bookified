import type { EpubTypographyDocument } from "@/lib/core/typography/types";
import { serializeTypographyDocument } from "@/lib/core/serializer/ast-serializer";
import { deleteBookFile, downloadBookFile, uploadBookFile } from "@/lib/storage/book-storage";

export async function saveTypographyDocument(
  bookId: string,
  document: EpubTypographyDocument,
): Promise<string> {
  const buffer = Buffer.from(serializeTypographyDocument(document), "utf-8");
  return uploadBookFile(buffer, `typography/${bookId}/document.json`, "application/json");
}

export async function loadTypographyDocument(
  storagePath: string,
): Promise<EpubTypographyDocument | null> {
  try {
    const buffer = await downloadBookFile(storagePath);
    return JSON.parse(buffer.toString("utf-8")) as EpubTypographyDocument;
  } catch {
    return null;
  }
}

export async function deleteTypographyDocument(storagePath: string): Promise<void> {
  try {
    await deleteBookFile(storagePath);
  } catch {
    // ignore missing files
  }
}
