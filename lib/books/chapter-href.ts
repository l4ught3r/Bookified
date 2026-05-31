const EPUB_HREF_PREFIX = "epub:";

export function stripEpubHref(href: string): string {
  return href.startsWith(EPUB_HREF_PREFIX) ? href.slice(EPUB_HREF_PREFIX.length) : href;
}

export function normalizeChapterHref(href: string): string {
  return stripEpubHref(href).split("#")[0] ?? "";
}
