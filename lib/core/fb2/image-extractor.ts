import * as cheerio from "cheerio";
import type { Fb2Binary } from "./types";
import { getImageBinaryId, normalizeBinaryId } from "./section-parser";

export function resolveCoverBinaryIdFromCheerio($: cheerio.CheerioAPI): string | null {
  const image = $("description > title-info > coverpage > image").first().get(0);
  if (!image) return null;
  const binaryId = getImageBinaryId(image);
  return binaryId || null;
}

export function extractFb2BinariesFromCheerio(
  $: cheerio.CheerioAPI,
  coverBinaryId: string | null,
): { binaries: Fb2Binary[]; coverData: Buffer | null; coverMediaType: string } {
  const binaries: Fb2Binary[] = [];
  let coverData: Buffer | null = null;
  let coverMediaType = "image/jpeg";

  $("binary").each((_, element) => {
    const id = normalizeBinaryId(element.attribs?.id ?? "");
    const contentType = element.attribs?.["content-type"] || "image/jpeg";
    const base64Data = $(element).text().replace(/\s+/g, "");

    if (!id || !base64Data) return;

    try {
      const data = Buffer.from(base64Data, "base64");
      if (data.length === 0) return;

      if (id === coverBinaryId) {
        coverData = data;
        coverMediaType = contentType;
      }

      binaries.push({ id, contentType, data });
    } catch {
      // skip broken binary
    }
  });

  return { binaries, coverData, coverMediaType };
}
