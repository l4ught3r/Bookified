// src/lib/parsers/ParserFactory.ts
import { BaseParser } from "./BaseParser";
import { EpubParser } from "./EpubParser";
import { Fb2Parser } from "./Fb2Parser";
import { MobiParser } from "./MobiParser";
import { TxtParser } from "./TxtParser";

export type BookFormat = "epub" | "fb2" | "txt" | "pdf" | "mobi";

const FORMAT_MAP: Record<string, BookFormat> = {
  ".epub": "epub",
  ".fb2": "fb2",
  ".txt": "txt",
  ".pdf": "pdf",
  ".mobi": "mobi",
  ".prc": "mobi",
  ".azw": "mobi",
  ".azw3": "mobi",
};

const MIME_MAP: Record<string, BookFormat> = {
  "application/epub+zip": "epub",
  "application/x-fictionbook+xml": "fb2",
  "application/xml": "fb2",
  "text/plain": "txt",
  "application/pdf": "pdf",
  "application/x-mobipocket-ebook": "mobi",
  "application/octet-stream": "epub", // fallback
};

export function detectFormat(filename: string, mimeType?: string): BookFormat | null {
  // По расширению
  const ext = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  if (ext && FORMAT_MAP[ext]) return FORMAT_MAP[ext];

  // По MIME
  if (mimeType && MIME_MAP[mimeType]) return MIME_MAP[mimeType];

  return null;
}

export function createParser(format: BookFormat, buffer: Buffer, bookId: string): BaseParser {
  switch (format) {
    case "epub":
      return new EpubParser(buffer, bookId);
    case "fb2":
      return new Fb2Parser(buffer, bookId);
    case "txt":
      return new TxtParser(buffer, bookId);
    case "pdf":
      throw new Error("PDF parsing is handled separately via inspectPdf");
    case "mobi":
      return new MobiParser(buffer, bookId);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
