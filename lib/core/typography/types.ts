export type TypographyStyleSnapshot = {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  lineHeight?: string;
  letterSpacing?: string;
  wordSpacing?: string;
  textIndent?: string;
  textAlign?: string;
  color?: string;
  backgroundColor?: string;
  textTransform?: string;
  textDecoration?: string;
  writingMode?: string;
  verticalAlign?: string;
  direction?: string;
  unicodeBidi?: string;
  whiteSpace?: string;
  overflowWrap?: string;
  wordBreak?: string;
  hyphens?: string;
  opacity?: string;
  visibility?: string;
};

export type TypographyLayoutSnapshot = {
  display?: string;
  width?: string;
  height?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
};

export type TypographyNodeMeta = {
  id?: string;
  className?: string;
  epubType?: string;
  role?: string;
  lang?: string;
  dir?: string;
  href?: string;
  src?: string;
  inlineStyle?: string;
  landmark?: string;
  isFootnote?: boolean;
  isRuby?: boolean;
  selector?: string;
};

export type TypographyNode = {
  tag: string;
  text?: string;
  typography: TypographyStyleSnapshot;
  layout: TypographyLayoutSnapshot;
  meta?: TypographyNodeMeta;
  children?: TypographyNode[];
};

export type FontFaceDeclaration = {
  fontFamily: string;
  src: string[];
  fontWeight?: string;
  fontStyle?: string;
  fontDisplay?: string;
  href?: string;
};

export type EpubChapterTypography = {
  order: number;
  spineId: string;
  href: string;
  title?: string;
  linear?: string;
  root: TypographyNode;
  errors: string[];
};

export type EpubTypographyDocument = {
  version: "1.0";
  extractedAt: string;
  sourceFormat?: "epub" | "fb2" | "pdf";
  language?: string;
  direction?: string;
  spineOrder: string[];
  toc: Array<{
    title: string;
    href: string;
    order: number;
    level: number;
    chapterId?: string;
  }>;
  landmarks: Array<{ type: string; href?: string; title?: string }>;
  fontFaces: FontFaceDeclaration[];
  chapters: EpubChapterTypography[];
  errors: string[];
};

export type EpubTypographyPipelineOptions = {
  bookId: string;
  batchSize?: number;
  maxChapters?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  includeHiddenNodes?: boolean;
  skipLinearNo?: boolean;
};

export type EpubTypographyPipelineResult = {
  document: EpubTypographyDocument;
  workDir: string;
};
