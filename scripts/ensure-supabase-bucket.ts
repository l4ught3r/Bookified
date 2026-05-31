/**
 * Создаёт bucket в Supabase Storage, если его ещё нет.
 *
 * Запуск:
 *   npx tsx scripts/ensure-supabase-bucket.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { getSupabaseAdmin, getSupabaseBucketName } from "../lib/storage/supabase-client";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const supabase = getSupabaseAdmin();
  const bucket = getSupabaseBucketName();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to list buckets: ${listError.message}`);
  }

  const exists = buckets?.some((entry) => entry.name === bucket);
  if (exists) {
    console.log(`Bucket "${bucket}" already exists.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
  });

  if (createError) {
    throw new Error(`Failed to create bucket "${bucket}": ${createError.message}`);
  }

  console.log(`Bucket "${bucket}" created.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
