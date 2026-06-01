/** Light cleanup before showing Web Speech text in the chat (does not fix all STT errors). */
export function normalizeBrowserTranscriptForDisplay(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }

  // Collapse 3+ repeats of the same token (common Chrome RU glitch).
  return trimmed.replace(/(\S+)(?:\s+\1){2,}/giu, "$1");
}

/** Prefer Gemini batch text when browser output looks like noise. */
export function shouldPreferGeminiTranscriptOverBrowser(
  gemini: string,
  browser: string,
): boolean {
  const g = gemini.trim();
  const b = browser.trim();
  if (!g) {
    return false;
  }
  if (!b) {
    return true;
  }

  const profanity = /(?:^|\s)(?:хуй|хуя|жопа|пизд|бля|еба|ёба|сука)(?:\s|$)/giu;
  const browserProfanityHits = (b.match(profanity) ?? []).length;
  const geminiProfanityHits = (g.match(profanity) ?? []).length;

  if (browserProfanityHits >= 2 && geminiProfanityHits < browserProfanityHits) {
    return true;
  }

  if (g.length >= Math.max(8, b.length * 0.35) && browserProfanityHits > 0 && geminiProfanityHits === 0) {
    return true;
  }

  return false;
}
