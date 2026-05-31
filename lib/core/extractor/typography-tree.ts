import type { TypographyNode } from "../typography/types";
import { TEXTUAL_TAGS } from "../typography/properties";

function walk(node: TypographyNode, visitor: (node: TypographyNode, depth: number) => void, depth = 0) {
  visitor(node, depth);
  for (const child of node.children ?? []) {
    walk(child, visitor, depth + 1);
  }
}

export function findTypographyCandidates(root: TypographyNode): TypographyNode[] {
  const candidates: TypographyNode[] = [];

  walk(root, (node) => {
    if (TEXTUAL_TAGS.has(node.tag)) {
      candidates.push(node);
    }
  });

  if (candidates.length === 0) {
    candidates.push(root);
  }

  return candidates;
}

export function pickDominantTypographyNode(root: TypographyNode): TypographyNode {
  const candidates = findTypographyCandidates(root);
  const scored = candidates.map((node) => {
    const textScore = (node.text?.length ?? 0) > 0 ? 10 : 0;
    const tagScore = node.tag === "p" ? 8 : node.tag === "body" ? 6 : node.tag.startsWith("h") ? 4 : 2;
    const fontSize = Number.parseFloat(node.typography.fontSize ?? "0");
    return { node, score: textScore + tagScore + fontSize / 10 };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.node ?? root;
}

export function collectSemanticLandmarks(root: TypographyNode): Array<{ type: string; href?: string; title?: string }> {
  const landmarks: Array<{ type: string; href?: string; title?: string }> = [];

  walk(root, (node) => {
    const epubType = node.meta?.epubType;
    if (!epubType) return;
    if (!/(toc|cover|bodymatter|chapter|footnote|titlepage)/i.test(epubType)) return;
    landmarks.push({
      type: epubType,
      href: node.meta?.href,
      title: node.text,
    });
  });

  return landmarks;
}
