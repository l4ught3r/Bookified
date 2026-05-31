import {
  geistSans,
  ibmPlexSans,
  inter,
  nunito,
  notoSans,
  openSans,
  roboto,
  sourceSans3,
} from "@/lib/fonts/reading";
import { BOOK_ORIGINAL_FONT_ID, readingFontOptions } from "@/lib/books/reading-fonts";

const readingFontModules: Record<string, { variable: string } | undefined> = {
  geist: geistSans,
  inter,
  "open-sans": openSans,
  "source-sans-3": sourceSans3,
  roboto,
  nunito,
  "ibm-plex-sans": ibmPlexSans,
  "noto-sans": notoSans,
};

export const ALL_READING_FONT_IDS = readingFontOptions.map((font) => font.id);

export function isLazyLoadableReadingFontId(fontId: string): boolean {
  return fontId !== BOOK_ORIGINAL_FONT_ID && fontId !== "sf-pro" && Boolean(readingFontModules[fontId]);
}

export function readingFontVariableClasses(fontIds: Iterable<string>): string {
  const classes = new Set<string>([geistSans.variable]);

  for (const fontId of fontIds) {
    const mod = readingFontModules[fontId];
    if (mod?.variable) {
      classes.add(mod.variable);
    }
  }

  return [...classes].join(" ");
}
