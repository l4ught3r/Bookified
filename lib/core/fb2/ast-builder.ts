import { bookAssetUrl } from "@/lib/books/asset-url";
import type {
  EpubTypographyDocument,
  TypographyLayoutSnapshot,
  TypographyNode,
  TypographyStyleSnapshot,
} from "../typography/types";
import { inlineNodesToPlainText } from "./section-parser";
import type { Fb2Block, Fb2Chapter, Fb2InlineNode, Fb2ParseResult, Fb2Poem, Fb2Section } from "./types";

const FB2_BODY_TYPOGRAPHY: TypographyStyleSnapshot = {
  fontFamily: "Geist, Inter, sans-serif",
  fontSize: "18px",
  fontWeight: "400",
  fontStyle: "normal",
  lineHeight: "1.6",
  letterSpacing: "0px",
  wordSpacing: "0px",
  textIndent: "1.5em",
  textAlign: "justify",
  color: "inherit",
};

const FB2_HEADING_TYPOGRAPHY: TypographyStyleSnapshot = {
  ...FB2_BODY_TYPOGRAPHY,
  fontWeight: "700",
  textIndent: "0px",
  lineHeight: "1.3",
};

const FB2_EPIGRAPH_TYPOGRAPHY: TypographyStyleSnapshot = {
  ...FB2_BODY_TYPOGRAPHY,
  fontStyle: "italic",
  textAlign: "right",
  textIndent: "0px",
};

const FB2_EMPTY_LINE_LAYOUT: TypographyLayoutSnapshot = {
  display: "block",
  height: "1.5em",
  marginBottom: "0.75em",
};

const FB2_LAYOUT: TypographyLayoutSnapshot = {
  display: "block",
};

function typographyNode(
  tag: string,
  options: {
    text?: string;
    typography?: TypographyStyleSnapshot;
    layout?: TypographyLayoutSnapshot;
    meta?: TypographyNode["meta"];
    children?: TypographyNode[];
  } = {},
): TypographyNode {
  return {
    tag,
    text: options.text,
    typography: options.typography ?? FB2_BODY_TYPOGRAPHY,
    layout: options.layout ?? FB2_LAYOUT,
    meta: options.meta,
    children: options.children,
  };
}

function buildInlineText(nodes: Fb2InlineNode[]): string {
  return inlineNodesToPlainText(nodes).replace(/\s+/g, " ").trim();
}

function buildInlineAst(nodes: Fb2InlineNode[], bookId: string): TypographyNode[] {
  const result: TypographyNode[] = [];

  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        if (node.value) {
          result.push(
            typographyNode("span", {
              text: node.value,
              typography: { ...FB2_BODY_TYPOGRAPHY, textIndent: "0px" },
            }),
          );
        }
        break;
      case "emphasis":
        result.push(
          typographyNode("em", {
            text: buildInlineText(node.children),
            typography: { ...FB2_BODY_TYPOGRAPHY, fontStyle: "italic", textIndent: "0px" },
            children: buildInlineAst(node.children, bookId),
          }),
        );
        break;
      case "strong":
        result.push(
          typographyNode("strong", {
            text: buildInlineText(node.children),
            typography: { ...FB2_BODY_TYPOGRAPHY, fontWeight: "700", textIndent: "0px" },
            children: buildInlineAst(node.children, bookId),
          }),
        );
        break;
      case "strikethrough":
        result.push(
          typographyNode("s", {
            text: buildInlineText(node.children),
            typography: { ...FB2_BODY_TYPOGRAPHY, textDecoration: "line-through", textIndent: "0px" },
            children: buildInlineAst(node.children, bookId),
          }),
        );
        break;
      case "sub":
        result.push(typographyNode("sub", { text: buildInlineText(node.children), children: buildInlineAst(node.children, bookId) }));
        break;
      case "sup":
        result.push(typographyNode("sup", { text: buildInlineText(node.children), children: buildInlineAst(node.children, bookId) }));
        break;
      case "code":
        result.push(typographyNode("code", { text: buildInlineText(node.children), children: buildInlineAst(node.children, bookId) }));
        break;
      case "link":
        result.push(
          typographyNode("a", {
            text: buildInlineText(node.children),
            typography: { ...FB2_BODY_TYPOGRAPHY, textDecoration: "underline", textIndent: "0px" },
            meta: { href: node.href },
            children: buildInlineAst(node.children, bookId),
          }),
        );
        break;
      case "image":
        result.push(
          typographyNode("img", {
            meta: {
              src: bookAssetUrl(bookId, node.binaryId),
              id: node.binaryId,
            },
          }),
        );
        break;
    }
  }

  return result;
}

function buildPoemAst(poem: Fb2Poem, bookId: string): TypographyNode {
  const children: TypographyNode[] = [];

  if (poem.title?.length) {
    children.push(
      typographyNode("h4", {
        text: buildInlineText(poem.title),
        typography: FB2_HEADING_TYPOGRAPHY,
        meta: { className: "poem-title" },
        children: buildInlineAst(poem.title, bookId),
      }),
    );
  }

  for (const stanza of poem.stanzas) {
    children.push(
      typographyNode("div", {
        meta: { className: "stanza" },
        children: stanza.map((verse, index) =>
          typographyNode("p", {
            text: buildInlineText(verse),
            typography: { ...FB2_BODY_TYPOGRAPHY, textIndent: index === 0 ? "0px" : "1.5em" },
            meta: { className: "verse" },
            children: buildInlineAst(verse, bookId),
          }),
        ),
      }),
    );
  }

  return typographyNode("div", { meta: { className: "poem", epubType: "poem" }, children });
}

function buildBlockAst(block: Fb2Block, bookId: string, depth: number): TypographyNode | null {
  switch (block.kind) {
    case "paragraph": {
      const text = buildInlineText(block.nodes);
      if (!text && !block.nodes.some((node) => node.kind === "image")) return null;
      return typographyNode("p", {
        text: text || undefined,
        children: buildInlineAst(block.nodes, bookId),
      });
    }
    case "empty-line":
      return typographyNode("div", {
        meta: { className: "fb2-empty-line" },
        layout: FB2_EMPTY_LINE_LAYOUT,
      });
    case "image":
      return typographyNode("figure", {
        meta: { className: "book-inline-image", src: bookAssetUrl(bookId, block.binaryId), id: block.binaryId },
        children: [
          typographyNode("img", {
            meta: { src: bookAssetUrl(bookId, block.binaryId), id: block.binaryId },
          }),
        ],
      });
    case "title":
      return typographyNode(`h${Math.min(Math.max(block.level, 1), 6)}`, {
        text: buildInlineText(block.nodes),
        typography: FB2_HEADING_TYPOGRAPHY,
        meta: { epubType: "title", className: "fb2-title" },
        children: buildInlineAst(block.nodes, bookId),
      });
    case "subtitle":
      return typographyNode("h3", {
        text: buildInlineText(block.nodes),
        typography: FB2_HEADING_TYPOGRAPHY,
        meta: { className: "fb2-subtitle" },
        children: buildInlineAst(block.nodes, bookId),
      });
    case "epigraph":
      return typographyNode("blockquote", {
        typography: FB2_EPIGRAPH_TYPOGRAPHY,
        meta: { className: "epigraph", epubType: "epigraph" },
        children: block.blocks
          .map((child) => buildBlockAst(child, bookId, depth))
          .filter(Boolean) as TypographyNode[],
      });
    case "cite":
      return typographyNode("blockquote", {
        typography: FB2_EPIGRAPH_TYPOGRAPHY,
        meta: { className: "cite" },
        children: block.blocks
          .map((child) => buildBlockAst(child, bookId, depth))
          .filter(Boolean) as TypographyNode[],
      });
    case "text-author":
      return typographyNode("p", {
        text: buildInlineText(block.nodes),
        typography: { ...FB2_BODY_TYPOGRAPHY, textAlign: "right", textIndent: "0px" },
        meta: { className: "text-author" },
        children: buildInlineAst(block.nodes, bookId),
      });
    case "poem":
      return buildPoemAst(block.poem, bookId);
    case "section":
      return typographyNode("section", {
        meta: { id: block.section.id, epubType: "section", className: "subsection" },
        children: buildSectionAst(block.section, bookId, depth + 1),
      });
  }
}

function buildSectionAst(section: Fb2Section, bookId: string, _depth = 0): TypographyNode[] {
  return section.blocks
    .map((block) => buildBlockAst(block, bookId, _depth))
    .filter(Boolean) as TypographyNode[];
}

export function buildFb2ChapterAst(chapter: Fb2Chapter, bookId: string): TypographyNode {
  return typographyNode("body", {
    children: buildSectionAst(chapter.section, bookId),
  });
}

export function buildFb2TypographyDocument(
  parsed: Fb2ParseResult,
  bookId: string,
): EpubTypographyDocument {
  return {
    version: "1.0",
    extractedAt: new Date().toISOString(),
    sourceFormat: "fb2",
    language: parsed.metadata.language,
    direction: undefined,
    spineOrder: parsed.chapters.map((chapter) => chapter.href),
    toc: parsed.toc.map((item) => ({
      title: item.title,
      href: item.href,
      order: item.order,
      level: item.level,
    })),
    landmarks: parsed.metadata.coverBinaryId
      ? [{ type: "cover", href: parsed.metadata.coverBinaryId, title: parsed.metadata.title }]
      : [],
    fontFaces: [],
    chapters: parsed.chapters.map((chapter) => ({
      order: chapter.order,
      spineId: chapter.href,
      href: chapter.href,
      title: chapter.title,
      root: buildFb2ChapterAst(chapter, bookId),
      errors: [],
    })),
    errors: parsed.errors,
  };
}
