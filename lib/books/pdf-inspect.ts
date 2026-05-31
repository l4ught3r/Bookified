import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfInspectResult = {
  title: string;
  authors: string[];
  description: string;
  numPages: number;
  coverData: Buffer | null;
  coverMediaType: "image/jpeg";
};

let workerReady = false;

function ensurePdfWorker() {
  if (workerReady) return;

  const rootRequire = createRequire(path.join(process.cwd(), "package.json"));
  const pdfjsRoot = path.dirname(rootRequire.resolve("pdfjs-dist/package.json"));
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(pdfjsRoot, "legacy/build/pdf.worker.mjs"),
  ).href;
  workerReady = true;
}

function cleanMeta(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function loadPdfParse(): (buffer: Buffer) => Promise<{ numpages: number; info?: { Title?: string; Author?: string; Subject?: string } }> {
  const rootRequire = createRequire(path.join(process.cwd(), "package.json"));
  return rootRequire("pdf-parse");
}

export async function inspectPdf(buffer: Buffer): Promise<PdfInspectResult> {
  ensurePdfWorker();

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  try {
    const numPages = doc.numPages;
    if (numPages < 1) {
      throw new Error("PDF не содержит страниц");
    }

    const metadata = await doc.getMetadata();
    const info = metadata.info as Record<string, unknown> | undefined;

    let title = cleanMeta(info?.Title);
    let author = cleanMeta(info?.Author);
    let description = cleanMeta(info?.Subject);

    if (!title || !author) {
      try {
        const pdfParse = loadPdfParse();
        const parsed = await pdfParse(buffer);
        title = title || cleanMeta(parsed.info?.Title);
        author = author || cleanMeta(parsed.info?.Author);
        description = description || cleanMeta(parsed.info?.Subject);
      } catch {
        // metadata fallback is optional
      }
    }

    let coverData: Buffer | null = null;

    try {
      const rootRequire = createRequire(path.join(process.cwd(), "package.json"));
      const { createCanvas } = rootRequire("@napi-rs/canvas") as {
        createCanvas: (width: number, height: number) => {
          getContext: (type: "2d") => CanvasRenderingContext2D;
          toBuffer: (mime: string, opts?: { quality?: number }) => Buffer;
        };
      };

      const page = await doc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1, 640 / baseViewport.width);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");

      await page.render({ canvasContext: ctx, viewport }).promise;
      coverData = canvas.toBuffer("image/jpeg", { quality: 0.85 });
      page.cleanup();
    } catch {
      // cover is optional
    }

    return {
      title,
      authors: author ? [author] : [],
      description,
      numPages,
      coverData,
      coverMediaType: "image/jpeg",
    };
  } finally {
    await doc.destroy();
  }
}
