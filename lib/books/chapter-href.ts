const EPUB_HREF_PREFIX = "epub:";

export function stripEpubHref(href: string): string {
  return href.startsWith(EPUB_HREF_PREFIX) ? href.slice(EPUB_HREF_PREFIX.length) : href;
}

export function normalizeChapterHref(href: string): string {
  return stripEpubHref(href).split("#")[0] ?? "";
}

/** Normalized TOC lookup key: file path plus optional #fragment. */
export function normalizeTocHrefKey(href: string): string {
  const stripped = stripEpubHref(href);
  const hashIndex = stripped.indexOf("#");
  if (hashIndex === -1) {
    return stripped;
  }

  const path = stripped.slice(0, hashIndex);
  const fragment = stripped.slice(hashIndex + 1);
  return fragment ? `${path}#${fragment}` : path;
}
