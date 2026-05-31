import { normalizeChapterHref } from "@/lib/books/chapter-href";
import { isGenericNavigationTitle, isMeaningfulChapterTitle } from "@/lib/books/navigation-labels";

export function buildTocHrefTitleMap(
  toc: Array<{ title: string; href: string }>,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const item of toc) {
    const key = normalizeChapterHref(item.href);
    const title = item.title.trim();
    if (!key || !title || isGenericNavigationTitle(title)) continue;

    const existing = map.get(key);
    if (!existing || title.length > existing.length) {
      map.set(key, title);
    }
  }

  return map;
}

export function resolveChapterTitleFromToc(
  href: string,
  tocByHref: Map<string, string>,
  fallbackTitle: string,
): string {
  const tocTitle = tocByHref.get(normalizeChapterHref(href));
  if (tocTitle && isMeaningfulChapterTitle(tocTitle)) {
    return tocTitle;
  }
  return fallbackTitle;
}
