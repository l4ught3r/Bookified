import { bookAssetUrl } from "@/lib/books/asset-url";
import { escapeHtml } from "./utils";
import type { Fb2Block, Fb2Chapter, Fb2InlineNode, Fb2Poem, Fb2Section } from "./types";

function renderInlineHtml(nodes: Fb2InlineNode[], bookId: string): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
          return escapeHtml(node.value);
        case "emphasis":
          return `<em>${renderInlineHtml(node.children, bookId)}</em>`;
        case "strong":
          return `<strong>${renderInlineHtml(node.children, bookId)}</strong>`;
        case "strikethrough":
          return `<s>${renderInlineHtml(node.children, bookId)}</s>`;
        case "sub":
          return `<sub>${renderInlineHtml(node.children, bookId)}</sub>`;
        case "sup":
          return `<sup>${renderInlineHtml(node.children, bookId)}</sup>`;
        case "code":
          return `<code>${renderInlineHtml(node.children, bookId)}</code>`;
        case "link":
          return `<a href="${escapeHtml(node.href)}">${renderInlineHtml(node.children, bookId)}</a>`;
        case "image":
          return renderFigureHtml(node.binaryId, bookId);
      }
    })
    .join("");
}

function renderFigureHtml(binaryId: string, bookId: string): string {
  const src = bookAssetUrl(bookId, binaryId);
  return `<figure class="book-inline-image"><img src="${src}" alt="" loading="lazy" /></figure>`;
}

function renderPoemHtml(poem: Fb2Poem, bookId: string): string {
  let html = '<div class="poem" role="doc-poem">';
  if (poem.title?.length) {
    html += `<h4 class="poem-title">${renderInlineHtml(poem.title, bookId)}</h4>`;
  }

  for (const stanza of poem.stanzas) {
    html += '<div class="stanza">';
    for (const verse of stanza) {
      html += `<p class="verse">${renderInlineHtml(verse, bookId)}</p>`;
    }
    html += "</div>";
  }

  html += "</div>";
  return html;
}

function renderParagraphHtml(nodes: Fb2InlineNode[], bookId: string): string {
  const hasImage = nodes.some((node) => node.kind === "image");
  if (!hasImage) {
    const content = renderInlineHtml(nodes, bookId);
    if (!content.trim()) return "";
    return `<p>${content}</p>`;
  }

  let html = "";
  let chunk: Fb2InlineNode[] = [];

  const flushChunk = () => {
    if (chunk.length === 0) return;
    const content = renderInlineHtml(chunk, bookId);
    if (content.trim()) {
      html += `<p>${content}</p>`;
    }
    chunk = [];
  };

  for (const node of nodes) {
    if (node.kind === "image") {
      flushChunk();
      html += renderFigureHtml(node.binaryId, bookId);
      continue;
    }
    chunk.push(node);
  }

  flushChunk();
  return html;
}

function renderContentBlocksHtml(blocks: Fb2Block[], bookId: string, depth: number): string {
  return blocks.map((block) => renderBlockHtml(block, bookId, depth)).join("");
}

function renderBlockHtml(block: Fb2Block, bookId: string, depth: number): string {
  switch (block.kind) {
    case "paragraph": {
      const html = renderParagraphHtml(block.nodes, bookId);
      if (!html && !block.nodes.some((node) => node.kind === "image")) return "";
      return html;
    }
    case "empty-line":
      return `<div class="fb2-empty-line" aria-hidden="true" data-empty-lines="${block.count}"></div>`;
    case "image":
      return renderFigureHtml(block.binaryId, bookId);
    case "title": {
      const tag = `h${Math.min(Math.max(block.level, 1), 6)}`;
      return `<${tag} class="fb2-title">${renderInlineHtml(block.nodes, bookId)}</${tag}>`;
    }
    case "subtitle":
      return `<h3 class="fb2-subtitle">${renderInlineHtml(block.nodes, bookId)}</h3>`;
    case "epigraph":
      return `<blockquote class="epigraph">${renderContentBlocksHtml(block.blocks, bookId, depth)}</blockquote>`;
    case "cite":
      return `<blockquote class="cite">${renderContentBlocksHtml(block.blocks, bookId, depth)}</blockquote>`;
    case "text-author":
      return `<p class="text-author">${renderInlineHtml(block.nodes, bookId)}</p>`;
    case "poem":
      return renderPoemHtml(block.poem, bookId);
    case "section":
      return renderSectionHtml(block.section, bookId, depth + 1);
  }
}

function renderSectionHtml(section: Fb2Section, bookId: string, depth = 0): string {
  const inner = section.blocks.map((block) => renderBlockHtml(block, bookId, depth)).join("");
  if (depth === 0) return inner;
  return `<section class="subsection" id="${escapeHtml(section.id)}">${inner}</section>`;
}

export function renderFb2ChapterHtml(chapter: Fb2Chapter, bookId: string): string {
  return renderSectionHtml(chapter.section, bookId);
}

export function renderFb2ChapterPlainText(chapter: Fb2Chapter): string {
  return chapter.title;
}
