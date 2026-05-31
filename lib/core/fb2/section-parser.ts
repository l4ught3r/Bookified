import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { Fb2Block, Fb2InlineNode, Fb2Poem, Fb2Section } from "./types";

const INLINE_CONTAINER_TAGS = new Set([
  "p",
  "emphasis",
  "strong",
  "strikethrough",
  "sub",
  "sup",
  "code",
  "a",
  "style",
  "text-author",
]);

export function normalizeBinaryId(raw: string): string {
  return raw.trim().replace(/^#+/, "");
}

export function getImageBinaryId(element: Element): string {
  const attribs = element.attribs ?? {};
  const directKeys = ["href", "l:href", "xlink:href", "xlink-href"];
  for (const key of directKeys) {
    const value = attribs[key];
    if (value) return normalizeBinaryId(value);
  }

  for (const [key, value] of Object.entries(attribs)) {
    if (!value) continue;
    if (key === "href" || key.endsWith(":href") || key.endsWith("href")) {
      return normalizeBinaryId(value);
    }
  }
  return "";
}

function isElement(node: AnyNode): node is Element {
  return node.type === "tag";
}

export function parseInlineNodes(
  $: cheerio.CheerioAPI,
  element: Element | cheerio.Cheerio<Element>,
): Fb2InlineNode[] {
  const nodes: Fb2InlineNode[] = [];
  const root = "tagName" in element ? element : element.get(0);
  if (!root) return nodes;

  const walk = (node: AnyNode) => {
    if (node.type === "text") {
      const value = node.data ?? "";
      if (value) nodes.push({ kind: "text", value });
      return;
    }

    if (!isElement(node)) return;

    const tag = node.tagName.toLowerCase();

    switch (tag) {
      case "emphasis":
        nodes.push({ kind: "emphasis", children: parseInlineNodes($, node) });
        return;
      case "strong":
        nodes.push({ kind: "strong", children: parseInlineNodes($, node) });
        return;
      case "strikethrough":
        nodes.push({ kind: "strikethrough", children: parseInlineNodes($, node) });
        return;
      case "sub":
        nodes.push({ kind: "sub", children: parseInlineNodes($, node) });
        return;
      case "sup":
        nodes.push({ kind: "sup", children: parseInlineNodes($, node) });
        return;
      case "code":
        nodes.push({ kind: "code", children: parseInlineNodes($, node) });
        return;
      case "a": {
        const href = node.attribs?.href ?? node.attribs?.["l:href"] ?? "#";
        nodes.push({ kind: "link", href, children: parseInlineNodes($, node) });
        return;
      }
      case "image": {
        const binaryId = getImageBinaryId(node);
        if (binaryId) nodes.push({ kind: "image", binaryId });
        return;
      }
      case "p":
      case "style":
      case "text-author":
        nodes.push(...parseInlineNodes($, node));
        return;
      default:
        $(node)
          .contents()
          .each((_, child) => walk(child));
    }
  };

  $(root).contents().each((_, child) => walk(child));
  return nodes;
}

export function inlineNodesToPlainText(nodes: Fb2InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return node.value;
        case "image":
          return "";
        default:
          return inlineNodesToPlainText(node.children);
      }
    })
    .join("");
}

function parsePoem($: cheerio.CheerioAPI, element: Element): Fb2Poem {
  const $poem = $(element);
  const titleNode = $poem.children("title").first().get(0);
  const stanzas: Fb2InlineNode[][][] = [];

  $poem.children("stanza").each((_, stanza) => {
    const verses: Fb2InlineNode[][] = [];
    $(stanza)
      .children("v")
      .each((__, verse) => {
        verses.push(parseInlineNodes($, verse));
      });
    stanzas.push(verses);
  });

  return {
    title: titleNode ? parseInlineNodes($, titleNode) : undefined,
    stanzas,
  };
}

function parseContentBlocks($: cheerio.CheerioAPI, element: Element): Fb2Block[] {
  const blocks: Fb2Block[] = [];

  $(element)
    .contents()
    .each((_, node) => {
      if (node.type === "text") {
        const text = (node.data ?? "").trim();
        if (text) {
          blocks.push({ kind: "paragraph", nodes: [{ kind: "text", value: text }] });
        }
        return;
      }

      if (!isElement(node)) return;

      const tag = node.tagName.toLowerCase();
      switch (tag) {
        case "p":
          blocks.push({ kind: "paragraph", nodes: parseInlineNodes($, node) });
          break;
        case "empty-line":
          blocks.push({ kind: "empty-line", count: 1 });
          break;
        case "image": {
          const binaryId = getImageBinaryId(node);
          if (binaryId) blocks.push({ kind: "image", binaryId });
          break;
        }
        case "text-author":
          blocks.push({ kind: "text-author", nodes: parseInlineNodes($, node) });
          break;
        case "emphasis":
        case "strong":
          blocks.push({ kind: "paragraph", nodes: parseInlineNodes($, node) });
          break;
        default:
          if (INLINE_CONTAINER_TAGS.has(tag)) {
            blocks.push({ kind: "paragraph", nodes: parseInlineNodes($, node) });
          }
          break;
      }
    });

  return blocks;
}

function mergeEmptyLines(blocks: Fb2Block[]): Fb2Block[] {
  const merged: Fb2Block[] = [];

  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (block.kind === "empty-line" && previous?.kind === "empty-line") {
      previous.count += block.count;
      continue;
    }
    merged.push(block);
  }

  return merged;
}

function parseSection($: cheerio.CheerioAPI, element: Element, id: string, depth: number): Fb2Section {
  const blocks: Fb2Block[] = [];
  const $section = $(element);

  $section.contents().each((_, node) => {
    if (node.type === "text") {
      const text = (node.data ?? "").trim();
      if (text) {
        blocks.push({ kind: "paragraph", nodes: [{ kind: "text", value: text }] });
      }
      return;
    }

    if (!isElement(node)) return;

    const tag = node.tagName.toLowerCase();

    switch (tag) {
      case "p":
        blocks.push({ kind: "paragraph", nodes: parseInlineNodes($, node) });
        break;
      case "empty-line":
        blocks.push({ kind: "empty-line", count: 1 });
        break;
      case "image": {
        const binaryId = getImageBinaryId(node);
        if (binaryId) blocks.push({ kind: "image", binaryId });
        break;
      }
      case "title":
        blocks.push({
          kind: "title",
          nodes: parseInlineNodes($, node),
          level: Math.min(depth + 1, 6),
        });
        break;
      case "subtitle":
        blocks.push({ kind: "subtitle", nodes: parseInlineNodes($, node) });
        break;
      case "epigraph":
        blocks.push({ kind: "epigraph", blocks: parseContentBlocks($, node) });
        break;
      case "cite":
        blocks.push({ kind: "cite", blocks: parseContentBlocks($, node) });
        break;
      case "text-author":
        blocks.push({ kind: "text-author", nodes: parseInlineNodes($, node) });
        break;
      case "poem":
        blocks.push({ kind: "poem", poem: parsePoem($, node) });
        break;
      case "section":
        blocks.push({
          kind: "section",
          section: parseSection($, node, node.attribs?.id || `${id}.${blocks.length + 1}`, depth + 1),
        });
        break;
      default:
        if (INLINE_CONTAINER_TAGS.has(tag)) {
          blocks.push({ kind: "paragraph", nodes: parseInlineNodes($, node) });
        }
        break;
    }
  });

  return { id, blocks: mergeEmptyLines(blocks) };
}

export function sectionTitle(section: Fb2Section, fallback: string): string {
  const titleBlock = section.blocks.find((block) => block.kind === "title");
  if (!titleBlock || titleBlock.kind !== "title") return fallback;
  const title = inlineNodesToPlainText(titleBlock.nodes).trim();
  return title || fallback;
}

export function parseTopLevelSection(
  $: cheerio.CheerioAPI,
  element: Element,
  order: number,
): Fb2Section {
  const href = `section-${order}`;
  return parseSection($, element, element.attribs?.id || href, 0);
}

export function collectNestedToc(
  section: Fb2Section,
  orderRef: { value: number },
  level: number,
  toc: Array<{ title: string; href: string; order: number; level: number }>,
): void {
  for (const block of section.blocks) {
    if (block.kind !== "section") continue;

    orderRef.value += 1;
    toc.push({
      title: sectionTitle(block.section, `Раздел ${orderRef.value}`),
      href: block.section.id,
      order: orderRef.value,
      level: level + 1,
    });
    collectNestedToc(block.section, orderRef, level + 1, toc);
  }
}
