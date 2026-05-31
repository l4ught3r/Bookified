export const CHUNK_TARGET_WORDS = 2500;
export const SMALL_CHAPTER_WORDS = 3000;
export const OVERLAP_WORDS = 200;
export const MAX_EXCERPT_WORDS = 600;
export const GENERAL_INTENT_HEAD_WORDS = 300;
export const GENERAL_INTENT_TAIL_WORDS = 300;

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
  "она",
  "оно",
  "так",
  "его",
  "но",
  "да",
  "ты",
  "к",
  "у",
  "же",
  "вы",
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

const COMPLEX_INTENT_PATTERN =
  /(?:summary|summarize|character|context|analysis|analyze|explain the context|historical|cultural|кратк|содержан|анализ|персонаж|контекст|историческ|культурн)/i;

export type ChapterExcerpt = {
  excerpt: string;
  chunkIndex: number;
  totalChunks: number;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
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

function isGeneralIntentQuery(query: string): boolean {
  return COMPLEX_INTENT_PATTERN.test(query);
}

export function rankChunks(
  chunks: string[],
  query: string,
  selectedText?: string,
): { index: number; score: number }[] {
  const queryTokens = tokenizeForSearch(query);
  const selectedTokens = selectedText ? tokenizeForSearch(selectedText) : [];
  const normalizedSelected = selectedText?.trim().toLowerCase() ?? "";
  const generalIntent = isGeneralIntentQuery(query);

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

      if (generalIntent) {
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

function buildGeneralIntentExcerpt(fullText: string): string {
  const normalized = fullText.trim();
  const words = normalized.split(/\s+/);

  if (words.length <= MAX_EXCERPT_WORDS) {
    return normalized;
  }

  const head = words.slice(0, GENERAL_INTENT_HEAD_WORDS).join(" ");
  const tail = words.slice(-GENERAL_INTENT_TAIL_WORDS).join(" ");

  if (words.length <= GENERAL_INTENT_HEAD_WORDS + GENERAL_INTENT_TAIL_WORDS) {
    return normalized;
  }

  return `${head}\n\n[…]\n\n${tail}`;
}

export function selectRelevantChapterExcerpt(
  fullText: string,
  query: string,
  selectedText?: string,
): ChapterExcerpt {
  const normalized = fullText.trim();
  if (!normalized) {
    return { excerpt: "", chunkIndex: 0, totalChunks: 0 };
  }

  const totalWords = countWords(normalized);
  const generalIntent = isGeneralIntentQuery(query);

  if (generalIntent && totalWords > SMALL_CHAPTER_WORDS) {
    const chunks = splitChapterIntoChunks(normalized);
    return {
      excerpt: truncateToWords(buildGeneralIntentExcerpt(normalized), MAX_EXCERPT_WORDS),
      chunkIndex: 0,
      totalChunks: chunks.length,
    };
  }

  if (totalWords <= SMALL_CHAPTER_WORDS) {
    return {
      excerpt: truncateToWords(normalized, MAX_EXCERPT_WORDS),
      chunkIndex: 0,
      totalChunks: 1,
    };
  }

  const chunks = splitChapterIntoChunks(normalized);
  if (chunks.length <= 1) {
    return {
      excerpt: truncateToWords(chunks[0] ?? normalized, MAX_EXCERPT_WORDS),
      chunkIndex: 0,
      totalChunks: 1,
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
    excerpt: truncateToWords(excerpt, MAX_EXCERPT_WORDS),
    chunkIndex: bestIndex + 1,
    totalChunks: chunks.length,
  };
}
