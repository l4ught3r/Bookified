"use client";

export type UploadBookApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  details?: string;
  book?: {
    _id?: string;
    title?: string;
    authors?: string[];
    format?: string;
  };
};

export type UploadProgressPhase = "uploading" | "processing";

export type UploadProgressUpdate = {
  progress: number;
  phase: UploadProgressPhase;
};

const UPLOAD_PROGRESS_MAX = 90;
const PROCESSING_PROGRESS = 92;

export function uploadBookWithProgress(
  formData: FormData,
  onProgress: (update: UploadProgressUpdate) => void,
): Promise<{ status: number; json: UploadBookApiResponse }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/books/upload");
    xhr.withCredentials = true;
    xhr.responseType = "text";
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const ratio = event.loaded / event.total;
      onProgress({
        phase: "uploading",
        progress: Math.max(1, Math.min(UPLOAD_PROGRESS_MAX, Math.round(ratio * UPLOAD_PROGRESS_MAX))),
      });
    });

    xhr.upload.addEventListener("loadend", () => {
      onProgress({ phase: "processing", progress: PROCESSING_PROGRESS });
    });

    xhr.addEventListener("load", () => {
      let json: UploadBookApiResponse;

      try {
        json = xhr.responseText
          ? (JSON.parse(xhr.responseText) as UploadBookApiResponse)
          : {};
      } catch {
        const fallbackMessage =
          xhr.status >= 500
            ? "Ошибка сервера при загрузке. Обновите страницу и попробуйте снова."
            : "Некорректный ответ сервера";
        reject(new Error(fallbackMessage));
        return;
      }

      resolve({ status: xhr.status, json });
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Ошибка сети при загрузке файла"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Загрузка отменена"));
    });

    onProgress({ phase: "uploading", progress: 1 });
    xhr.send(formData);
  });
}
