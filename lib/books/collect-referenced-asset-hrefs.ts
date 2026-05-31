import type { ReadingTypographySettings } from "@/lib/books/reading-typography";
import type { ParsedChapter } from "@/lib/parsers/BaseParser";

export function collectReferencedAssetHrefs(
  chapters: ParsedChapter[],
  bookId: string,
  typography?: ReadingTypographySettings,
): Set<string> {
  const hrefs = new Set<string>();
  const marker = `/api/books/${bookId}/assets/by-href/`;

  for (const chapter of chapters) {
    let searchFrom = 0;

    while (searchFrom < chapter.html.length) {
      const start = chapter.html.indexOf(marker, searchFrom);
      if (start === -1) break;

      const encodedPath = chapter.html.slice(start + marker.length).split(/["')\s>]/)[0] ?? "";
      if (encodedPath) {
        hrefs.add(decodeURIComponent(encodedPath));
      }

      searchFrom = start + marker.length;
    }
  }

  if (typography?.customFontAssetHref) {
    hrefs.add(typography.customFontAssetHref);
  }

  return hrefs;
}
