export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function getTextValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null && "#text" in value) {
    const text = (value as Record<string, unknown>)["#text"];
    return text == null ? "" : String(text);
  }
  return "";
}

export function getAttr(value: unknown, ...keys: string[]): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const attr = record[`@_${key}`] ?? record[`@_l:${key}`] ?? record[`@_xlink:${key}`];
    if (typeof attr === "string" && attr.length > 0) {
      return attr.replace(/^#/, "");
    }
  }
  return "";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function decodeFb2Xml(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    throw new Error("FB2_ZIP");
  }

  const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("latin1");
  const encodingMatch = head.match(/encoding=["']([^"']+)["']/i);
  const encoding = encodingMatch?.[1]?.toLowerCase() ?? "utf-8";

  if (encoding.includes("1251") || encoding.includes("cp1251") || encoding.includes("windows-1251")) {
    try {
      return new TextDecoder("windows-1251").decode(buffer);
    } catch {
      return buffer.toString("utf-8");
    }
  }

  if (encoding.includes("utf")) {
    return buffer.toString("utf-8");
  }

  return buffer.toString("utf-8");
}
