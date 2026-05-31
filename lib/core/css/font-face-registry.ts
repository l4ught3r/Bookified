import type { FontFaceDeclaration } from "../typography/types";

const FONT_FACE_BLOCK = /@font-face\s*\{([\s\S]*?)\}/gi;

function readDeclaration(block: string, property: string): string | undefined {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim();
}

function readSrcUrls(block: string): string[] {
  const src = readDeclaration(block, "src");
  if (!src) return [];
  const urls: string[] = [];
  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(src))) {
    urls.push(match[2].trim());
  }
  return urls;
}

export function extractFontFaceDeclarations(cssTexts: string[]): FontFaceDeclaration[] {
  const declarations: FontFaceDeclaration[] = [];

  for (const css of cssTexts) {
    let match: RegExpExecArray | null;
    FONT_FACE_BLOCK.lastIndex = 0;
    while ((match = FONT_FACE_BLOCK.exec(css))) {
      const block = match[1];
      const fontFamily = readDeclaration(block, "font-family")?.replace(/['"]/g, "");
      if (!fontFamily) continue;

      declarations.push({
        fontFamily,
        src: readSrcUrls(block),
        fontWeight: readDeclaration(block, "font-weight"),
        fontStyle: readDeclaration(block, "font-style"),
        fontDisplay: readDeclaration(block, "font-display"),
      });
    }
  }

  return declarations;
}
