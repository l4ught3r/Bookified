import * as cheerio from "cheerio";
import { and, eq } from "drizzle-orm";
import { selectRelevantChapterExcerpt } from "@/lib/ai/chapter-chunks";
import { downloadChapterContent } from "@/lib/books/chapter-storage";
import { db } from "@/lib/db";
import { chapters } from "@/lib/db/schema";
import type { BookWithLegacyId } from "@/lib/db/types";

export type AiChatLocale = "en" | "ru";

export type BookAiContext = {
  systemPrompt: string;
  chapterTitle?: string;
};

export type BuildBookAiContextOptions = {
  userQuery: string;
  selectedText?: string;
};

function stripHtmlToText(html: string): string {
  if (!html.trim()) {
    return "";
  }

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return $.text().replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function formatAuthors(authors: string[]): string {
  return authors.filter(Boolean).join(", ");
}

function buildSystemPrompt(params: {
  locale: AiChatLocale;
  book: BookWithLegacyId;
  chapterTitle?: string;
  chapterText?: string;
  chunkIndex?: number;
  totalChunks?: number;
  coverage?: "full" | "spread" | "partial";
  isPdf: boolean;
}): string {
  const { locale, book, chapterTitle, chapterText, chunkIndex, totalChunks, coverage, isPdf } =
    params;
  const title = book.title.trim() || (locale === "ru" ? "Без названия" : "Untitled");
  const authors = formatAuthors(book.authors);
  const authorLine = authors
    ? locale === "ru"
      ? `Автор(ы): ${authors}`
      : `Author(s): ${authors}`
    : "";

  const chapterLine = chapterTitle
    ? locale === "ru"
      ? `Текущая глава: ${chapterTitle}`
      : `Current chapter: ${chapterTitle}`
    : "";

  const baseRulesRu = [
    "Ты — AI-помощник для чтения книг в приложении Bookified.",
    "Отвечай на том же языке, на котором пользователь задаёт вопрос.",
    "Опирайся на контекст книги и фрагмента главы ниже. Не выдумывай цитаты и факты о тексте.",
    "Если информации недостаточно — честно скажи об этом.",
    "Будь полезным, ясным и кратким, если пользователь не просит развёрнутый ответ.",
    "Формат ответа: обычный текст, без Markdown. Не используй *, **, #, -, • и другую markdown-разметку.",
    "Для структуры и списков используй emoji в начале абзаца или пункта (например 📖 🧙 ✨ 🔍), а не звёздочки и маркеры.",
  ];

  const baseRulesEn = [
    "You are an AI reading assistant in the Bookified app.",
    "Reply in the same language the user writes in.",
    "Ground answers in the book and chapter excerpt below. Do not invent quotes or plot details.",
    "If you lack information, say so clearly.",
    "Be helpful, clear, and concise unless the user asks for a longer answer.",
    "Response format: plain text only, no Markdown. Do not use *, **, #, -, •, or other markdown markup.",
    "Use emojis at the start of paragraphs or list items for structure (e.g. 📖 🧙 ✨ 🔍), not asterisks or bullet markers.",
  ];

  const rules = locale === "ru" ? baseRulesRu : baseRulesEn;
  const header = locale === "ru" ? "Контекст книги" : "Book context";
  const lines = [
    ...rules,
    "",
    header + ":",
    locale === "ru" ? `Название: ${title}` : `Title: ${title}`,
  ];

  if (authorLine) {
    lines.push(authorLine);
  }

  if (chapterLine) {
    lines.push(chapterLine);
  }

  if (isPdf) {
    lines.push(
      "",
      locale === "ru"
        ? "Формат PDF: полный текст главы недоступен. Используй метаданные книги и фрагменты из сообщений пользователя."
        : "PDF format: full chapter text is unavailable. Use book metadata and excerpts from the user's messages.",
    );
  } else if (chapterText?.trim()) {
    if (coverage === "full") {
      lines.push(
        "",
        locale === "ru" ? "Текст текущей главы (полностью):" : "Current chapter text (full):",
      );
    } else if (coverage === "spread") {
      lines.push(
        "",
        locale === "ru"
          ? "Выдержки из главы (начало, середина и конец; полный текст не передан):"
          : "Chapter excerpts (beginning, middle, and end; full chapter text not included):",
      );
    } else if (totalChunks && totalChunks > 1 && chunkIndex) {
      lines.push(
        "",
        locale === "ru"
          ? `Релевантный фрагмент главы (${chunkIndex} из ${totalChunks}):`
          : `Relevant chapter excerpt (${chunkIndex} of ${totalChunks}):`,
      );
    } else {
      lines.push(
        "",
        locale === "ru"
          ? "Фрагмент текущей главы (не весь текст):"
          : "Current chapter excerpt (not the full chapter):",
      );
    }

    lines.push(chapterText.trim());
  } else if (chapterTitle) {
    lines.push(
      "",
      locale === "ru"
        ? "Текст главы недоступен — отвечай по общим знаниям и вопросу пользователя."
        : "Chapter text is unavailable — answer from general knowledge and the user's question.",
    );
  }

  return lines.join("\n");
}

export async function buildBookAiContext(
  book: BookWithLegacyId,
  chapterOrder: number | undefined,
  locale: AiChatLocale,
  options: BuildBookAiContextOptions,
): Promise<BookAiContext> {
  const isPdf = book.format === "pdf";
  const { userQuery, selectedText } = options;

  if (isPdf || chapterOrder == null || chapterOrder <= 0) {
    return {
      systemPrompt: buildSystemPrompt({
        locale,
        book,
        isPdf,
      }),
    };
  }

  const [chapterRow] = await db
    .select({
      title: chapters.title,
      storagePath: chapters.storagePath,
    })
    .from(chapters)
    .where(and(eq(chapters.bookId, book.id), eq(chapters.order, chapterOrder)))
    .limit(1);

  if (!chapterRow) {
    return {
      systemPrompt: buildSystemPrompt({
        locale,
        book,
        isPdf: false,
      }),
    };
  }

  let chapterText = "";

  try {
    const stored = await downloadChapterContent(chapterRow.storagePath);
    const rawText = stored.text?.trim() || stripHtmlToText(stored.html);
    const excerpt = selectRelevantChapterExcerpt(rawText, userQuery, selectedText);

    return {
      chapterTitle: chapterRow.title || undefined,
      systemPrompt: buildSystemPrompt({
        locale,
        book,
        chapterTitle: chapterRow.title || undefined,
        chapterText: excerpt.excerpt,
        chunkIndex: excerpt.chunkIndex,
        totalChunks: excerpt.totalChunks,
        coverage: excerpt.coverage,
        isPdf: false,
      }),
    };
  } catch {
    chapterText = "";
  }

  return {
    chapterTitle: chapterRow.title || undefined,
    systemPrompt: buildSystemPrompt({
      locale,
      book,
      chapterTitle: chapterRow.title || undefined,
      chapterText,
      isPdf: false,
    }),
  };
}
