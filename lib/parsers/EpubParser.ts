import {
  initEpubFile,
  type EpubFile,
  type EpubMetadata,
  type EpubProcessedChapter,
  type ManifestItem,
  type NavPoint,
} from "@lingo-reader/epub-parser";
import * as cheerio from "cheerio";
import fs from "fs";
import os from "os";
import path from "path";
import type { ReadingTypographySettings } from "../books/reading-typography";
import { bookAssetUrl } from "../books/asset-url";
import { stripEpubHref } from "../books/chapter-href";
import { collectReferencedAssetHrefs } from "../books/collect-referenced-asset-hrefs";
import { extractHeadingFromHtml, isMeaningfulChapterTitle } from "../books/navigation-labels";
import { buildTocHrefTitleMap, resolveChapterTitleFromToc } from "../books/toc-titles";
import { readEpubEntryByHref } from "../books/read-epub-entry";
import {
  cleanupTypographyWorkDir,
  extractEpubTypographyWithBrowser,
} from "../core/pipeline/epub-typography-pipeline";
import { countWords, extractPlainText, sanitizeBookHtml } from "../sanitize";
import { BaseParser, ParsedAsset, ParsedBook, ParsedChapter, ParsedTocItem } from "./BaseParser";
import { normalizeCoverChapterHtml } from "./epub-html-normalize";
import { buildEmbeddedFontFaceCss, extractEpubTypography } from "./epub-typography";

function shouldUsePlaywrightTypography(): boolean {
  const flag = process.env.BOOKIFIED_PLAYWRIGHT_TYPOGRAPHY?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

const EPUB_HREF_PREFIX = "epub:";

type ResourceLookup = {
  pathToHref: Map<string, string>;
  savedNameToHref: Map<string, string>;
};

function savedResourceName(epubHref: string): string {
  return epubHref.replace(/\//g, "_");
}

function detectAssetKind(mediaType: string, href: string): ParsedAsset["kind"] | null {
  const normalizedType = mediaType.toLowerCase();
  const lowerHref = href.toLowerCase();

  if (normalizedType.startsWith("image/") || normalizedType.includes("svg")) return "image";
  if (normalizedType.includes("css")) return "style";
  if (
    normalizedType.includes("font") ||
    normalizedType.includes("opentype") ||
    normalizedType.includes("woff") ||
    normalizedType.includes("truetype")
  ) {
    return "font";
  }
  if (/\.(woff2?|otf|ttf|eot)(\?|$)/i.test(lowerHref)) return "font";
  if (/\.css(\?|$)/i.test(lowerHref)) return "style";
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(lowerHref)) return "image";
  return null;
}

export class EpubParser extends BaseParser {
  async parse(): Promise<ParsedBook> {
    const resourceSaveDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookified-epub-"));
    let epub: EpubFile | null = null;

    try {
      epub = await initEpubFile(new Uint8Array(this.buffer), resourceSaveDir);
      const metadata = epub.getMetadata();
      const manifest = epub.getManifest();
      const spine = epub.getSpine();
      const lookup = this.buildResourceLookup(manifest, resourceSaveDir);
      const processedChapters: Array<{
        order: number;
        manifestItem: ManifestItem;
        processed: EpubProcessedChapter;
      }> = [];

      for (let i = 0; i < spine.length; i++) {
        const spineItem = spine[i];
        const manifestItem = manifest[spineItem.id];
        if (!manifestItem) continue;

        const processed = await epub.loadChapter(spineItem.id);
        processedChapters.push({ order: i + 1, manifestItem, processed });
      }

      let typography: ReadingTypographySettings | undefined;

      if (shouldUsePlaywrightTypography()) {
        try {
          const browserTypography = await extractEpubTypographyWithBrowser(this.buffer, {
            bookId: this.bookId,
            batchSize: 3,
            skipLinearNo: true,
            maxChapters: 5,
          });
          typography = browserTypography.readingSettings;
          cleanupTypographyWorkDir(browserTypography.workDir);
        } catch (error) {
          console.warn("Playwright typography extraction failed:", error);
        }
      }

      if (!typography) {
        const cssTexts: string[] = [];
        const htmlSamples: string[] = [];

        for (const { processed } of processedChapters) {
          for (const part of processed.css) {
            if (fs.existsSync(part.href)) {
              cssTexts.push(fs.readFileSync(part.href, "utf-8"));
            }
          }

          if (htmlSamples.length < 5) {
            htmlSamples.push(processed.html);
          }
        }

        typography = extractEpubTypography({
          cssTexts,
          htmlSamples,
          hrefBySavedName: lookup.savedNameToHref,
        });
      }

      const toc = this.extractToc(epub.getToc());
      const tocByHref = buildTocHrefTitleMap(toc);

      const chapters: ParsedChapter[] = processedChapters.map(
        ({ order, manifestItem, processed }) => {
          const html = this.buildChapterHtml(processed, lookup, resourceSaveDir, typography, order);
          const text = extractPlainText(html);
          const headingTitle = this.extractChapterTitle(html, order);
          const title = resolveChapterTitleFromToc(manifestItem.href, tocByHref, headingTitle);

          return {
            order,
            title,
            href: manifestItem.href,
            html,
            text,
            wordCount: countWords(text),
          };
        },
      );

      const referencedAssetHrefs = collectReferencedAssetHrefs(chapters, this.bookId, typography);
      const { coverData, coverMediaType, coverHref } = this.extractCover(epub, manifest, resourceSaveDir);
      const assets = this.extractAssets(manifest, resourceSaveDir, referencedAssetHrefs, coverHref);

      return {
        title: metadata.title || "Без названия",
        authors: this.extractAuthors(metadata),
        language: metadata.language || "none",
        description: metadata.description || "",
        identifier: metadata.identifier?.id || "",
        publisher: metadata.publisher || "",
        publishDate: this.extractPublishDate(metadata),
        chapters,
        assets,
        toc,
        coverData,
        coverMediaType,
        typography,
      };
    } finally {
      epub?.destroy();
      fs.rmSync(resourceSaveDir, { recursive: true, force: true });
    }
  }

  private buildResourceLookup(
    manifest: Record<string, ManifestItem>,
    resourceSaveDir: string,
  ): ResourceLookup {
    const pathToHref = new Map<string, string>();
    const savedNameToHref = new Map<string, string>();

    for (const item of Object.values(manifest)) {
      const savedName = savedResourceName(item.href);
      savedNameToHref.set(savedName, item.href);
      savedNameToHref.set(path.basename(item.href), item.href);

      const savedPath = path.resolve(resourceSaveDir, savedName);
      pathToHref.set(savedPath, item.href);
      pathToHref.set(savedPath.replace(/\\/g, "/"), item.href);
    }

    return { pathToHref, savedNameToHref };
  }

  private resolveEpubHref(
    src: string,
    lookup: ResourceLookup,
    resourceSaveDir: string,
    contextFilePath?: string,
  ): string | null {
    if (!src || src.startsWith("http") || src.startsWith("https") || src.startsWith("data:")) {
      return null;
    }

    const normalized = src.replace(/\\/g, "/");
    const baseDir = contextFilePath ? path.dirname(contextFilePath) : resourceSaveDir;
    const resolved = path.isAbsolute(src) ? path.resolve(src) : path.resolve(baseDir, normalized);

    const fromPath =
      lookup.pathToHref.get(resolved) ?? lookup.pathToHref.get(resolved.replace(/\\/g, "/"));
    if (fromPath) return fromPath;

    const savedName = path.basename(resolved);
    return lookup.savedNameToHref.get(savedName) ?? lookup.savedNameToHref.get(normalized) ?? null;
  }

  private buildChapterHtml(
    processed: EpubProcessedChapter,
    lookup: ResourceLookup,
    resourceSaveDir: string,
    typography?: ReadingTypographySettings,
    order?: number,
  ): string {
    const embeddedFontFace = typography ? buildEmbeddedFontFaceCss(typography, this.bookId) : "";
    const styles = processed.css
      .map((part) => {
        if (!fs.existsSync(part.href)) return "";
        const css = fs.readFileSync(part.href, "utf-8");
        const rewritten = this.rewriteCssUrls(css, lookup, resourceSaveDir, part.href);
        return `<style>${rewritten}</style>`;
      })
      .filter(Boolean)
      .join("\n");

    let bodyHtml = this.rewriteResourceUrls(processed.html, lookup, resourceSaveDir);
    bodyHtml = this.rewriteInternalLinks(bodyHtml);
    bodyHtml = sanitizeBookHtml(bodyHtml, this.bookId);
    if (order) {
      bodyHtml = normalizeCoverChapterHtml(bodyHtml, order);
    }

    const fontFaceBlock = embeddedFontFace ? `<style>${embeddedFontFace}</style>` : "";
    return `${fontFaceBlock}${styles}${bodyHtml}`;
  }

  private rewriteCssUrls(
    css: string,
    lookup: ResourceLookup,
    resourceSaveDir: string,
    cssFilePath?: string,
  ): string {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, _quote, rawUrl) => {
      const url = rawUrl.trim();
      const epubHref = this.resolveEpubHref(url, lookup, resourceSaveDir, cssFilePath);
      if (!epubHref) return match;
      return `url(${bookAssetUrl(this.bookId, epubHref)})`;
    });
  }

  private rewriteResourceUrls(
    html: string,
    lookup: ResourceLookup,
    resourceSaveDir: string,
  ): string {
    return html.replace(
      /(<(?:img|video|audio|source|image)\b[^>]*\b(?:src|poster|href|xlink:href)=")([^"]+)(")/gi,
      (match, prefix, src, suffix) => {
        const epubHref = this.resolveEpubHref(src, lookup, resourceSaveDir);
        if (!epubHref) {
          return match;
        }

        return `${prefix}${bookAssetUrl(this.bookId, epubHref)}${suffix}`;
      },
    );
  }

  private rewriteInternalLinks(html: string): string {
    return html.replace(/(<a\b[^>]*\bhref=")([^"]+)(")/gi, (match, prefix, href, suffix) => {
      if (!href.startsWith(EPUB_HREF_PREFIX)) {
        return match;
      }

      return `${prefix}${stripEpubHref(href)}${suffix}`;
    });
  }

  private extractChapterTitle(html: string, fallbackOrder: number): string {
    const heading = extractHeadingFromHtml(html);
    if (heading && isMeaningfulChapterTitle(heading)) {
      return heading;
    }
    return `Секция ${fallbackOrder}`;
  }

  private extractAuthors(metadata: EpubMetadata): string[] {
    const creators = metadata.creator ?? [];
    const authors = creators
      .filter((creator) => !creator.role || creator.role === "aut")
      .map((creator) => creator.contributor.trim())
      .filter(Boolean);

    if (authors.length > 0) {
      return authors;
    }

    return creators.map((creator) => creator.contributor.trim()).filter(Boolean);
  }

  private extractPublishDate(metadata: EpubMetadata): string {
    if (!metadata.date) {
      return "";
    }

    return (
      metadata.date.publication ??
      metadata.date.modified ??
      metadata.date.creation ??
      Object.values(metadata.date)[0] ??
      ""
    );
  }

  private extractAssets(
    manifest: Record<string, ManifestItem>,
    resourceSaveDir: string,
    referencedHrefs: Set<string>,
    coverHref?: string | null,
  ): ParsedAsset[] {
    const assets: ParsedAsset[] = [];

    for (const item of Object.values(manifest)) {
      if (coverHref && item.href === coverHref) continue;
      if (!referencedHrefs.has(item.href)) continue;

      const kind = detectAssetKind(item.mediaType, item.href);
      if (!kind) continue;

      const savedPath = path.join(resourceSaveDir, savedResourceName(item.href));
      let data: Buffer | null = null;

      if (fs.existsSync(savedPath)) {
        data = fs.readFileSync(savedPath);
      } else {
        data = readEpubEntryByHref(this.buffer, item.href);
      }

      if (!data || data.length === 0) continue;

      assets.push({
        href: item.href,
        mediaType: item.mediaType,
        kind,
        data,
      });
    }

    return assets;
  }

  private extractCover(
    epub: EpubFile,
    manifest: Record<string, ManifestItem>,
    resourceSaveDir: string,
  ): { coverData: Buffer | null; coverMediaType: string; coverHref: string | null } {
    const coverCandidates: Array<{ href: string; mediaType: string }> = [];

    for (const item of Object.values(manifest)) {
      if (item.properties?.includes("cover-image")) {
        coverCandidates.unshift({ href: item.href, mediaType: item.mediaType });
      }
    }

    const coverImagePath = epub.getCoverImage();
    if (coverImagePath) {
      for (const item of Object.values(manifest)) {
        const savedPath = path.resolve(resourceSaveDir, savedResourceName(item.href));
        if (savedPath === path.resolve(coverImagePath) && item.mediaType.startsWith("image/")) {
          coverCandidates.unshift({ href: item.href, mediaType: item.mediaType });
          break;
        }
      }
    }

    for (const [id, item] of Object.entries(manifest)) {
      if (
        item.mediaType.startsWith("image/") &&
        (id.toLowerCase().includes("cover") || item.href.toLowerCase().includes("cover"))
      ) {
        coverCandidates.push({ href: item.href, mediaType: item.mediaType });
      }
    }

    for (const candidate of coverCandidates) {
      const savedPath = path.join(resourceSaveDir, savedResourceName(candidate.href));
      let coverData: Buffer | null = null;

      if (fs.existsSync(savedPath)) {
        coverData = fs.readFileSync(savedPath);
      } else {
        coverData = readEpubEntryByHref(this.buffer, candidate.href);
      }

      if (!coverData || coverData.length === 0) continue;

      return {
        coverData,
        coverMediaType: candidate.mediaType || "image/jpeg",
        coverHref: candidate.href,
      };
    }

    return { coverData: null, coverMediaType: "image/jpeg", coverHref: null };
  }

  private extractToc(navPoints: NavPoint[]): ParsedTocItem[] {
    const items: ParsedTocItem[] = [];
    let order = 0;

    const walk = (points: NavPoint[], level: number) => {
      for (const point of points) {
        order += 1;
        items.push({
          title: point.label.trim() || `Раздел ${order}`,
          href: stripEpubHref(point.href),
          order,
          level,
        });

        if (point.children?.length) {
          walk(point.children, level + 1);
        }
      }
    };

    walk(navPoints, 0);
    return items;
  }
}
