/** Book asset API routes require the user's session; Next/Image optimizer cannot send cookies. */
export function isAuthenticatedBookAssetUrl(src: string): boolean {
  return /^\/api\/books\/[^/]+\/assets(?:\/|$)/.test(src);
}

export function bookAssetUrl(bookId: string, epubHref: string): string {
  const normalized = epubHref.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean).map(encodeURIComponent);
  return `/api/books/${bookId}/assets/by-href/${segments.join("/")}`;
}
