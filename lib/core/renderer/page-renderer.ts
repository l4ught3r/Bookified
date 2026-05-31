import type { Page } from "playwright";
import { extractDomTypographyTree, type BrowserTypographyNode } from "../extractor/dom-tree-extractor";

export type ChapterRenderOptions = {
  url: string;
  viewportWidth: number;
  viewportHeight: number;
  includeHiddenNodes: boolean;
  timeoutMs: number;
};

export async function renderChapterAndExtractTree(
  page: Page,
  options: ChapterRenderOptions,
): Promise<BrowserTypographyNode | null> {
  await page.setViewportSize({
    width: options.viewportWidth,
    height: options.viewportHeight,
  });

  await page.goto(options.url, {
    waitUntil: "networkidle",
    timeout: options.timeoutMs,
  });

  await page.waitForFunction(() => document.readyState === "complete", undefined, {
    timeout: options.timeoutMs,
  });

  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  });

  await page.waitForTimeout(50);

  return page.evaluate(extractDomTypographyTree, options.includeHiddenNodes);
}
