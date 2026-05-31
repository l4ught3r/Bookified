export type ChapterBlockKind = "heading" | "paragraph" | "list-item" | "quote" | "pre";

export type ChapterBlock = {
  id: string;
  kind: ChapterBlockKind;
  level?: number;
  text: string;
};

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE"]);

function normalizeText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function kindFromTag(tag: string): ChapterBlockKind {
  if (tag.startsWith("H")) return "heading";
  if (tag === "LI") return "list-item";
  if (tag === "BLOCKQUOTE") return "quote";
  if (tag === "PRE") return "pre";
  return "paragraph";
}

export function htmlToChapterBlocks(html: string): ChapterBlock[] {
  if (typeof document === "undefined") return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const blocks: ChapterBlock[] = [];
  let index = 0;

  const pushElement = (element: Element) => {
    const text = normalizeText(element.textContent ?? "");
    if (!text) return;

    const tag = element.tagName;
    blocks.push({
      id: `content-${index++}`,
      kind: kindFromTag(tag),
      level: tag.startsWith("H") ? Number.parseInt(tag.slice(1), 10) : undefined,
      text,
    });
  };

  const walk = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    if (BLOCK_TAGS.has(element.tagName)) {
      pushElement(element);
      return;
    }

    element.childNodes.forEach(walk);
  };

  doc.body.childNodes.forEach(walk);

  if (blocks.length === 0) {
    const text = normalizeText(doc.body.textContent ?? "");
    if (text) {
      blocks.push({ id: "content-0", kind: "paragraph", text });
    }
  }

  return blocks;
}

export function textToChapterBlocks(text: string): ChapterBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => normalizeText(paragraph))
    .filter(Boolean)
    .map((paragraph, index) => ({
      id: `content-${index}`,
      kind: "paragraph" as const,
      text: paragraph,
    }));
}
