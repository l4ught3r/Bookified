import {
  BOOK_ORIGINAL_FONT_ID,
  DEFAULT_READING_FONT_ID,
  readingFontOptions,
} from "./reading-fonts";

export type ReadingTextAlign = "left" | "center" | "justify" | "right";

export type ReadingTypographySettings = {
  fontId: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  paragraphSpacing: number;
  textAlign: ReadingTextAlign;
  fontWeightBold: boolean;
  customFontFamily?: string;
  customFontAssetHref?: string;
};

export const DEFAULT_READING_TYPOGRAPHY: ReadingTypographySettings = {
  fontId: DEFAULT_READING_FONT_ID,
  fontSize: 18,
  lineHeight: 1.55,
  letterSpacing: 0,
  wordSpacing: 0,
  paragraphSpacing: 1,
  textAlign: "justify",
  fontWeightBold: false,
};

export const MOBILE_DEFAULT_READING_FONT_SIZE = 14;
export const MOBILE_DEFAULT_READING_LINE_HEIGHT = 1.4;

export function getPlatformDefaultReadingTypography(
  isMobileLayout: boolean,
): ReadingTypographySettings {
  if (!isMobileLayout) {
    return { ...DEFAULT_READING_TYPOGRAPHY };
  }

  return {
    ...DEFAULT_READING_TYPOGRAPHY,
    fontSize: MOBILE_DEFAULT_READING_FONT_SIZE,
    lineHeight: MOBILE_DEFAULT_READING_LINE_HEIGHT,
  };
}

const FONT_ALIASES: Record<string, string> = {
  geist: "geist",
  inter: "inter",
  "open sans": "open-sans",
  opensans: "open-sans",
  "source sans 3": "source-sans-3",
  roboto: "roboto",
  nunito: "nunito",
  "ibm plex sans": "ibm-plex-sans",
  "noto sans": "noto-sans",
  "sf pro text": "sf-pro",
  "sf pro": "sf-pro",
  "-apple-system": "sf-pro",
  arial: "inter",
  helvetica: "inter",
  "helvetica neue": "inter",
  "sans-serif": "inter",
};

const VALID_FONT_IDS = new Set([
  BOOK_ORIGINAL_FONT_ID,
  ...readingFontOptions.map((font) => font.id),
]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveFontId(input: Partial<ReadingTypographySettings>): string {
  if (input.fontId && VALID_FONT_IDS.has(input.fontId)) {
    return input.fontId;
  }

  if (input.customFontAssetHref || input.customFontFamily) {
    return BOOK_ORIGINAL_FONT_ID;
  }

  return DEFAULT_READING_FONT_ID;
}

export function normalizeReadingTypography(
  input: Partial<ReadingTypographySettings> | null | undefined,
): ReadingTypographySettings {
  if (!input) {
    return { ...DEFAULT_READING_TYPOGRAPHY };
  }

  const fontId = resolveFontId(input);

  const textAlign =
    input.textAlign === "left" ||
    input.textAlign === "center" ||
    input.textAlign === "right" ||
    input.textAlign === "justify"
      ? input.textAlign
      : DEFAULT_READING_TYPOGRAPHY.textAlign;

  return {
    fontId,
    fontSize: clamp(input.fontSize ?? DEFAULT_READING_TYPOGRAPHY.fontSize, 12, 28),
    lineHeight: clamp(input.lineHeight ?? DEFAULT_READING_TYPOGRAPHY.lineHeight, 1.2, 3),
    letterSpacing: clamp(input.letterSpacing ?? DEFAULT_READING_TYPOGRAPHY.letterSpacing, -2, 2),
    wordSpacing: clamp(input.wordSpacing ?? DEFAULT_READING_TYPOGRAPHY.wordSpacing, -10, 20),
    paragraphSpacing: clamp(
      input.paragraphSpacing ?? DEFAULT_READING_TYPOGRAPHY.paragraphSpacing,
      0.25,
      2.5,
    ),
    textAlign,
    fontWeightBold: input.fontWeightBold === true,
    customFontFamily: input.customFontFamily?.trim() || undefined,
    customFontAssetHref: input.customFontAssetHref?.trim() || undefined,
  };
}

export function matchReadingFontId(fontFamily: string | undefined): string | null {
  if (!fontFamily) return null;

  const normalized = fontFamily.toLowerCase().replace(/["']/g, "").replace(/\s+/g, " ").trim();

  const candidates = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (VALID_FONT_IDS.has(candidate)) {
      return candidate;
    }

    const alias = FONT_ALIASES[candidate];
    if (alias && VALID_FONT_IDS.has(alias)) {
      return alias;
    }

    for (const [key, mappedFontId] of Object.entries(FONT_ALIASES)) {
      if (candidate.includes(key) || key.includes(candidate)) {
        return mappedFontId;
      }
    }

    for (const font of readingFontOptions) {
      if (
        candidate.includes(font.name.toLowerCase()) ||
        font.name.toLowerCase().includes(candidate)
      ) {
        return font.id;
      }
    }
  }

  return null;
}

export function resolveReadingFontFamily(
  typography: ReadingTypographySettings,
  getFontFamilyById: (id: string) => string,
): string {
  if (isBookOriginalFont(typography) && typography.customFontFamily) {
    return `"${typography.customFontFamily.replace(/"/g, "")}", ${getFontFamilyById(DEFAULT_READING_FONT_ID)}`;
  }

  if (isBookOriginalFont(typography)) {
    return "inherit";
  }

  return getFontFamilyById(typography.fontId);
}

export function isBookOriginalFont(typography: Pick<ReadingTypographySettings, "fontId">): boolean {
  return typography.fontId === BOOK_ORIGINAL_FONT_ID;
}

export function getDefaultBookFontId(
  bookDefaults: Pick<ReadingTypographySettings, "customFontAssetHref" | "customFontFamily" | "fontId">,
): string {
  if (bookDefaults.customFontAssetHref || bookDefaults.customFontFamily) {
    return BOOK_ORIGINAL_FONT_ID;
  }

  return resolveFontId(bookDefaults);
}
