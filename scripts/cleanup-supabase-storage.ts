/**
 * Удаляет осиротевшие файлы из Supabase Storage, которые не привязаны
 * к записям books/assets/chapters в Postgres.
 *
 * Запуск:
 *   npx tsx scripts/cleanup-supabase-storage.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { db } from "../lib/db";
import { assets, books, chapters } from "../lib/db/schema";
import { deleteBookFiles, normalizeStoragePath } from "../lib/storage/book-storage";
import { getSupabaseAdmin, getSupabaseBucketName } from "../lib/storage/supabase-client";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function listAllStoragePaths(prefix = ""): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const bucket = getSupabaseBucketName();
  const paths: string[] = [];

  async function walk(currentPrefix: string): Promise<void> {
    const { data, error } = await supabase.storage.from(bucket).list(currentPrefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Supabase list failed for ${currentPrefix}: ${error.message}`);
    }

    for (const entry of data ?? []) {
      const entryPath = currentPrefix ? `${currentPrefix}/${entry.name}` : entry.name;
      if (entry.id) {
        paths.push(normalizeStoragePath(entryPath));
      } else {
        await walk(entryPath);
      }
    }
  }

  await walk(prefix);
  return paths;
}

async function main() {
  const knownPaths = new Set<string>();

  const assetRows = await db.select({ storagePath: assets.storagePath }).from(assets);
  for (const asset of assetRows) {
    knownPaths.add(asset.storagePath);
  }

  const chapterRows = await db.select({ storagePath: chapters.storagePath }).from(chapters);
  for (const chapter of chapterRows) {
    knownPaths.add(chapter.storagePath);
  }

  const bookRows = await db
    .select({
      originalStoragePath: books.originalStoragePath,
      typographyStoragePath: books.typographyStoragePath,
    })
    .from(books);

  for (const book of bookRows) {
    if (book.originalStoragePath) knownPaths.add(book.originalStoragePath);
    if (book.typographyStoragePath) knownPaths.add(book.typographyStoragePath);
  }

  console.log(`Известных путей в Postgres: ${knownPaths.size}`);

  const allPaths = await listAllStoragePaths();
  console.log(`Всего файлов в Supabase bucket: ${allPaths.length}`);

  const orphaned = allPaths.filter((storagePath) => !knownPaths.has(storagePath));
  console.log(`Осиротевших файлов: ${orphaned.length}`);

  if (!orphaned.length) {
    console.log("Нечего чистить.");
    return;
  }

  for (const storagePath of orphaned) {
    console.log(`  Удаляю: ${storagePath}`);
  }

  await deleteBookFiles(orphaned);
  console.log(`\nГотово. Удалено ${orphaned.length} файлов.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
