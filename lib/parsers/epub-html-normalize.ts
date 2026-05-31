import * as cheerio from "cheerio";
import type { Element } from "domhandler";

const COVER_HINT_PATTERN =
  /cover|titlepage|title-page|front-cover|book-cover|обложк|titul/i;

const COVER_FIX_STYLE = `<style data-bookified-cover-fix>
.book-chapter-content img.book-cover-image,
.book-chapter-content svg.book-cover-image,
.book-chapter-content picture.book-cover-image img {
  width: min(100%, 420px) !important;
  max-width: 100% !important;
  height: auto !important;
  max-height: min(80vh, 640px) !important;
  object-fit: contain !important;
  margin-inline: auto !important;
  display: block !important;
}

.book-chapter-content svg.book-cover-image {
  width: min(100%, 420px) !important;
  height: auto !important;
}

.book-chapter-content .book-cover-image svg,
.book-chapter-content .book-cover-image image {
  width: 100% !important;
  height: auto !important;
}

.book-chapter-content .book-cover-page,
.book-chapter-content .book-cover-page * {
  height: auto !important;
  max-height: none !important;
  min-height: 0 !important;
  overflow: visible !important;
}

.book-chapter-content .book-cover-page img,
.book-chapter-content .book-cover-page svg {
  width: min(100%, 420px) !important;
  height: auto !important;
  max-height: min(80vh, 640px) !important;
  object-fit: contain !important;
}
</style>`;

function stripSizingFromStyle(style: string): string {
  return style
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .filter((rule) => {
      const prop = rule.split(":")[0]?.trim().toLowerCase();
      return (
        prop !== "width" &&
        prop !== "height" &&
        prop !== "max-width" &&
        prop !== "max-height" &&
        prop !== "min-width" &&
        prop !== "min-height" &&
        prop !== "object-fit" &&
        prop !== "object-position"
      );
    })
    .join("; ");
}

function normalizeImageElement($: cheerio.CheerioAPI, element: Element) {
  const $el = $(element);
  $el.removeAttr("width").removeAttr("height");

  const style = $el.attr("style");
  if (style) {
    const cleaned = stripSizingFromStyle(style);
    if (cleaned) {
      $el.attr("style", cleaned);
    } else {
      $el.removeAttr("style");
    }
  }

  $el.addClass("book-cover-image");
}

export function isCoverLikeChapter(html: string, order: number): boolean {
  if (order !== 1) {
    return false;
  }

  const $ = cheerio.load(`<div id="__root__">${html}</div>`, { xmlMode: false });
  const markup = $.html() ?? "";

  if (COVER_HINT_PATTERN.test(markup)) {
    return true;
  }

  const textLength = $.text().replace(/\s+/g, " ").trim().length;
  const imageCount = $("img").length + $("svg").length + $("picture").length;

  if (imageCount === 0) {
    return false;
  }

  return textLength < 240;
}

export function normalizeCoverChapterHtml(html: string, order: number): string {
  if (!isCoverLikeChapter(html, order)) {
    return html;
  }

  const $ = cheerio.load(`<div id="__root__">${html}</div>`, { xmlMode: false });

  $("img").each((_, element) => normalizeImageElement($, element));

  $("picture").each((_, element) => {
    $(element).addClass("book-cover-image");
    $(element)
      .find("img")
      .each((__, img) => normalizeImageElement($, img));
  });

  $("svg").each((_, element) => {
    const $svg = $(element);
    $svg.removeAttr("width").removeAttr("height");

    const style = $svg.attr("style");
    if (style) {
      const cleaned = stripSizingFromStyle(style);
      if (cleaned) $svg.attr("style", cleaned);
      else $svg.removeAttr("style");
    }

    $svg.addClass("book-cover-image");
    $svg.find("image").each((__, imageEl) => normalizeImageElement($, imageEl));
  });

  $("[style]").each((_, element) => {
    const $el = $(element);
    const style = $el.attr("style") ?? "";
    if (/background(-image)?\s*:/i.test(style)) {
      $el.addClass("book-cover-page");
      const cleaned = stripSizingFromStyle(style);
      if (cleaned) $el.attr("style", cleaned);
      else $el.removeAttr("style");
    }
  });

  $("[class], [id]").each((_, element) => {
    const $el = $(element);
    const className = $el.attr("class") ?? "";
    const id = $el.attr("id") ?? "";
    if (COVER_HINT_PATTERN.test(`${className} ${id}`)) {
      $el.addClass("book-cover-page");
      const style = $el.attr("style");
      if (style) {
        const cleaned = stripSizingFromStyle(style);
        if (cleaned) $el.attr("style", cleaned);
        else $el.removeAttr("style");
      }
    }
  });

  const root = $("#__root__");
  if (root.children("img, svg, picture").length > 0) {
    root.addClass("book-cover-page");
  }

  return `${root.html() ?? ""}${COVER_FIX_STYLE}`;
}
