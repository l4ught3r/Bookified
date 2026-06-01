export const OPENAI_REALTIME_WHISPER_MODEL = "gpt-realtime-whisper" as const;

export function getOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
}
