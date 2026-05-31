import type { ReadingTypographySettings } from "@/lib/books/reading-typography";
import { normalizeReadingTypography } from "@/lib/books/reading-typography";
import { aggregateReadingSettingsFromChapters } from "../normalizer/to-reading-settings";
import type { EpubTypographyDocument } from "../typography/types";

export const FB2_DEFAULT_READING_TYPOGRAPHY: ReadingTypographySettings = normalizeReadingTypography({
  fontId: "geist",
  fontSize: 18,
  lineHeight: 1.6,
  letterSpacing: 0,
  wordSpacing: 0,
  paragraphSpacing: 1.25,
  textAlign: "justify",
});

export function fb2TypographyToReadingSettings(
  document: EpubTypographyDocument,
): ReadingTypographySettings {
  if (document.chapters.length === 0) {
    return { ...FB2_DEFAULT_READING_TYPOGRAPHY };
  }

  const derived = aggregateReadingSettingsFromChapters(
    document.chapters.map((chapter) => chapter.root),
    document.fontFaces,
  );

  return normalizeReadingTypography({
    ...FB2_DEFAULT_READING_TYPOGRAPHY,
    ...derived,
  });
}
