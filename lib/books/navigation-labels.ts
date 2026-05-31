import { normalizeChapterHref } from "@/lib/books/chapter-href";

export type NavigationItemKind =
  | "cover"
  | "title-page"
  | "front-matter"
  | "appendix"
  | "chapter"
  | "section";

export type NavigationItemInput = {
  order: number;
  title: string;
  href: string;
  wordCount: number;
  contentHtml?: string;
};

export type NavigationKindLabels = {
  cover: string;
  titlePage: string;
  frontMatter: string;
  appendix: string;
  section: string;
  chapterNumber: (index: number) => string;
};

const HREF_KIND_RULES: Array<{ kind: NavigationItemKind; pattern: RegExp }> = [
  { kind: "cover", pattern: /cover|oblozh|front-cover|book-cover|jacket/i },
  { kind: "title-page", pattern: /title-?page|titlepage|titul|half-title/i },
  {
    kind: "front-matter",
    pattern:
      /copyright|dedication|epigraph|imprint|foreword|preface|prefatory|prologue|intro|acknowledg|colophon|license|rights|about-the-author|застав|предислов|эпиграф|от автора|выходн|посвящ/i,
  },
  {
    kind: "appendix",
    pattern:
      /appendix|epilogue|afterword|glossary|bibliograph|(?:^|[/])footnotes?(?:[./]|$)|(?:^|[/])index\.(?:html|xhtml|htm)(?:\?|#|$)|(?:^|[/])index(?:\/|$)|приложен|эпилог|послеслов|глоссарий|указатель/i,
  },
];

const TITLE_KIND_RULES: Array<{ kind: NavigationItemKind; pattern: RegExp }> = [
  { kind: "cover", pattern: /^(обложка|cover|front cover|book cover)$/i },
  { kind: "title-page", pattern: /^(титул|title\s*page|half\s*title)$/i },
  {
    kind: "front-matter",
    pattern:
      /^(предисловие|посвящение|эпиграф|введение|foreword|preface|dedication|epigraph|copyright|imprint)$/i,
  },
  {
    kind: "appendix",
    pattern: /^(приложение|эпилог|послесловие|глоссарий|appendix|epilogue|afterword|glossary)$/i,
  },
];

const GENERIC_TITLE_PATTERN =
  /^(?:section|chapter|part|раздел|секция|глава|том|book)\s*[\d.:№#\-–—]*\s*$/i;

const FILE_NAME_TITLE_PATTERN = /^[a-z0-9_.-]+\.(?:xhtml|html|htm|xml)$/i;

const ROMAN_NUMERAL_PATTERN = /^[IVXLCDM]+$/i;

const NUMBERED_CHAPTER_HEADING_PATTERN =
  /^(?:chapter|part|section|book|глава|часть|раздел|том)\s+\d+$/i;

/** Only parse the start of chapter HTML — headings live at the top. */
const HTML_NAV_SAMPLE_SIZE = 4096;

function normalizeHref(href: string): string {
  return normalizeChapterHref(href).toLowerCase();
}

function sampleChapterHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;

  const withoutStyles = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  if (withoutStyles.length <= HTML_NAV_SAMPLE_SIZE) {
    return withoutStyles;
  }

  const contentStart = withoutStyles.search(/<(?:h[1-6]|p|div|section|article|body)\b/i);
  const start = contentStart >= 0 ? contentStart : 0;
  return withoutStyles.slice(start, start + HTML_NAV_SAMPLE_SIZE);
}

export function chapterNeedsHtmlSample(order: number, title: string): boolean {
  return order === 1 || isGenericNavigationTitle(title);
}

export function toNavigationItemInput(chapter: {
  order: number;
  title: string;
  href: string;
  wordCount: number;
  content?: string;
}): NavigationItemInput {
  const needsSample = chapterNeedsHtmlSample(chapter.order, chapter.title);
  return {
    order: chapter.order,
    title: chapter.title,
    href: chapter.href,
    wordCount: chapter.wordCount,
    contentHtml: needsSample ? chapter.content : undefined,
  };
}

function stripHtmlText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractHeadingFromDom(html: string): string {
  if (typeof document === "undefined") return "";

  const container = document.createElement("div");
  container.innerHTML = html;

  for (const selector of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
    const text = container.querySelector(selector)?.textContent?.trim();
    if (text) return text;
  }

  for (const selector of [".title", ".chapter", ".heading", ".head"]) {
    const text = container.querySelector(selector)?.textContent?.trim();
    if (text && text.length <= 80) return text;
  }

  for (const el of container.querySelectorAll("p, div, span")) {
    const text = el.textContent?.trim() ?? "";
    if (!text || text.length > 12) continue;
    if (ROMAN_NUMERAL_PATTERN.test(text)) return text;
    if (NUMBERED_CHAPTER_HEADING_PATTERN.test(text)) return text;
  }

  return "";
}

export function extractHeadingFromHtml(html: string): string {
  const sample = sampleChapterHtml(html) ?? html;

  const hMatch = sample.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (hMatch?.[1]) {
    const text = stripHtmlText(hMatch[1]);
    if (text) return text;
  }

  const classMatch = sample.match(
    /<(?:p|div|span)[^>]*class="[^"]*(?:title|chapter|heading|head)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div|span)>/i,
  );
  if (classMatch?.[1]) {
    const text = stripHtmlText(classMatch[1]);
    if (text) return text;
  }

  const romanMatch = sample.match(
    /<(?:p|div|span|h[4-6])(?:\s[^>]*)?>(?:\s|<[^>]+>)*([IVXLCDM]{1,8})(?:\s|<[^>]+>)*<\/(?:p|div|span|h[4-6])>/i,
  );
  if (romanMatch?.[1]) {
    return romanMatch[1].trim();
  }

  return extractHeadingFromDom(sample);
}

function isCoverLikeContent(html: string, order: number): boolean {
  if (order !== 1) return false;

  const sample = sampleChapterHtml(html) ?? html;

  if (/cover|titlepage|title-page|front-cover|book-cover|обложк|titul/i.test(sample)) {
    return true;
  }

  const text = sample.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const imageCount = (sample.match(/<(?:img|svg|picture)\b/gi) ?? []).length;
  return imageCount > 0 && text.length < 240;
}

export function isGenericNavigationTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return true;
  if (GENERIC_TITLE_PATTERN.test(trimmed)) return true;
  if (FILE_NAME_TITLE_PATTERN.test(trimmed)) return true;
  if (/^(?:section|chapter|part|раздел|секция)\s+\d+$/i.test(trimmed)) return true;
  return false;
}

export function isMeaningfulChapterTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (ROMAN_NUMERAL_PATTERN.test(trimmed)) return true;
  if (trimmed.length < 2) return false;
  return !isGenericNavigationTitle(trimmed);
}

function matchHrefKind(href: string): NavigationItemKind | null {
  const normalized = normalizeHref(href);
  for (const rule of HREF_KIND_RULES) {
    if (rule.pattern.test(normalized)) return rule.kind;
  }
  return null;
}

function matchTitleKind(title: string): NavigationItemKind | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  for (const rule of TITLE_KIND_RULES) {
    if (rule.pattern.test(trimmed)) return rule.kind;
  }
  return null;
}

export function classifyNavigationItem(input: NavigationItemInput): NavigationItemKind {
  const hrefKind = matchHrefKind(input.href);
  if (hrefKind) return hrefKind;

  const titleKind = matchTitleKind(input.title);
  if (titleKind) return titleKind;

  if (input.contentHtml && isCoverLikeContent(input.contentHtml, input.order)) {
    return "cover";
  }

  if (input.order === 1 && input.wordCount < 80 && isGenericNavigationTitle(input.title)) {
    return "cover";
  }

  if (isMeaningfulChapterTitle(input.title) && input.wordCount >= 120) {
    return "chapter";
  }

  if (input.wordCount < 60 && !isMeaningfulChapterTitle(input.title)) {
    return "front-matter";
  }

  if (input.wordCount >= 200 || isMeaningfulChapterTitle(input.title)) {
    return "chapter";
  }

  return "section";
}

function pickChapterNameTitle(input: NavigationItemInput, tocByHref?: Map<string, string>): string {
  if (isMeaningfulChapterTitle(input.title)) {
    return input.title.trim();
  }

  const tocTitle = tocByHref?.get(normalizeChapterHref(input.href));
  if (tocTitle && isMeaningfulChapterTitle(tocTitle)) {
    return tocTitle.trim();
  }

  if (input.contentHtml) {
    const heading = extractHeadingFromHtml(input.contentHtml);
    if (!heading) return "";

    if (isMeaningfulChapterTitle(heading)) {
      return heading;
    }

    if (isGenericNavigationTitle(input.title) && NUMBERED_CHAPTER_HEADING_PATTERN.test(heading)) {
      return heading;
    }
  }

  return "";
}

function resolveChapterTitle(
  input: NavigationItemInput,
  chapterIndex: number,
  labels: NavigationKindLabels,
  tocByHref?: Map<string, string>,
): string {
  const nameTitle = pickChapterNameTitle(input, tocByHref);
  if (nameTitle) {
    return nameTitle;
  }
  return labels.chapterNumber(chapterIndex);
}

function resolveNonChapterTitle(
  kind: NavigationItemKind,
  input: NavigationItemInput,
  labels: NavigationKindLabels,
): string {
  if (kind === "front-matter" || kind === "appendix") {
    if (isMeaningfulChapterTitle(input.title) && input.title.trim().length <= 48) {
      return input.title.trim();
    }
  }

  switch (kind) {
    case "cover":
      return labels.cover;
    case "title-page":
      return labels.titlePage;
    case "front-matter":
      return labels.frontMatter;
    case "appendix":
      return labels.appendix;
    case "section":
      return labels.section;
    default:
      return labels.section;
  }
}

export function getNavigationDisplayTitle(
  input: NavigationItemInput,
  labels: NavigationKindLabels,
  options?: { chapterIndex?: number; tocByHref?: Map<string, string> },
): string {
  const kind = classifyNavigationItem(input);

  if (kind === "chapter") {
    const chapterIndex = options?.chapterIndex ?? input.order;
    return resolveChapterTitle(input, chapterIndex, labels, options?.tocByHref);
  }

  return resolveNonChapterTitle(kind, input, labels);
}

export function buildNavigationDisplayItems(
  items: NavigationItemInput[],
  labels: NavigationKindLabels,
  options?: { tocByHref?: Map<string, string> },
): Array<{ order: number; title: string; kind: NavigationItemKind }> {
  let chapterIndex = 0;

  return items.map((item) => {
    const kind = classifyNavigationItem(item);
    if (kind === "chapter") {
      chapterIndex += 1;
    }

    const title = getNavigationDisplayTitle(item, labels, {
      chapterIndex: kind === "chapter" ? chapterIndex : undefined,
      tocByHref: options?.tocByHref,
    });

    return { order: item.order, title, kind };
  });
}
