export type ReadingFontOption = {
  id: string;
  name: string;
  family: string;
};

export const BOOK_ORIGINAL_FONT_ID = "book-original";
export const DEFAULT_READING_FONT_ID = "geist";

export const bookOriginalFontOption: ReadingFontOption = {
  id: BOOK_ORIGINAL_FONT_ID,
  name: "Original typeface",
  family: "inherit",
};

export const readingFontOptions: ReadingFontOption[] = [
  { id: "geist", name: "Geist", family: "var(--font-geist-sans), sans-serif" },
  { id: "inter", name: "Inter", family: "var(--font-inter), sans-serif" },
  { id: "open-sans", name: "Open Sans", family: "var(--font-open-sans), sans-serif" },
  {
    id: "source-sans-3",
    name: "Source Sans 3",
    family: "var(--font-source-sans-3), sans-serif",
  },
  { id: "roboto", name: "Roboto", family: "var(--font-roboto), sans-serif" },
  { id: "nunito", name: "Nunito", family: "var(--font-nunito), sans-serif" },
  {
    id: "ibm-plex-sans",
    name: "IBM Plex Sans",
    family: "var(--font-ibm-plex-sans), sans-serif",
  },
  { id: "noto-sans", name: "Noto Sans", family: "var(--font-noto-sans), sans-serif" },
  {
    id: "sf-pro",
    name: "SF Pro Text",
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
  },
];

export function isBookOriginalFontId(id: string): boolean {
  return id === BOOK_ORIGINAL_FONT_ID;
}

export function getReadingFontPickerOptions(): ReadingFontOption[] {
  return [bookOriginalFontOption, ...readingFontOptions];
}

export function getReadingFontById(id: string): ReadingFontOption {
  if (isBookOriginalFontId(id)) {
    return bookOriginalFontOption;
  }

  return readingFontOptions.find((font) => font.id === id) ?? readingFontOptions[0];
}
