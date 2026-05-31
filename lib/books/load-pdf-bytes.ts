import { getOfflinePdfData, savePdfOriginalToLocalDb } from "@/lib/books/offline-book";

const PDF_FETCH_TIMEOUT_MS = 120_000;

export async function loadPdfBytesForViewer(bookId: string): Promise<Uint8Array> {
  const offline = await getOfflinePdfData(bookId);
  if (offline && offline.byteLength > 0) {
    return new Uint8Array(offline);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`/api/books/${encodeURIComponent(bookId)}/file`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 401) {
      throw new Error("Войдите в аккаунт, чтобы открыть PDF");
    }

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error || `Не удалось загрузить PDF (${res.status})`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      throw new Error("Сервер вернул ошибку вместо файла PDF");
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error("Файл PDF пустой");
    }

    await savePdfOriginalToLocalDb(bookId, buffer);

    return new Uint8Array(buffer);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Загрузка PDF заняла слишком много времени");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
