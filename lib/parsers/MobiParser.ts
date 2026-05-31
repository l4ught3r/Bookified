// src/lib/parsers/MobiParser.ts
import { countWords, extractPlainText, sanitizeBookHtml } from "../sanitize";
import { BaseParser, ParsedBook, ParsedChapter } from "./BaseParser";

type MobiRecord = { offset: number; length: number };

type MobiHeader = {
  title: string;
  compression: number;
  textLength: number;
  textRecordCount: number;
  recordSize: number;
  records: MobiRecord[];
};

/**
 * Упрощённый MOBI парсер.
 * MOBI — проприетарный формат Amazon. Полноценный парсинг сложен.
 * Для MVP: извлекаем PalmDoc/Huffman текст из MOBI header.
 * Для продакшена лучше конвертировать MOBI → EPUB через Calibre CLI.
 */
export class MobiParser extends BaseParser {
  async parse(): Promise<ParsedBook> {
    // Читаем MOBI header
    const header = this.parseMobiHeader();

    // Извлекаем записи текста
    const textRecords = this.extractTextRecords(header);
    const fullText = textRecords.join("");

    // Пробуем определить — это HTML или plain text
    const isHtml =
      fullText.includes("<html") || fullText.includes("<body") || fullText.includes("<p>");

    let chapters: ParsedChapter[];

    if (isHtml) {
      chapters = this.parseHtmlContent(fullText);
    } else {
      chapters = this.parsePlainContent(fullText);
    }

    return {
      title: header.title || "Без названия",
      authors: [],
      language: "none",
      description: "",
      identifier: "",
      publisher: "",
      publishDate: "",
      chapters,
      assets: [],
      toc: chapters.map((ch) => ({
        title: ch.title,
        href: `section-${ch.order}`,
        order: ch.order,
        level: 0,
      })),
      coverData: null,
      coverMediaType: "image/jpeg",
    };
  }

  private parseMobiHeader(): MobiHeader {
    const buf = this.buffer;

    // PDB Header
    const title = buf.slice(0, 32).toString("latin1").replace(/\0+$/, "").trim();
    const numRecords = buf.readUInt16BE(76);

    // Record offsets
    const records: MobiRecord[] = [];
    for (let i = 0; i < numRecords; i++) {
      const recordOffset = 78 + i * 8;
      const offset = buf.readUInt32BE(recordOffset);
      records.push({ offset, length: 0 });
    }

    // Вычисляем длины
    for (let i = 0; i < records.length - 1; i++) {
      records[i].length = records[i + 1].offset - records[i].offset;
    }
    if (records.length > 0) {
      records[records.length - 1].length = buf.length - records[records.length - 1].offset;
    }

    // PalmDOC Header (Record 0)
    const rec0Offset = records[0]?.offset || 0;
    const compression = buf.readUInt16BE(rec0Offset);
    const textLength = buf.readUInt32BE(rec0Offset + 4);
    const recordCount = buf.readUInt16BE(rec0Offset + 8);
    const recordSize = buf.readUInt16BE(rec0Offset + 10);

    return {
      title,
      compression,
      textLength,
      textRecordCount: recordCount,
      recordSize,
      records,
    };
  }

  private extractTextRecords(header: MobiHeader): string[] {
    const texts: string[] = [];
    const buf = this.buffer;

    for (let i = 1; i <= header.textRecordCount && i < header.records.length; i++) {
      const record = header.records[i];
      const rawData = buf.slice(record.offset, record.offset + record.length);
      const data =
        header.compression === 2 ? this.decompressPalmDoc(rawData) : rawData;

      texts.push(data.toString("utf-8"));
    }

    return texts;
  }

  private decompressPalmDoc(data: Buffer): Buffer {
    const output: number[] = [];
    let i = 0;

    while (i < data.length) {
      const byte = data[i++];

      if (byte === 0) {
        output.push(0);
      } else if (byte >= 1 && byte <= 8) {
        for (let j = 0; j < byte && i < data.length; j++) {
          output.push(data[i++]);
        }
      } else if (byte >= 0x80) {
        if (i >= data.length) break;
        const next = data[i++];
        const distance = (((byte << 8) | next) >> 3) & 0x7ff;
        const length = (next & 0x07) + 3;

        for (let j = 0; j < length; j++) {
          const pos = output.length - distance;
          if (pos >= 0 && pos < output.length) {
            output.push(output[pos]);
          }
        }
      } else if (byte >= 0x09 && byte <= 0x7f) {
        output.push(byte);
      } else {
        // 0xc0-0xff: space + char
        output.push(0x20);
        output.push(byte ^ 0x80);
      }
    }

    return Buffer.from(output) as Buffer;
  }

  private parseHtmlContent(html: string): ParsedChapter[] {
    // Разбиваем HTML по тегам <mbp:pagebreak/>, <hr>, или <h1>...<h3>
    const parts = html.split(/<mbp:pagebreak\s*\/?>/i);

    if (parts.length <= 1) {
      // Пробуем по заголовкам
      return this.splitHtmlByHeadings(html);
    }

    return parts
      .filter((p) => p.trim())
      .map((part, i) => {
        const cleaned = sanitizeBookHtml(part, this.bookId);
        const text = extractPlainText(cleaned);
        return {
          order: i + 1,
          title: `Секция ${i + 1}`,
          href: `section-${i + 1}`,
          html: cleaned,
          text,
          wordCount: countWords(text),
        };
      });
  }

  private splitHtmlByHeadings(html: string): ParsedChapter[] {
    const parts = html.split(/(?=<h[1-3][^>]*>)/i).filter((p) => p.trim());

    if (parts.length <= 1) {
      const cleaned = sanitizeBookHtml(html, this.bookId);
      const text = extractPlainText(cleaned);
      return [
        {
          order: 1,
          title: "Текст",
          href: "section-1",
          html: cleaned,
          text,
          wordCount: countWords(text),
        },
      ];
    }

    return parts.map((part, i) => {
      const cleaned = sanitizeBookHtml(part, this.bookId);
      const text = extractPlainText(cleaned);
      const titleMatch = part.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
      return {
        order: i + 1,
        title: titleMatch ? extractPlainText(titleMatch[1]) : `Секция ${i + 1}`,
        href: `section-${i + 1}`,
        html: cleaned,
        text,
        wordCount: countWords(text),
      };
    });
  }

  private parsePlainContent(text: string): ParsedChapter[] {
    const wordsPerChapter = 3000;
    const words = text.split(/\s+/).filter(Boolean);
    const chapters: ParsedChapter[] = [];

    for (let i = 0, order = 1; i < words.length; i += wordsPerChapter, order++) {
      const chunk = words.slice(i, i + wordsPerChapter).join(" ");
      const html = `<p>${chunk.replace(/\n\s*\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;
      chapters.push({
        order,
        title: `Секция ${order}`,
        href: `section-${order}`,
        html,
        text: chunk,
        wordCount: Math.min(wordsPerChapter, words.length - i),
      });
    }

    if (chapters.length === 0) {
      chapters.push({
        order: 1,
        title: "Текст",
        href: "section-1",
        html: `<p>${text}</p>`,
        text,
        wordCount: countWords(text),
      });
    }

    return chapters;
  }
}
