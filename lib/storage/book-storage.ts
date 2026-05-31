import { getSupabaseAdmin, getSupabaseBucketName } from "@/lib/storage/supabase-client";

const STORAGE_LIST_TIMEOUT_MS = 20_000;

export function normalizeStoragePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withStorageTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${label} timed out after ${STORAGE_LIST_TIMEOUT_MS}ms`)),
          STORAGE_LIST_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function uploadBookFile(
  buffer: Buffer,
  path: string,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const bucket = getSupabaseBucketName();
  const storagePath = normalizeStoragePath(path);

  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase upload failed for ${storagePath}: ${error.message}`);
  }

  return storagePath;
}

export async function downloadBookFile(storagePath: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const bucket = getSupabaseBucketName();
  const normalizedPath = normalizeStoragePath(storagePath);

  const { data, error } = await supabase.storage.from(bucket).download(normalizedPath);

  if (error || !data) {
    throw new Error(`Supabase download failed for ${normalizedPath}: ${error?.message ?? "empty file"}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function deleteBookFile(storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const bucket = getSupabaseBucketName();
  const normalizedPath = normalizeStoragePath(storagePath);

  const { error } = await supabase.storage.from(bucket).remove([normalizedPath]);

  if (error && !error.message.toLowerCase().includes("not found")) {
    throw new Error(`Supabase delete failed for ${normalizedPath}: ${error.message}`);
  }
}

export async function deleteBookFiles(storagePaths: string[]): Promise<void> {
  const uniquePaths = [...new Set(storagePaths.map(normalizeStoragePath).filter(Boolean))];
  if (!uniquePaths.length) return;

  const supabase = getSupabaseAdmin();
  const bucket = getSupabaseBucketName();

  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);

  if (error && !error.message.toLowerCase().includes("not found")) {
    throw new Error(`Supabase bulk delete failed: ${error.message}`);
  }
}

export async function deleteBookFilesBestEffort(storagePaths: string[]): Promise<void> {
  try {
    await deleteBookFiles(storagePaths);
  } catch (error) {
    console.warn(`Supabase bulk delete incomplete: ${getErrorMessage(error)}`);
  }
}

async function listAllFiles(prefix: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const bucket = getSupabaseBucketName();
  const normalizedPrefix = normalizeStoragePath(prefix);
  const paths: string[] = [];

  async function walk(currentPrefix: string): Promise<void> {
    try {
      const { data, error } = await withStorageTimeout(
        supabase.storage.from(bucket).list(currentPrefix, {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        }),
        `Supabase list for ${currentPrefix}`,
      );

      if (error) {
        throw new Error(error.message);
      }

      for (const entry of data ?? []) {
        const entryPath = currentPrefix ? `${currentPrefix}/${entry.name}` : entry.name;
        if (entry.id) {
          paths.push(entryPath);
        } else {
          await walk(entryPath);
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn(`Supabase list skipped for ${currentPrefix}: ${message}`);
    }
  }

  await walk(normalizedPrefix);
  return paths;
}

export async function deleteBookStoragePrefix(prefix: string): Promise<void> {
  const paths = await listAllFiles(prefix);
  if (paths.length) {
    await deleteBookFilesBestEffort(paths);
  }
}

export async function deleteAllBookStorage(bookId: string): Promise<void> {
  const prefixes = [
    `original/${bookId}`,
    `covers/${bookId}`,
    `assets/${bookId}`,
    `chapters/${bookId}`,
    `typography/${bookId}`,
  ];

  for (const prefix of prefixes) {
    try {
      await deleteBookStoragePrefix(prefix);
    } catch (error) {
      console.warn(
        `Book storage prefix cleanup failed for ${prefix}: ${getErrorMessage(error)}`,
      );
    }
  }
}
