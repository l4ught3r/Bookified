import { countWords, extractPlainText, sanitizeBookHtml } from "../sanitize";
import { collectReferencedAssetHrefs } from "../books/collect-referenced-asset-hrefs";
import { extractFb2Typography } from "../core/pipeline/fb2-typography-pipeline";import { renderFb2ChapterHtml } from "../core/fb2/html-renderer";
import { BaseParser, ParsedAsset, ParsedBook, ParsedChapter } from "./BaseParser";

export class Fb2Parser extends BaseParser {
  async parse(): Promise<ParsedBook> {
    const { parsed, readingSettings } = await extractFb2Typography(this.buffer, this.bookId);

    const chapters: ParsedChapter[] = parsed.chapters.map((chapter) => {
      const html = sanitizeBookHtml(renderFb2ChapterHtml(chapter, this.bookId), this.bookId);
      const text = extractPlainText(html);

      return {
        order: chapter.order,
        title: chapter.title,
        href: chapter.href,
        html,
        text,
        wordCount: countWords(text),
      };
    });

    const referencedAssetHrefs = collectReferencedAssetHrefs(chapters, this.bookId, readingSettings);

    const assets: ParsedAsset[] = parsed.binaries
      .filter((binary) => referencedAssetHrefs.has(binary.id))
      .map((binary) => ({
        href: binary.id,
        mediaType: binary.contentType,
        kind: binary.id === parsed.metadata.coverBinaryId ? "cover" : "image",
        data: binary.data,
      }));
    return {
      title: parsed.metadata.title,
      authors: parsed.metadata.authors,
      language: parsed.metadata.language,
      description: parsed.metadata.description,
      identifier: parsed.metadata.identifier,
      publisher: parsed.metadata.publisher,
      publishDate: parsed.metadata.publishDate,
      chapters,
      assets,
      toc: parsed.toc,
      coverData: parsed.coverData,
      coverMediaType: parsed.coverMediaType,
      typography: readingSettings,
    };
  }
}
