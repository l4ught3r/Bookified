import fs from "fs";
import path from "path";
import type { EpubLoadedChapter } from "../epub/loader";
import type { EpubAssetResolver } from "../epub/asset-resolver";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rewriteCssUrls(css: string, resolver: EpubAssetResolver, baseUrl: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, _quote, rawUrl) => {
    const url = rawUrl.trim();
    if (/^(https?:|data:|#)/i.test(url)) return match;

    const publicUrl =
      resolver.resolveFromAbsoluteFilesystemPath(url) ??
      resolver.getPublicUrl(url) ??
      (url.startsWith("/assets/") ? url : null);

    if (!publicUrl) return match;
    return `url(${baseUrl}${publicUrl.startsWith("/") ? publicUrl : `/${publicUrl}`})`;
  });
}

function rewriteHtmlResourceUrls(html: string, resolver: EpubAssetResolver, baseUrl: string): string {
  return html.replace(
    /(<(?:img|video|audio|source|image)\b[^>]*\b(?:src|poster|href|xlink:href)=")([^"]+)(")/gi,
    (match, prefix, src, suffix) => {
      if (/^(https?:|data:)/i.test(src)) return match;
      const publicUrl =
        resolver.resolveFromAbsoluteFilesystemPath(src) ??
        resolver.getPublicUrl(src) ??
        null;
      if (!publicUrl) return match;
      return `${prefix}${baseUrl}${publicUrl}${suffix}`;
    },
  );
}

export type RenderDocument = {
  chapterOrder: number;
  href: string;
  filePath: string;
  publicPath: string;
  html: string;
};

export class EpubRenderDocumentBuilder {
  constructor(
    private readonly renderDir: string,
    private readonly assetResolver: EpubAssetResolver,
    private readonly baseUrl: string,
  ) {}

  buildChapterDocument(chapter: EpubLoadedChapter): RenderDocument {
    const cssLinks = chapter.processed.css
      .filter((part) => fs.existsSync(part.href))
      .map((part, index) => {
        const css = fs.readFileSync(part.href, "utf-8");
        const rewritten = rewriteCssUrls(css, this.assetResolver, this.baseUrl);
        const cssFile = path.join(this.renderDir, "css", `${chapter.order}-${index}.css`);
        fs.mkdirSync(path.dirname(cssFile), { recursive: true });
        fs.writeFileSync(cssFile, rewritten, "utf-8");
        return `<link rel="stylesheet" href="${this.baseUrl}/render/css/${chapter.order}-${index}.css" />`;
      })
      .join("\n");

    const bodyHtml = rewriteHtmlResourceUrls(chapter.processed.html, this.assetResolver, this.baseUrl);
    const lang = "und";

    const html = `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${this.baseUrl}/" />
  ${cssLinks}
  <style>
    html, body { margin: 0; padding: 0; }
    body { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: inherit; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

    const filePath = path.join(this.renderDir, "chapters", `${chapter.order}.xhtml`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, html, "utf-8");

    return {
      chapterOrder: chapter.order,
      href: chapter.href,
      filePath,
      publicPath: `/render/chapters/${chapter.order}.xhtml`,
      html,
    };
  }
}

export function collectStylesheetTexts(chapters: EpubLoadedChapter[], manifestCssHrefs: string[], resourceSaveDir: string): string[] {
  const cssTexts: string[] = [];

  for (const chapter of chapters) {
    for (const part of chapter.processed.css) {
      if (fs.existsSync(part.href)) {
        cssTexts.push(fs.readFileSync(part.href, "utf-8"));
      }
    }
  }

  for (const href of manifestCssHrefs) {
    const saved = path.join(resourceSaveDir, href.replace(/\//g, "_"));
    if (fs.existsSync(saved)) {
      cssTexts.push(fs.readFileSync(saved, "utf-8"));
    }
  }

  return cssTexts;
}
