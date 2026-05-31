import type { ReadingTypographySettings } from "@/lib/books/reading-typography";
import { BOOK_ORIGINAL_FONT_ID } from "@/lib/books/reading-fonts";
import {
  DEFAULT_READING_TYPOGRAPHY,
  matchReadingFontId,
  normalizeReadingTypography,
} from "@/lib/books/reading-typography";
import type { FontFaceDeclaration, TypographyNode } from "../typography/types";
import { pickDominantTypographyNode } from "../extractor/typography-tree";

function parsePx(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^(-?\d*\.?\d+)px$/);
  return match ? Number.parseFloat(match[1]) : undefined;
}

function parseLineHeight(value: string | undefined, fontSizePx: number): number | undefined {
  if (!value) return undefined;
  if (value.endsWith("px")) {
    const px = parsePx(value);
    return px && fontSizePx > 0 ? px / fontSizePx : undefined;
  }
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseSpacing(value: string | undefined): number | undefined {
  if (!value || value === "normal") return 0;
  const px = parsePx(value);
  if (px !== undefined) return px;
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseTextAlign(value: string | undefined): ReadingTypographySettings["textAlign"] | undefined {
  if (value === "start") return "left";
  if (value === "end") return "right";
  if (value === "left" || value === "center" || value === "right" || value === "justify") {
    return value;
  }
  return undefined;
}

export function computedNodeToReadingSettings(
  node: TypographyNode,
  fontFaces: FontFaceDeclaration[] = [],
): ReadingTypographySettings {
  const fontSizePx = parsePx(node.typography.fontSize) ?? DEFAULT_READING_TYPOGRAPHY.fontSize;
  const lineHeight =
    parseLineHeight(node.typography.lineHeight, fontSizePx) ?? DEFAULT_READING_TYPOGRAPHY.lineHeight;

  const primaryFont = node.typography.fontFamily?.split(",")[0]?.replace(/['"]/g, "").trim();
  const matchedFontId = matchReadingFontId(node.typography.fontFamily) ?? DEFAULT_READING_TYPOGRAPHY.fontId;

  const customFace = fontFaces.find(
    (face) => primaryFont && face.fontFamily.toLowerCase() === primaryFont.toLowerCase(),
  );

  return normalizeReadingTypography({
    fontId: customFace?.href ? BOOK_ORIGINAL_FONT_ID : matchedFontId,
    fontSize: fontSizePx,
    lineHeight,
    letterSpacing: parseSpacing(node.typography.letterSpacing),
    wordSpacing: parseSpacing(node.typography.wordSpacing),
    textAlign: parseTextAlign(node.typography.textAlign),
    customFontFamily: customFace?.fontFamily ?? (matchedFontId ? undefined : primaryFont),
    customFontAssetHref: customFace?.href,
  });
}

export function aggregateReadingSettingsFromChapters(
  chapterRoots: TypographyNode[],
  fontFaces: FontFaceDeclaration[] = [],
): ReadingTypographySettings {
  if (chapterRoots.length === 0) {
    return { ...DEFAULT_READING_TYPOGRAPHY };
  }

  const samples = chapterRoots.map((root) => computedNodeToReadingSettings(pickDominantTypographyNode(root), fontFaces));

  const avg = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

  const fontCounts = new Map<string, number>();
  for (const sample of samples) {
    fontCounts.set(sample.fontId, (fontCounts.get(sample.fontId) ?? 0) + 1);
  }

  const dominantFontId =
    [...fontCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEFAULT_READING_TYPOGRAPHY.fontId;

  const alignCounts = new Map<string, number>();
  for (const sample of samples) {
    alignCounts.set(sample.textAlign, (alignCounts.get(sample.textAlign) ?? 0) + 1);
  }
  const dominantAlign =
    ([...alignCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as ReadingTypographySettings["textAlign"]) ??
    DEFAULT_READING_TYPOGRAPHY.textAlign;

  const customSample = samples.find((sample) => sample.customFontFamily);

  return normalizeReadingTypography({
    fontId: customSample?.customFontAssetHref ? BOOK_ORIGINAL_FONT_ID : dominantFontId,
    fontSize: avg(samples.map((sample) => sample.fontSize)),
    lineHeight: avg(samples.map((sample) => sample.lineHeight)),
    letterSpacing: avg(samples.map((sample) => sample.letterSpacing)),
    wordSpacing: avg(samples.map((sample) => sample.wordSpacing)),
    textAlign: dominantAlign,
    customFontFamily: customSample?.customFontFamily,
    customFontAssetHref: customSample?.customFontAssetHref,
  });
}
