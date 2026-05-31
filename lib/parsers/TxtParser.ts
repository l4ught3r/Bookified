// src/lib/parsers/TxtParser.ts
import { countWords } from "../sanitize";
import { BaseParser, ParsedBook, ParsedChapter } from "./BaseParser";

export class TxtParser extends BaseParser {
  async parse(): Promise<ParsedBook> {
    const text = this.buffer.toString("utf-8");

    // Разбиваем на главы по паттернам
    const chapters = this.splitIntoChapters(text);

    return {
      title: this.guessTitle(text),
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
        href: `chapter-${ch.order}`,
        order: ch.order,
        level: 0,
      })),
      coverData: null,
      coverMediaType: "image/jpeg",
    };
  }

  private splitIntoChapters(text: string): ParsedChapter[] {
    const combinedPattern = /^((?:Глава|Chapter|ГЛАВА|Часть|Part)\s+\d+[^\n]*)/gim;
    const matches = [...text.matchAll(combinedPattern)];

    if (matches.length >= 2) {
      return this.splitByMatches(text, matches);
    }

    // Если глав не найдено — разбиваем по двойным переносам строк, ~3000 слов на секцию
    return this.splitBySize(text, 3000);
  }

  private splitByMatches(text: string, matches: RegExpMatchArray[]): ParsedChapter[] {
    const chapters: ParsedChapter[] = [];

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const chapterText = text.slice(start, end).trim();
      const title = matches[i][1].trim();

      const html = this.textToHtml(chapterText);
      const plainText = chapterText;
      const wordCount = countWords(plainText);

      chapters.push({
        order: i + 1,
        title,
        href: `chapter-${i + 1}`,
        html,
        text: plainText,
        wordCount,
      });
    }

    // Если есть текст до первой главы
    if (matches[0].index! > 0) {
      const preface = text.slice(0, matches[0].index!).trim();
      if (preface.length > 100) {
        chapters.unshift({
          order: 0,
          title: "Предисловие",
          href: "chapter-0",
          html: this.textToHtml(preface),
          text: preface,
          wordCount: countWords(preface),
        });
        // Перенумеруем
        chapters.forEach((ch, i) => (ch.order = i + 1));
      }
    }

    return chapters;
  }

  private splitBySize(text: string, wordsPerChapter: number): ParsedChapter[] {
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
    const chapters: ParsedChapter[] = [];
    let currentParagraphs: string[] = [];
    let currentWordCount = 0;
    let chapterOrder = 0;

    for (const para of paragraphs) {
      const paraWords = countWords(para);
      currentParagraphs.push(para);
      currentWordCount += paraWords;

      if (currentWordCount >= wordsPerChapter) {
        chapterOrder++;
        const chapterText = currentParagraphs.join("\n\n");
        chapters.push({
          order: chapterOrder,
          title: `Секция ${chapterOrder}`,
          href: `chapter-${chapterOrder}`,
          html: this.textToHtml(chapterText),
          text: chapterText,
          wordCount: currentWordCount,
        });
        currentParagraphs = [];
        currentWordCount = 0;
      }
    }

    // Остаток
    if (currentParagraphs.length > 0) {
      chapterOrder++;
      const chapterText = currentParagraphs.join("\n\n");
      chapters.push({
        order: chapterOrder,
        title: `Секция ${chapterOrder}`,
        href: `chapter-${chapterOrder}`,
        html: this.textToHtml(chapterText),
        text: chapterText,
        wordCount: currentWordCount,
      });
    }

    if (chapters.length === 0) {
      chapters.push({
        order: 1,
        title: "Текст",
        href: "chapter-1",
        html: this.textToHtml(text),
        text,
        wordCount: countWords(text),
      });
    }

    return chapters;
  }

  private textToHtml(text: string): string {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const paragraphs = escaped.split(/\n\s*\n/);
    return paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n");
  }

  private guessTitle(text: string): string {
    const firstLine = text.trim().split("\n")[0]?.trim();
    if (firstLine && firstLine.length < 100) {
      return firstLine;
    }
    return "Без названия";
  }
}
