export type {
  EpubChapterTypography,
  EpubTypographyDocument,
  EpubTypographyPipelineOptions,
  EpubTypographyPipelineResult,
  FontFaceDeclaration,
  TypographyLayoutSnapshot,
  TypographyNode,
  TypographyNodeMeta,
  TypographyStyleSnapshot,
} from "./typography/types";

export { COMPUTED_LAYOUT_PROPERTIES, COMPUTED_TYPOGRAPHY_PROPERTIES } from "./typography/properties";

export { loadEpubBundle, disposeEpubBundle } from "./epub/loader";
export { EpubAssetResolver } from "./epub/asset-resolver";

export { EpubRenderDocumentBuilder, collectStylesheetTexts } from "./css/document-builder";
export { extractFontFaceDeclarations } from "./css/font-face-registry";

export { LocalAssetServer, createFlatAssetRouteResolver } from "./renderer/asset-server";
export { acquireBrowser, releaseBrowser, shutdownBrowserManager, withBrowserContext } from "./renderer/browser-manager";
export { renderChapterAndExtractTree } from "./renderer/page-renderer";

export { extractDomTypographyTree } from "./extractor/dom-tree-extractor";
export { pickDominantTypographyNode, findTypographyCandidates, collectSemanticLandmarks } from "./extractor/typography-tree";

export {
  computedNodeToReadingSettings,
  aggregateReadingSettingsFromChapters,
} from "./normalizer/to-reading-settings";

export { serializeTypographyDocument, cloneTypographyDocument } from "./serializer/ast-serializer";

export {
  EpubTypographyPipeline,
  extractEpubTypographyWithBrowser,
  cleanupTypographyWorkDir,
} from "./pipeline/epub-typography-pipeline";

export { extractFb2Typography } from "./pipeline/fb2-typography-pipeline";
export type { Fb2TypographyPipelineResult } from "./pipeline/fb2-typography-pipeline";

export { parseFb2Buffer } from "./fb2/parser";
export { buildFb2TypographyDocument } from "./fb2/ast-builder";
export { fb2TypographyToReadingSettings, FB2_DEFAULT_READING_TYPOGRAPHY } from "./fb2/normalizer";
export type {
  Fb2Binary,
  Fb2Chapter,
  Fb2Metadata,
  Fb2ParseResult,
  Fb2Section,
  Fb2TocItem,
} from "./fb2/types";
