import { isInvalidBatchTranscript } from "@/lib/ai/voice-chat-labels";

/** Light cleanup for Chrome Web Speech output (repetition, whitespace). */
export function sanitizeBrowserTranscript(text: string): string {
  let normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  normalized = normalized.replace(/(\b[\p{L}\p{N}]{1,}\b)(?:\s+\1){2,}/giu, "$1");

  const words = normalized.split(" ");
  if (words.length >= 6) {
    const deduped: string[] = [];
    let repeatRun = 1;
    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      const prev = words[i - 1];
      if (prev && word.toLowerCase() === prev.toLowerCase()) {
        repeatRun += 1;
        if (repeatRun > 2) {
          continue;
        }
      } else {
        repeatRun = 1;
      }
      deduped.push(word);
    }
    normalized = deduped.join(" ");
  }

  return normalized.trim();
}

/** Prefer Gemini batch text when browser STT looks broken or empty. */
export function shouldPreferBatchTranscript(browserText: string, batchText: string): boolean {
  const browser = sanitizeBrowserTranscript(browserText);
  const batch = batchText.trim();

  if (!batch || isInvalidBatchTranscript(batch)) {
    return false;
  }

  if (!browser) {
    return true;
  }

  if (batch.length >= browser.length * 0.4 && batch.length <= browser.length * 2.5) {
    const browserWords = browser.split(/\s+/).length;
    const batchWords = batch.split(/\s+/).length;
    if (batchWords >= Math.max(2, Math.floor(browserWords * 0.5))) {
      const uniqueBrowser = new Set(browser.toLowerCase().split(/\s+/));
      if (uniqueBrowser.size <= 2 && batchWords >= 3) {
        return true;
      }
    }
  }

  return false;
}
