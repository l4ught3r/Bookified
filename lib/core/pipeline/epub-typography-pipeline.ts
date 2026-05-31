import fs from "fs";
import path from "path";
import type { ReadingTypographySettings } from "@/lib/books/reading-typography";
import { collectStylesheetTexts, EpubRenderDocumentBuilder } from "../css/document-builder";
import { extractFontFaceDeclarations } from "../css/font-face-registry";
import { loadEpubBundle } from "../epub/loader";
import { EpubAssetResolver } from "../epub/asset-resolver";
import { collectSemanticLandmarks } from "../extractor/typography-tree";
import { aggregateReadingSettingsFromChapters } from "../normalizer/to-reading-settings";
import { withBrowserContext } from "../renderer/browser-manager";
import { createFlatAssetRouteResolver, LocalAssetServer } from "../renderer/asset-server";
import { renderChapterAndExtractTree } from "../renderer/page-renderer";
import { cloneTypographyDocument } from "../serializer/ast-serializer";
import type {
  EpubTypographyDocument,
  EpubTypographyPipelineOptions,
  EpubTypographyPipelineResult,
  FontFaceDeclaration,
} from "../typography/types";

const DEFAULT_BATCH_SIZE = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function resolveFontFaceAssetHref(
  src: string,
  resolver: EpubAssetResolver,
): string | undefined {
  const publicUrl = resolver.resolveFromAbsoluteFilesystemPath(src) ?? resolver.getPublicUrl(src);
  if (!publicUrl?.startsWith("/assets/")) return undefined;
  return decodeURIComponent(publicUrl.slice("/assets/".length));
}

function mapFontFaces(
  declarations: FontFaceDeclaration[],
  resolver: EpubAssetResolver,
): FontFaceDeclaration[] {
  return declarations.map((face) => ({
    ...face,
    href: face.src.map((src) => resolveFontFaceAssetHref(src, resolver)).find(Boolean),
  }));
}

export class EpubTypographyPipeline {
  async run(buffer: Buffer, options: EpubTypographyPipelineOptions): Promise<EpubTypographyPipelineResult> {
    const bundle = await loadEpubBundle({
      buffer,
      skipLinearNo: options.skipLinearNo ?? true,
      maxChapters: options.maxChapters,
    });

    const assetResolver = new EpubAssetResolver(bundle.resourceSaveDir, bundle.manifest);
    const renderDir = path.join(bundle.workDir, "render");
    const server = new LocalAssetServer(
      bundle.workDir,
      createFlatAssetRouteResolver(bundle.resourceSaveDir),
    );

    const cssTexts = collectStylesheetTexts(
      bundle.chapters,
      Object.values(bundle.manifest)
        .filter((item) => item.mediaType.includes("css"))
        .map((item) => item.href),
      bundle.resourceSaveDir,
    );

    const fontFaces = mapFontFaces(extractFontFaceDeclarations(cssTexts), assetResolver);

    const document: EpubTypographyDocument = {
      version: "1.0",
      extractedAt: new Date().toISOString(),
      sourceFormat: "epub",
      language: bundle.metadata.language,
      direction: undefined,
      spineOrder: bundle.spine.map((item) => item.id),
      toc: bundle.toc.map((item, index) => ({
        title: item.label,
        href: item.href,
        order: index + 1,
        level: 0,
      })),
      landmarks: bundle.guide.map((item) => ({
        type: item.type,
        href: item.href,
        title: item.title,
      })),
      fontFaces,
      chapters: [],
      errors: [],
    };

    try {
      const baseUrl = await server.start();
      const builder = new EpubRenderDocumentBuilder(renderDir, assetResolver, baseUrl);
      const renderDocuments = bundle.chapters.map((chapter) => builder.buildChapterDocument(chapter));

      const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
      const viewportWidth = options.viewportWidth ?? 820;
      const viewportHeight = options.viewportHeight ?? 1180;
      const includeHiddenNodes = options.includeHiddenNodes ?? false;

      await withBrowserContext(async (context) => {
        for (const batch of chunk(renderDocuments, batchSize)) {
          await Promise.all(
            batch.map(async (renderDoc) => {
              const chapter = bundle.chapters.find((item) => item.order === renderDoc.chapterOrder);
              if (!chapter) return;

              const page = await context.newPage();
              try {
                const root = await renderChapterAndExtractTree(page, {
                  url: `${baseUrl}${renderDoc.publicPath}`,
                  viewportWidth,
                  viewportHeight,
                  includeHiddenNodes,
                  timeoutMs: DEFAULT_TIMEOUT_MS,
                });

                if (!root) {
                  document.errors.push(`Empty typography tree for chapter ${chapter.order}`);
                  return;
                }

                document.chapters.push({
                  order: chapter.order,
                  spineId: chapter.spineId,
                  href: chapter.href,
                  title: chapter.manifestItem.id,
                  linear: chapter.linear,
                  root,
                  errors: [],
                });

                document.landmarks.push(...collectSemanticLandmarks(root));
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : "Unknown chapter extraction error";
                document.errors.push(`Chapter ${chapter.order}: ${message}`);
                document.chapters.push({
                  order: chapter.order,
                  spineId: chapter.spineId,
                  href: chapter.href,
                  root: {
                    tag: "body",
                    typography: {},
                    layout: {},
                  },
                  errors: [message],
                });
              } finally {
                await page.close();
              }
            }),
          );
        }
      });

      document.chapters.sort((a, b) => a.order - b.order);
      if (document.chapters[0]?.root.typography.direction) {
        document.direction = document.chapters[0].root.typography.direction;
      }

      bundle.epub.destroy();

      return {
        document: cloneTypographyDocument(document),
        workDir: bundle.workDir,
      };
    } finally {
      await server.stop();
    }
  }
}

export async function extractEpubTypographyWithBrowser(
  buffer: Buffer,
  options: EpubTypographyPipelineOptions,
): Promise<{
  document: EpubTypographyDocument;
  readingSettings: ReadingTypographySettings;
  workDir: string;
}> {
  const pipeline = new EpubTypographyPipeline();
  const result = await pipeline.run(buffer, options);

  const readingSettings = aggregateReadingSettingsFromChapters(
    result.document.chapters.map((chapter) => chapter.root),
    result.document.fontFaces,
  );

  return {
    document: result.document,
    readingSettings,
    workDir: result.workDir,
  };
}

export function cleanupTypographyWorkDir(workDir: string): void {
  if (!workDir || !fs.existsSync(workDir)) return;
  fs.rmSync(workDir, { recursive: true, force: true });
}
