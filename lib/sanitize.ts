import sanitizeHtml from "sanitize-html";
import { bookAssetUrl } from "./books/asset-url";

function rewriteAssetSrc(src: string, bookId: string): string {
  if (!src || src.startsWith("http") || src.startsWith("https") || src.startsWith("data:")) {
    return src;
  }

  if (src.startsWith(`/api/books/${bookId}/assets/`)) {
    return src;
  }

  let cleanHref = src.replace(/\\/g, "/");
  if (/^[a-z]:\//i.test(cleanHref)) {
    cleanHref = cleanHref.replace(/^[a-z]:\//i, "");
  }
  cleanHref = cleanHref.replace(/^\/+/, "").replace(/^\.\.\//, "").replace(/^\.\//, "");

  return bookAssetUrl(bookId, cleanHref);
}

export function sanitizeBookHtml(html: string, bookId: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "ul",
      "ol",
      "li",
      "dl",
      "dt",
      "dd",
      "blockquote",
      "pre",
      "code",
      "em",
      "strong",
      "b",
      "i",
      "u",
      "s",
      "sub",
      "sup",
      "small",
      "a",
      "img",
      "picture",
      "source",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "caption",
      "colgroup",
      "col",
      "div",
      "span",
      "mark",
      "section",
      "article",
      "aside",
      "header",
      "footer",
      "main",
      "figure",
      "figcaption",
      "ruby",
      "rt",
      "rp",
      "svg",
      "image",
    ],
    allowedAttributes: {
      a: ["href", "title", "id", "class", "style"],
      img: ["src", "alt", "title", "width", "height", "class", "style", "id"],
      image: ["href", "xlink:href", "width", "height", "class", "style", "id"],
      source: ["src", "srcset", "type", "media"],
      svg: ["viewBox", "width", "height", "xmlns", "xmlns:xlink", "class", "style", "id"],
      td: ["colspan", "rowspan", "class", "style", "id"],
      th: ["colspan", "rowspan", "scope", "class", "style", "id"],
      col: ["span", "width"],
      mark: ["class", "style"],
      "*": ["class", "id", "style", "lang", "dir", "role", "aria-hidden", "data-empty-lines"],
    },
    allowedSchemes: ["http", "https", "mailto", "epub", "data"],
    allowedSchemesByTag: {
      img: ["http", "https", "data", ""],
      image: ["http", "https", "data", ""],
    },
    transformTags: {
      img: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = rewriteAssetSrc(attribs.src, bookId);
        }
        if (!attribs.src && attribs["data-src"]) {
          attribs.src = rewriteAssetSrc(attribs["data-src"], bookId);
        }
        return { tagName, attribs };
      },
      image: (tagName, attribs) => {
        const hrefKey = attribs["xlink:href"] ? "xlink:href" : "href";
        if (attribs[hrefKey]) {
          attribs[hrefKey] = rewriteAssetSrc(attribs[hrefKey], bookId);
        }
        return { tagName, attribs };
      },
      a: (tagName, attribs) => {
        if (attribs.href?.startsWith("epub:")) {
          attribs.href = attribs.href.slice(5);
        }
        return { tagName, attribs };
      },
    },
  });
}

export function extractPlainText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
