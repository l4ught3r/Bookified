import * as cheerio from "cheerio";
import path from "path";
import {
  DEFAULT_READING_TYPOGRAPHY,
  matchReadingFontId,
  normalizeReadingTypography,
  type ReadingTextAlign,
  type ReadingTypographySettings,
} from "../books/reading-typography";

type CssPropertyBag = Partial<
  Record<
    "font-family" | "font-size" | "line-height" | "letter-spacing" | "word-spacing" | "text-align",
    string
  >
>;

type FontFaceRule = {
  fontFamily: string;
  srcHref?: string;
};

type TypographySample = {
  weight: number;
  properties: CssPropertyBag;
  fontFace?: FontFaceRule;
};

const BODY_SELECTOR_WEIGHTS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /^html\b/i, weight: 90 },
  { pattern: /^body\b/i, weight: 100 },
  { pattern: /^p\b/i, weight: 85 },
  { pattern: /^div\b/i, weight: 70 },
  { pattern: /^\.(?:body|text|content|chapter|main|book|page|story)\b/i, weight: 80 },
  { pattern: /^#(?:content|main|text|book|story)\b/i, weight: 82 },
  { pattern: /^(?:section|article)\b/i, weight: 65 },
];

const BASE_FONT_SIZE_PX = 16;

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitCssBlocks(css: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of css) {
    current += char;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        blocks.push(current.trim());
        current = "";
      }
    }
  }

  if (current.trim()) {
    blocks.push(current.trim());
  }

  return blocks;
}

function parseDeclarations(blockBody: string): CssPropertyBag {
  const properties: CssPropertyBag = {};

  for (const declaration of blockBody.split(";")) {
    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;

    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const value = declaration.slice(colonIndex + 1).trim();
    if (!value) continue;

    if (
      property === "font-family" ||
      property === "font-size" ||
      property === "line-height" ||
      property === "letter-spacing" ||
      property === "word-spacing" ||
      property === "text-align"
    ) {
      properties[property] = value;
    }
  }

  return properties;
}

function selectorWeight(selector: string): number {
  const trimmed = selector.trim();
  let weight = 0;

  for (const rule of BODY_SELECTOR_WEIGHTS) {
    if (rule.pattern.test(trimmed)) {
      weight = Math.max(weight, rule.weight);
    }
  }

  if (weight === 0 && /(?:^|[\s>+~])(?:p|div|span|body|html)\b/i.test(trimmed)) {
    weight = 50;
  }

  return weight;
}

function parseCssSamples(css: string, weightBoost = 0): TypographySample[] {
  const samples: TypographySample[] = [];

  for (const block of splitCssBlocks(stripCssComments(css))) {
    const openBrace = block.indexOf("{");
    if (openBrace === -1) continue;

    const selectorPart = block.slice(0, openBrace).trim();
    const body = block.slice(openBrace + 1, block.lastIndexOf("}"));

    if (selectorPart.startsWith("@font-face")) {
      const declarations = parseDeclarations(body);
      const fontFamily = declarations["font-family"]?.replace(/["']/g, "").trim();
      if (!fontFamily) continue;

      const srcMatch = body.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
      samples.push({
        weight: 120,
        properties: {},
        fontFace: {
          fontFamily,
          srcHref: srcMatch?.[1]?.trim(),
        },
      });
      continue;
    }

    if (selectorPart.startsWith("@")) continue;

    const selectors = selectorPart.split(",").map((part) => part.trim());
    const properties = parseDeclarations(body);
    if (Object.keys(properties).length === 0) continue;

    for (const selector of selectors) {
      const weight = selectorWeight(selector) + weightBoost;
      if (weight === 0) continue;
      samples.push({ weight, properties });
    }
  }

  return samples;
}

function parseInlineStyleSamples(html: string): TypographySample[] {
  const $ = cheerio.load(html, { xmlMode: false });
  const samples: TypographySample[] = [];

  const weightedSelectors: Array<{ selector: string; weight: number }> = [
    { selector: "body", weight: 110 },
    { selector: "html", weight: 100 },
    { selector: "p", weight: 95 },
    { selector: "div", weight: 75 },
    { selector: "section", weight: 70 },
    { selector: "article", weight: 70 },
  ];

  for (const { selector, weight } of weightedSelectors) {
    $(selector).each((_, element) => {
      const style = $(element).attr("style");
      if (!style) return;
      const properties = parseDeclarations(style);
      if (Object.keys(properties).length === 0) return;
      samples.push({ weight, properties });
    });
  }

  return samples;
}

function pickProperty(samples: TypographySample[], property: keyof CssPropertyBag): string | undefined {
  let best: { weight: number; value: string } | null = null;

  for (const sample of samples) {
    const value = sample.properties[property];
    if (!value) continue;
    if (!best || sample.weight > best.weight) {
      best = { weight: sample.weight, value };
    }
  }

  return best?.value;
}

function parseFontSizePx(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "inherit" || value === "initial" || value === "unset") return undefined;

  const match = value.match(/^(-?\d*\.?\d+)(px|pt|em|rem|%)?$/);
  if (!match) return undefined;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2] ?? "px";

  switch (unit) {
    case "px":
      return amount;
    case "pt":
      return amount * 1.333;
    case "em":
    case "rem":
      return amount * BASE_FONT_SIZE_PX;
    case "%":
      return (amount / 100) * BASE_FONT_SIZE_PX;
    default:
      return undefined;
  }
}

function parseLineHeight(raw: string | undefined, fontSizePx: number): number | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "normal" || value === "inherit" || value === "initial") return undefined;

  if (value.endsWith("%")) {
    return Number.parseFloat(value) / 100;
  }

  const match = value.match(/^(-?\d*\.?\d+)(px|em|rem)?$/);
  if (!match) return undefined;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2];

  if (!unit) {
    return amount;
  }

  if (unit === "px") {
    return amount / fontSizePx;
  }

  if (unit === "em" || unit === "rem") {
    return amount * (BASE_FONT_SIZE_PX / fontSizePx);
  }

  return undefined;
}

function parseSpacingPx(raw: string | undefined, fontSizePx: number): number | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "normal" || value === "inherit" || value === "initial") return 0;

  const match = value.match(/^(-?\d*\.?\d+)(px|em|rem)?$/);
  if (!match) return undefined;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2] ?? "px";

  if (unit === "px") return amount;
  if (unit === "em" || unit === "rem") return amount * fontSizePx;
  return undefined;
}

function parseTextAlign(raw: string | undefined): ReadingTextAlign | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "start") return "left";
  if (value === "end") return "right";
  if (value === "left" || value === "center" || value === "right" || value === "justify") {
    return value;
  }
  return undefined;
}

function resolveFontFaceHref(src: string | undefined, hrefBySavedName: Map<string, string>): string | undefined {
  if (!src) return undefined;

  const normalized = src.replace(/\\/g, "/").trim();
  const savedName = path.basename(normalized);

  return (
    hrefBySavedName.get(savedName) ??
    hrefBySavedName.get(normalized.replace(/\//g, "_")) ??
    undefined
  );
}

function fontFormatFromHref(href: string): string {
  const ext = href.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "woff2":
      return "woff2";
    case "woff":
      return "woff";
    case "otf":
      return "opentype";
    case "ttf":
      return "truetype";
    default:
      return "opentype";
  }
}

export function extractEpubTypography(input: {
  cssTexts: string[];
  htmlSamples?: string[];
  hrefBySavedName?: Map<string, string>;
}): ReadingTypographySettings {
  const samples: TypographySample[] = [];

  for (const css of input.cssTexts) {
    if (!css.trim()) continue;
    samples.push(...parseCssSamples(css));
  }

  for (const html of input.htmlSamples ?? []) {
    if (!html.trim()) continue;
    samples.push(...parseInlineStyleSamples(html));
  }

  const fontFamilyRaw = pickProperty(samples, "font-family");
  const fontSizeRaw = pickProperty(samples, "font-size");
  const lineHeightRaw = pickProperty(samples, "line-height");
  const letterSpacingRaw = pickProperty(samples, "letter-spacing");
  const wordSpacingRaw = pickProperty(samples, "word-spacing");
  const textAlignRaw = pickProperty(samples, "text-align");

  const fontSizePx = parseFontSizePx(fontSizeRaw) ?? DEFAULT_READING_TYPOGRAPHY.fontSize;
  const lineHeight =
    parseLineHeight(lineHeightRaw, fontSizePx) ?? DEFAULT_READING_TYPOGRAPHY.lineHeight;
  const letterSpacing =
    parseSpacingPx(letterSpacingRaw, fontSizePx) ?? DEFAULT_READING_TYPOGRAPHY.letterSpacing;
  const wordSpacing =
    parseSpacingPx(wordSpacingRaw, fontSizePx) ?? DEFAULT_READING_TYPOGRAPHY.wordSpacing;
  const textAlign = parseTextAlign(textAlignRaw) ?? DEFAULT_READING_TYPOGRAPHY.textAlign;

  let fontId = DEFAULT_READING_TYPOGRAPHY.fontId;
  let customFontFamily: string | undefined;
  let customFontAssetHref: string | undefined;

  const fontFaceSample = samples
    .filter((sample) => sample.fontFace)
    .sort((a, b) => b.weight - a.weight)[0];

  if (fontFaceSample?.fontFace) {
    customFontFamily = fontFaceSample.fontFace.fontFamily;
    customFontAssetHref = resolveFontFaceHref(
      fontFaceSample.fontFace.srcHref,
      input.hrefBySavedName ?? new Map(),
    );
  }

  const primaryFamily = fontFamilyRaw?.replace(/["']/g, "").split(",")[0]?.trim();
  if (
    primaryFamily &&
    customFontFamily &&
    primaryFamily.toLowerCase() === customFontFamily.toLowerCase()
  ) {
    fontId = matchReadingFontId(customFontFamily) ?? fontId;
  } else {
    fontId = matchReadingFontId(fontFamilyRaw) ?? DEFAULT_READING_TYPOGRAPHY.fontId;
  }

  if (fontFamilyRaw && !matchReadingFontId(fontFamilyRaw) && customFontFamily) {
    fontId = matchReadingFontId(customFontFamily) ?? fontId;
  }

  return normalizeReadingTypography({
    fontId,
    fontSize: fontSizePx,
    lineHeight,
    letterSpacing,
    wordSpacing,
    textAlign,
    customFontFamily,
    customFontAssetHref,
  });
}

export function buildEmbeddedFontFaceCss(
  typography: ReadingTypographySettings,
  bookId: string,
): string {
  if (!typography.customFontFamily || !typography.customFontAssetHref) {
    return "";
  }

  const family = typography.customFontFamily.replace(/"/g, "");
  const src = `/api/books/${bookId}/assets/by-href/${typography.customFontAssetHref
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const format = fontFormatFromHref(typography.customFontAssetHref);

  return `@font-face{font-family:"${family}";src:url("${src}") format("${format}");font-display:swap;}`;
}
