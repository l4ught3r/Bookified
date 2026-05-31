import { initEpubFile, type EpubFile, type EpubProcessedChapter, type ManifestItem } from "@lingo-reader/epub-parser";
import fs from "fs";
import os from "os";
import path from "path";

export type EpubLoadedChapter = {
  order: number;
  spineId: string;
  href: string;
  linear?: string;
  processed: EpubProcessedChapter;
  manifestItem: ManifestItem;
};

export type EpubLoadedBundle = {
  epub: EpubFile;
  workDir: string;
  resourceSaveDir: string;
  manifest: Record<string, ManifestItem>;
  spine: ReturnType<EpubFile["getSpine"]>;
  metadata: ReturnType<EpubFile["getMetadata"]>;
  toc: ReturnType<EpubFile["getToc"]>;
  guide: ReturnType<EpubFile["getGuide"]>;
  chapters: EpubLoadedChapter[];
};

export type LoadEpubOptions = {
  buffer: Buffer;
  skipLinearNo?: boolean;
  maxChapters?: number;
};

export async function loadEpubBundle(options: LoadEpubOptions): Promise<EpubLoadedBundle> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookified-epub-work-"));
  const resourceSaveDir = path.join(workDir, "resources");
  fs.mkdirSync(resourceSaveDir, { recursive: true });

  const epub = await initEpubFile(new Uint8Array(options.buffer), resourceSaveDir);
  const manifest = epub.getManifest();
  const spine = epub.getSpine();
  const metadata = epub.getMetadata();
  const toc = epub.getToc();
  const guide = epub.getGuide();

  const chapters: EpubLoadedChapter[] = [];
  let order = 0;

  for (const spineItem of spine) {
    if (options.skipLinearNo !== false && spineItem.linear === "no") {
      continue;
    }

    const manifestItem = manifest[spineItem.id];
    if (!manifestItem) continue;

    order += 1;
    if (options.maxChapters && order > options.maxChapters) break;

    let processed: EpubProcessedChapter;
    try {
      processed = await epub.loadChapter(spineItem.id);
    } catch (error) {
      processed = { html: `<p>Failed to load chapter ${spineItem.id}</p>`, css: [] };
      console.warn(`EPUB chapter load failed (${spineItem.id}):`, error);
    }

    chapters.push({
      order,
      spineId: spineItem.id,
      href: manifestItem.href,
      linear: spineItem.linear,
      processed,
      manifestItem,
    });
  }

  return {
    epub,
    workDir,
    resourceSaveDir,
    manifest,
    spine,
    metadata,
    toc,
    guide,
    chapters,
  };
}

export function disposeEpubBundle(bundle: EpubLoadedBundle): void {
  try {
    bundle.epub.destroy();
  } catch {
    // ignore cleanup errors
  }

  try {
    fs.rmSync(bundle.workDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}
