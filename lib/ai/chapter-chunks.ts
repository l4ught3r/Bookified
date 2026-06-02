export const CHUNK_TARGET_WORDS = 2500;
/** Chapters at or below this word count are sent in full (no excerpt trimming). */
export const SMALL_CHAPTER_FULL_WORDS = 2500;
export const OVERLAP_WORDS = 200;

export const DEFAULT_EXCERPT_WORDS = 1200;
export const SUMMARY_EXCERPT_BUDGET = 2000;
export const SUMMARY_PART_WORDS = 500;
export const ENDING_EXCERPT_WORDS = 800;
export const LOCAL_EXCERPT_WORDS = 1200;

/** @deprecated Use intent-specific limits; kept for any external imports */
export const MAX_EXCERPT_WORDS = DEFAULT_EXCERPT_WORDS;
export const SMALL_CHAPTER_WORDS = SMALL_CHAPTER_FULL_WORDS;
export const GENERAL_INTENT_HEAD_WORDS = SUMMARY_PART_WORDS;
export const GENERAL_INTENT_TAIL_WORDS = SUMMARY_PART_WORDS;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "not",
  "no",
  "yes",
  "if",
  "then",
  "than",
  "so",
  "very",
  "just",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "once",
  "и",
  "в",
  "во",
  "не",
  "что",
  "он",
  "она",
  "они",
  "мы",
  "вы",
  "я",
  "ты",
  "это",
  "как",
  "а",
  "то",
  "все",
  "всё",
  "вся",
  "весь",
  "оно",
  "так",
  "его",
  "но",
  "да",
  "к",
  "у",
  "же",
  "за",
  "бы",
  "по",
  "только",
  "ее",
  "её",
  "ему",
  "них",
  "ли",
  "быть",
  "был",
  "была",
  "были",
  "будет",
  "есть",
  "нет",
  "или",
  "если",
  "уже",
  "для",
  "при",
  "из",
  "от",
  "до",
  "над",
  "под",
  "о",
  "об",
  "про",
  "чтобы",
  "когда",
  "где",
  "кто",
  "чем",
  "чего",
  "кого",
  "кому",
  "чему",
  "этот",
  "этого",
  "этой",
  "эти",
  "тот",
  "того",
  "той",
  "те",
  "такой",
  "такая",
  "такие",
  "который",
  "которая",
  "которые",
]);

const SUMMARY_INTENT_PATTERN =
  /(?:summary|summarize|recap|retell|outline|character|context|analysis|analyze|explain the context|historical|cultural|кратк|содержан|пересказ|перескаж|изложи|изложение|анализ|персонаж|контекст|историческ|культурн|о\s+ч[её]м\s+глава)/i;

const ENDING_INTENT_PATTERN =
  /(?:last\s+line|final\s+line|end\s+of\s+(?:the\s+)?chapter|how\s+does\s+(?:the\s+)?chapter\s+end|последн\w*\s+(?:строчк|строк|абзац|предложени)|конец\s+главы|чем\s+заканчивается|как\s+заканчивается|финал\s+главы)/i;

export type ChapterQueryIntent = "summary" | "ending" | "default";

export type ChapterExcerpt = {
  excerpt: string;
  chunkIndex: number;
  totalChunks: number;
  coverage: "full" | "spread" | "partial";
};

export function detectChapterQueryIntent(query: string): ChapterQueryIntent {
  const trimmed = query.trim();
  if (!trimmed) {
    return "default";
  }

  if (ENDING_INTENT_PATTERN.test(trimmed)) {
    return "ending";
  }

  if (SUMMARY_INTENT_PATTERN.test(trimmed)) {
    return "summary";
  }

  return "default";
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function takeFirstWords(text: string, wordCount: number): string {
  if (wordCount <= 0 || !text.trim()) {
    return "";
  }

  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) {
    return text.trim();
  }

  return words.slice(0, wordCount).join(" ");
}

function takeLastWords(text: string, wordCount: number): string {
  if (wordCount <= 0 || !text.trim()) {
    return "";
  }

  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) {
    return text.trim();
  }

  return words.slice(words.length - wordCount).join(" ");
}

function takeMiddleWords(text: string, wordCount: number): string {
  if (wordCount <= 0 || !text.trim()) {
    return "";
  }

  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) {
    return text.trim();
  }

  const start = Math.floor((words.length - wordCount) / 2);
  return words.slice(start, start + wordCount).join(" ");
}

export function tokenizeForSearch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function splitChapterIntoChunks(
  text: string,
  targetWords: number = CHUNK_TARGET_WORDS,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  if (countWords(normalized) <= targetWords) {
    return [normalized];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    const paragraphWords = countWords(paragraph);
    const currentWords = countWords(current);

    if (paragraphWords > targetWords) {
      flush();
      const words = paragraph.split(/\s+/);
      for (let index = 0; index < words.length; index += targetWords) {
        chunks.push(words.slice(index, index + targetWords).join(" "));
      }
      continue;
    }

    if (currentWords > 0 && currentWords + paragraphWords > targetWords) {
      flush();
    }

    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  flush();
  return chunks.length > 0 ? chunks : [normalized];
}

export function rankChunks(
  chunks: string[],
  query: string,
  selectedText?: string,
): { index: number; score: number }[] {
  const queryTokens = tokenizeForSearch(query);
  const selectedTokens = selectedText ? tokenizeForSearch(selectedText) : [];
  const normalizedSelected = selectedText?.trim().toLowerCase() ?? "";
  const summaryIntent = detectChapterQueryIntent(query) === "summary";

  return chunks
    .map((chunk, index) => {
      const chunkLower = chunk.toLowerCase();
      let score = 0;

      for (const token of queryTokens) {
        if (chunkLower.includes(token)) {
          score += 1;
        }
      }

      for (const token of selectedTokens) {
        if (chunkLower.includes(token)) {
          score += 2;
        }
      }

      if (normalizedSelected && chunkLower.includes(normalizedSelected)) {
        score += 100;
      }

      if (summaryIntent) {
        const middle = (chunks.length - 1) / 2;
        score += Math.max(0, 3 - Math.abs(index - middle));
      }

      return { index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);
}

function truncateToWords(text: string, maxWords: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxWords <= 0) {
    return "";
  }

  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) {
    return trimmed;
  }

  return words.slice(0, maxWords).join(" ");
}

function buildSummarySpreadExcerpt(fullText: string): string {
  const normalized = fullText.trim();
  const head = takeFirstWords(normalized, SUMMARY_PART_WORDS);
  const middle = takeMiddleWords(normalized, SUMMARY_PART_WORDS);
  const tail = takeLastWords(normalized, SUMMARY_PART_WORDS);

  const combined = `${head}\n\n[…]\n\n${middle}\n\n[…]\n\n${tail}`;
  return truncateToWords(combined, SUMMARY_EXCERPT_BUDGET);
}

function extractWindowAroundSelection(chunk: string, selectedText: string, maxWords: number): string {
  const needle = selectedText.trim();
  if (!needle) {
    return truncateToWords(chunk, maxWords);
  }

  const lowerChunk = chunk.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let index = lowerChunk.indexOf(lowerNeedle);

  if (index < 0 && lowerNeedle.length > 80) {
    index = lowerChunk.indexOf(lowerNeedle.slice(0, 80));
  }

  if (index < 0) {
    return truncateToWords(chunk, maxWords);
  }

  const before = chunk.slice(0, index);
  const fromMatch = chunk.slice(index);
  const half = Math.floor(maxWords / 2);

  const excerpt = `${takeLastWords(before, half)}\n\n${takeFirstWords(fromMatch, maxWords - half)}`.trim();
  return truncateToWords(excerpt, maxWords);
}

function buildLocalExcerpt(
  normalized: string,
  chunks: string[],
  selectedText: string,
): ChapterExcerpt {
  const ranked = rankChunks(chunks, "", selectedText);
  const bestIndex = ranked[0]?.index ?? 0;
  const bestChunk = chunks[bestIndex] ?? chunks[0] ?? normalized;

  return {
    excerpt: extractWindowAroundSelection(bestChunk, selectedText, LOCAL_EXCERPT_WORDS),
    chunkIndex: bestIndex + 1,
    totalChunks: chunks.length,
    coverage: "partial",
  };
}

export function selectRelevantChapterExcerpt(
  fullText: string,
  query: string,
  selectedText?: string,
): ChapterExcerpt {
  const normalized = fullText.trim();
  if (!normalized) {
    return { excerpt: "", chunkIndex: 0, totalChunks: 0, coverage: "partial" };
  }

  const totalWords = countWords(normalized);
  const intent = detectChapterQueryIntent(query);
  const selection = selectedText?.trim() ?? "";
  const chunks = splitChapterIntoChunks(normalized);
  const totalChunks = chunks.length;

  if (totalWords <= SMALL_CHAPTER_FULL_WORDS) {
    return {
      excerpt: normalized,
      chunkIndex: 0,
      totalChunks: 1,
      coverage: "full",
    };
  }

  if (intent === "summary") {
    return {
      excerpt: buildSummarySpreadExcerpt(normalized),
      chunkIndex: 0,
      totalChunks,
      coverage: "spread",
    };
  }

  if (intent === "ending") {
    return {
      excerpt: takeLastWords(normalized, ENDING_EXCERPT_WORDS),
      chunkIndex: totalChunks,
      totalChunks,
      coverage: "partial",
    };
  }

  if (selection) {
    if (totalChunks <= 1) {
      return {
        excerpt: extractWindowAroundSelection(normalized, selection, LOCAL_EXCERPT_WORDS),
        chunkIndex: 1,
        totalChunks: 1,
        coverage: "partial",
      };
    }

    return buildLocalExcerpt(normalized, chunks, selection);
  }

  if (totalChunks <= 1) {
    return {
      excerpt: truncateToWords(chunks[0] ?? normalized, DEFAULT_EXCERPT_WORDS),
      chunkIndex: 0,
      totalChunks: 1,
      coverage: "partial",
    };
  }

  const ranked = rankChunks(chunks, query, selectedText);
  const bestIndex = ranked[0]?.index ?? 0;
  const bestChunk = chunks[bestIndex] ?? chunks[0] ?? normalized;
  const previousOverlap =
    bestIndex > 0 ? takeLastWords(chunks[bestIndex - 1] ?? "", OVERLAP_WORDS) : "";

  const excerpt = previousOverlap
    ? `${previousOverlap}\n\n[…]\n\n${bestChunk}`
    : bestChunk;

  return {
    excerpt: truncateToWords(excerpt, DEFAULT_EXCERPT_WORDS),
    chunkIndex: bestIndex + 1,
    totalChunks,
    coverage: "partial",
  };
}

/** @deprecated Use detectChapterQueryIntent instead */
export function isGeneralIntentQuery(query: string): boolean {
  return detectChapterQueryIntent(query) === "summary";
}
