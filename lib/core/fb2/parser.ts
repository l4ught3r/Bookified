import * as cheerio from "cheerio";
import type { Fb2Chapter, Fb2Metadata, Fb2ParseResult, Fb2TocItem } from "./types";
import { extractFb2BinariesFromCheerio, resolveCoverBinaryIdFromCheerio } from "./image-extractor";
import {
  collectNestedToc,
  inlineNodesToPlainText,
  parseInlineNodes,
  parseTopLevelSection,
  sectionTitle,
} from "./section-parser";
import { decodeFb2Xml } from "./utils";

async function unwrapFb2Zip(buffer: Buffer): Promise<Buffer> {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(buffer);
  const fb2Entry = zip
    .getEntries()
    .find((entry) => !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".fb2"));
  if (!fb2Entry) {
    throw new Error("FB2 zip archive does not contain .fb2 file");
  }
  return fb2Entry.getData();
}

function parseMetadata($: cheerio.CheerioAPI): Fb2Metadata {
  const titleInfo = $("description > title-info").first();
  const publishInfo = $("description > publish-info").first();
  const documentInfo = $("description > document-info").first();
  const annotation = titleInfo.find("annotation").first();

  const authors = titleInfo
    .find("author")
    .map((_, author) => {
      const parts = [
        $(author).find("first-name").first().text().trim(),
        $(author).find("middle-name").first().text().trim(),
        $(author).find("last-name").first().text().trim(),
      ].filter(Boolean);
      return parts.join(" ") || $(author).find("nickname").first().text().trim() || "Unknown";
    })
    .get();

  return {
    title: titleInfo.find("book-title").first().text().trim() || "Без названия",
    authors,
    language: titleInfo.find("lang").first().text().trim() || "none",
    description: inlineNodesToPlainText(
      annotation.length ? parseInlineNodes($, annotation.get(0)!) : [],
    ).trim(),
    identifier: documentInfo.find("id").first().text().trim() || titleInfo.find("isbn").first().text().trim() || "",
    publisher: publishInfo.find("publisher").first().text().trim() || "",
    publishDate: publishInfo.find("year").first().text().trim() || "",
    coverBinaryId: resolveCoverBinaryIdFromCheerio($),
  };
}

function parseChapters($: cheerio.CheerioAPI): { chapters: Fb2Chapter[]; toc: Fb2TocItem[] } {
  const chapters: Fb2Chapter[] = [];
  const toc: Fb2TocItem[] = [];
  let order = 0;

  $("body").each((_, body) => {
    $(body)
      .children("section")
      .each((__, sectionEl) => {
        order += 1;
        const section = parseTopLevelSection($, sectionEl, order);
        const title = sectionTitle(section, `Глава ${order}`);

        chapters.push({
          order,
          href: `section-${order}`,
          title,
          section,
          level: 0,
        });

        toc.push({
          title,
          href: `section-${order}`,
          order,
          level: 0,
        });

        collectNestedToc(section, { value: order }, 0, toc);
      });
  });

  if (chapters.length === 0) {
    throw new Error("FB2 body contains no readable sections");
  }

  return { chapters, toc };
}

function validateSectionImages(
  section: Fb2Chapter["section"],
  binaryIds: Set<string>,
  errors: string[],
): void {
  for (const block of section.blocks) {
    if (block.kind === "image" && !binaryIds.has(block.binaryId)) {
      errors.push(`Missing binary for image: ${block.binaryId}`);
    }
    if (block.kind === "paragraph") {
      for (const node of block.nodes) {
        if (node.kind === "image" && !binaryIds.has(node.binaryId)) {
          errors.push(`Missing binary for inline image: ${node.binaryId}`);
        }
      }
    }
    if (block.kind === "epigraph" || block.kind === "cite") {
      validateSectionImages({ id: section.id, blocks: block.blocks }, binaryIds, errors);
    }
    if (block.kind === "section") {
      validateSectionImages(block.section, binaryIds, errors);
    }
  }
}

export async function parseFb2Buffer(buffer: Buffer): Promise<Fb2ParseResult> {
  const errors: string[] = [];
  let xmlBuffer = buffer;

  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    xmlBuffer = await unwrapFb2Zip(buffer);
  }

  const xml = decodeFb2Xml(xmlBuffer);
  const $ = cheerio.load(xml, { xml: true });

  if ($("FictionBook").length === 0) {
    throw new Error("Invalid FB2: missing FictionBook root element");
  }

  const metadata = parseMetadata($);
  const { chapters, toc } = parseChapters($);
  const { binaries, coverData, coverMediaType } = extractFb2BinariesFromCheerio($, metadata.coverBinaryId);

  if (!metadata.title || metadata.title === "Без названия") {
    errors.push("Missing book title in FB2 metadata");
  }

  const binaryIds = new Set(binaries.map((binary) => binary.id));
  for (const chapter of chapters) {
    validateSectionImages(chapter.section, binaryIds, errors);
  }

  return {
    metadata,
    chapters,
    toc,
    binaries,
    coverData,
    coverMediaType,
    errors,
  };
}

export { inlineNodesToPlainText, parseInlineNodes, sectionTitle };
