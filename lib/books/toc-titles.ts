import {
  normalizeChapterHref,
  normalizeTocHrefKey,
  stripEpubHref,
} from "@/lib/books/chapter-href";
import { isGenericNavigationTitle, isMeaningfulChapterTitle } from "@/lib/books/navigation-labels";

export function buildTocHrefTitleMap(
  toc: Array<{ title: string; href: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  const fileFirstTitle = new Set<string>();

  for (const item of toc) {
    const title = item.title.trim();
    if (!title || isGenericNavigationTitle(title)) continue;

    const stripped = stripEpubHref(item.href);
    const fileKey = normalizeChapterHref(stripped);
    const fullKey = normalizeTocHrefKey(stripped);

    if (fullKey.includes("#") && !map.has(fullKey)) {
      map.set(fullKey, title);
    }

    if (fileKey && !fileFirstTitle.has(fileKey)) {
      fileFirstTitle.add(fileKey);
      map.set(fileKey, title);
    }
  }

  return map;
}

export function lookupTocTitle(href: string, tocByHref: Map<string, string>): string | undefined {
  const stripped = stripEpubHref(href);
  const fullKey = normalizeTocHrefKey(stripped);
  const fileKey = normalizeChapterHref(stripped);

  return tocByHref.get(fullKey) ?? (fullKey !== fileKey ? tocByHref.get(fileKey) : undefined);
}

export function resolveChapterTitleFromToc(
  href: string,
  tocByHref: Map<string, string>,
  fallbackTitle: string,
): string {
  const tocTitle = lookupTocTitle(href, tocByHref);
  if (tocTitle && isMeaningfulChapterTitle(tocTitle)) {
    return tocTitle;
  }
  return fallbackTitle;
}
