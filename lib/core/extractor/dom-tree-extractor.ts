import type { TypographyLayoutSnapshot, TypographyNode, TypographyStyleSnapshot } from "../typography/types";

export type BrowserTypographyNode = TypographyNode;

export function extractDomTypographyTree(includeHiddenNodes: boolean): BrowserTypographyNode | null {
  const body = document.body;
  if (!body) return null;

  const SKIP = new Set(["script", "style", "noscript", "template", "meta", "link", "head"]);

  const buildSelector = (element: Element): string => {
    const tag = element.tagName.toLowerCase();
    if (element.id) return `${tag}#${element.id}`;
    const className = element.className?.toString().trim();
    if (className) return `${tag}.${className.split(/\s+/).slice(0, 2).join(".")}`;
    return tag;
  };

  const walk = (element: Element): BrowserTypographyNode | null => {
    const tag = element.tagName.toLowerCase();
    if (SKIP.has(tag)) return null;

    const styles = window.getComputedStyle(element);
    if (!includeHiddenNodes && (styles.display === "none" || styles.visibility === "hidden")) {
      return null;
    }

    const children: BrowserTypographyNode[] = [];
    for (const child of Array.from(element.children)) {
      const node = walk(child);
      if (node) children.push(node);
    }

    const textContent = Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
      .filter(Boolean)
      .join(" ");

    const epubType =
      element.getAttribute("epub:type") ??
      element.getAttributeNS("http://www.idpf.org/2007/ops", "type") ??
      undefined;

    const typography: TypographyStyleSnapshot = {
      fontFamily: styles.fontFamily,
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
      fontStyle: styles.fontStyle,
      lineHeight: styles.lineHeight,
      letterSpacing: styles.letterSpacing,
      wordSpacing: styles.wordSpacing,
      textIndent: styles.textIndent,
      textAlign: styles.textAlign,
      color: styles.color,
      backgroundColor: styles.backgroundColor,
      textTransform: styles.textTransform,
      textDecoration: styles.textDecorationLine,
      writingMode: styles.writingMode,
      verticalAlign: styles.verticalAlign,
      direction: styles.direction,
      unicodeBidi: styles.unicodeBidi,
      whiteSpace: styles.whiteSpace,
      overflowWrap: styles.overflowWrap,
      wordBreak: styles.wordBreak,
      hyphens: styles.hyphens,
      opacity: styles.opacity,
      visibility: styles.visibility,
    };

    const layout: TypographyLayoutSnapshot = {
      display: styles.display,
      width: styles.width,
      height: styles.height,
      marginTop: styles.marginTop,
      marginRight: styles.marginRight,
      marginBottom: styles.marginBottom,
      marginLeft: styles.marginLeft,
      paddingTop: styles.paddingTop,
      paddingRight: styles.paddingRight,
      paddingBottom: styles.paddingBottom,
      paddingLeft: styles.paddingLeft,
    };

    return {
      tag,
      text: textContent || undefined,
      typography,
      layout,
      meta: {
        id: element.id || undefined,
        className: element.className?.toString() || undefined,
        epubType,
        role: element.getAttribute("role") || undefined,
        lang: element.getAttribute("lang") || undefined,
        dir: element.getAttribute("dir") || undefined,
        href: element.getAttribute("href") || undefined,
        src: element.getAttribute("src") || undefined,
        inlineStyle: element.getAttribute("style") || undefined,
        landmark:
          element.closest('[epub\\:type], [role="doc-abstract"]')?.getAttribute("epub:type") ||
          undefined,
        isFootnote: /footnote|note|endnote/i.test(`${epubType ?? ""} ${element.className}`),
        isRuby: tag === "ruby" || tag === "rt" || tag === "rp" || Boolean(element.closest("ruby")),
        selector: buildSelector(element),
      },
      children: children.length > 0 ? children : undefined,
    };
  };

  return walk(body);
}
