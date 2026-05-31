import type { EpubTypographyDocument } from "../typography/types";

export function serializeTypographyDocument(document: EpubTypographyDocument): string {
  return JSON.stringify(document);
}

export function cloneTypographyDocument(document: EpubTypographyDocument): EpubTypographyDocument {
  return structuredClone(document);
}
