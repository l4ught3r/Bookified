import fs from "fs";
import path from "path";
import type { ManifestItem } from "@lingo-reader/epub-parser";

export type ResolvedAsset = {
  href: string;
  absolutePath: string;
  publicPath: string;
  mediaType: string;
  kind: "image" | "style" | "font" | "other";
};

function savedResourceName(epubHref: string): string {
  return epubHref.replace(/\//g, "_");
}

function detectKind(mediaType: string, href: string): ResolvedAsset["kind"] {
  if (mediaType.startsWith("image/") || mediaType.includes("svg")) return "image";
  if (mediaType.includes("css")) return "style";
  if (
    mediaType.includes("font") ||
    mediaType.includes("opentype") ||
    mediaType.includes("woff") ||
    mediaType.includes("truetype")
  ) {
    return "font";
  }
  if (/\.(woff2?|otf|ttf|eot)$/i.test(href)) return "font";
  if (/\.(css)$/i.test(href)) return "style";
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(href)) return "image";
  return "other";
}

export class EpubAssetResolver {
  private readonly hrefToPublicPath = new Map<string, string>();
  private readonly hrefToAbsolutePath = new Map<string, string>();
  private readonly savedNameToHref = new Map<string, string>();

  constructor(
    private readonly resourceSaveDir: string,
    manifest: Record<string, ManifestItem>,
  ) {
    for (const item of Object.values(manifest)) {
      const savedName = savedResourceName(item.href);
      this.savedNameToHref.set(savedName, item.href);

      const absolutePath = path.join(resourceSaveDir, savedName);
      const publicPath = `/assets/${encodeURIComponent(item.href)}`;

      this.hrefToPublicPath.set(item.href, publicPath);
      this.hrefToAbsolutePath.set(item.href, absolutePath);
    }
  }

  getPublicUrl(href: string): string | undefined {
    return this.hrefToPublicPath.get(this.normalizeHref(href));
  }

  getAbsolutePath(href: string): string | undefined {
    return this.hrefToAbsolutePath.get(this.normalizeHref(href));
  }

  resolveFromAbsoluteFilesystemPath(filePath: string): string | undefined {
    const normalized = filePath.replace(/\\/g, "/");
    const savedName = path.basename(normalized);
    const href = this.savedNameToHref.get(savedName);
    return href ? this.getPublicUrl(href) : undefined;
  }

  listAssets(manifest: Record<string, ManifestItem>): ResolvedAsset[] {
    const assets: ResolvedAsset[] = [];

    for (const item of Object.values(manifest)) {
      const absolutePath = this.getAbsolutePath(item.href);
      if (!absolutePath || !fs.existsSync(absolutePath)) continue;

      assets.push({
        href: item.href,
        absolutePath,
        publicPath: this.getPublicUrl(item.href) ?? absolutePath,
        mediaType: item.mediaType,
        kind: detectKind(item.mediaType, item.href),
      });
    }

    return assets;
  }

  private normalizeHref(href: string): string {
    return href.replace(/\\/g, "/").replace(/^\/+/, "");
  }
}
