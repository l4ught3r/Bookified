import type { ReadingTypographySettings } from "@/lib/books/reading-typography";
import { buildFb2TypographyDocument } from "../fb2/ast-builder";
import { fb2TypographyToReadingSettings } from "../fb2/normalizer";
import { parseFb2Buffer } from "../fb2/parser";
import type { Fb2ParseResult } from "../fb2/types";
import { cloneTypographyDocument } from "../serializer/ast-serializer";
import type { EpubTypographyDocument } from "../typography/types";

export type Fb2TypographyPipelineResult = {
  parsed: Fb2ParseResult;
  document: EpubTypographyDocument;
  readingSettings: ReadingTypographySettings;
};

export async function extractFb2Typography(
  buffer: Buffer,
  bookId: string,
): Promise<Fb2TypographyPipelineResult> {
  const parsed = await parseFb2Buffer(buffer);
  const document = buildFb2TypographyDocument(parsed, bookId);
  const readingSettings = fb2TypographyToReadingSettings(document);

  return {
    parsed,
    document: cloneTypographyDocument(document),
    readingSettings,
  };
}
