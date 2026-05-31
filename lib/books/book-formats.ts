import type { BookFormat } from "@/lib/parsers/ParserFactory";

export type BookFormatMeta = {
  value: BookFormat;
  label: string;
  extensions: string[];
  /** Small icon for badges (Simple Icons CDN) */
  iconUrl: string;
  accentClass: string;
};

export const BOOK_FORMATS: BookFormatMeta[] = [
  {
    value: "pdf",
    label: "PDF",
    extensions: [".pdf"],
    iconUrl: "https://cdn.simpleicons.org/adobeacrobatreader/EC1C24",
    accentClass: "bg-red-600/90",
  },
  {
    value: "epub",
    label: "EPUB",
    extensions: [".epub"],
    iconUrl: "https://cdn.simpleicons.org/readthedocs/8CA1AF",
    accentClass: "bg-emerald-600/90",
  },
  {
    value: "fb2",
    label: "FB2",
    extensions: [".fb2", ".fb2.zip"],
    iconUrl: "https://cdn.simpleicons.org/xml/FFB800",
    accentClass: "bg-amber-600/90",
  },
  {
    value: "txt",
    label: "TXT",
    extensions: [".txt"],
    iconUrl: "https://cdn.simpleicons.org/txt/64748B",
    accentClass: "bg-slate-600/90",
  },
];

export function getFormatMeta(format?: string | null): BookFormatMeta | undefined {
  return BOOK_FORMATS.find((item) => item.value === format);
}

export function detectFormatFromFilename(filename: string): BookFormat | null {
  const lower = filename.toLowerCase();
  for (const item of BOOK_FORMATS) {
    if (item.extensions.some((ext) => lower.endsWith(ext))) {
      return item.value;
    }
  }
  return null;
}

const MIME_MAP: Record<string, BookFormat> = {
  "application/epub+zip": "epub",
  "application/x-fictionbook+xml": "fb2",
  "application/xml": "fb2",
  "text/plain": "txt",
  "application/pdf": "pdf",
};

export function detectFormatFromFile(file: Pick<File, "name" | "type">): BookFormat | null {
  return detectFormatFromFilename(file.name) ?? MIME_MAP[file.type] ?? null;
}

export const MAX_BOOK_FILE_BYTES = 100 * 1024 * 1024;

export function detectUploadFormat(filename: string, mimeType?: string | null): BookFormat | null {
  return detectFormatFromFilename(filename) ?? (mimeType ? MIME_MAP[mimeType] : null) ?? null;
}

export function validateBookUploadFile(
  file: Pick<File, "name" | "type" | "size">,
): { ok: true; format: BookFormat } | { ok: false; message: string } {
  const format = detectFormatFromFile(file);
  if (!format) {
    return {
      ok: false,
      message: "Поддерживаемые форматы: PDF, EPUB, TXT, FB2",
    };
  }

  if (file.size > MAX_BOOK_FILE_BYTES) {
    return {
      ok: false,
      message: "Файл слишком большой (максимум 100 MB)",
    };
  }

  return { ok: true, format };
}

export const BOOK_FORMAT_VALUES = BOOK_FORMATS.map((item) => item.value);

export function isBookFormat(value: string): value is BookFormat {
  return BOOK_FORMAT_VALUES.includes(value as BookFormat);
}
