/**
 * MongoDB text indexes treat a document field named `language` as a
 * language override for stemming. Values like "unknown" are invalid and
 * cause "language override unsupported" errors — use "none" instead.
 */
const LANGUAGE_MAP: Record<string, string> = {
  ru: "russian",
  "ru-ru": "russian",
  en: "english",
  "en-us": "english",
  "en-gb": "english",
  de: "german",
  fr: "french",
  es: "spanish",
  it: "italian",
  pt: "portuguese",
  none: "none",
  unknown: "none",
};

export function normalizeBookLanguage(language?: string | null): string {
  const raw = (language ?? "").toLowerCase().trim();
  if (!raw) return "none";

  const mapped = LANGUAGE_MAP[raw];
  if (mapped) return mapped;

  // Allow passing through known MongoDB language names (english, russian, …)
  if (/^[a-z]+$/.test(raw) && raw !== "unknown") return raw;

  return "none";
}
