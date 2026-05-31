import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env" });

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260529120000_enable_rls_on_books_chapters_assets.sql",
);

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }
  return url;
}

async function main() {
  const connectionString = requireDatabaseUrl();
  const sql = readFileSync(migrationPath, "utf8");
  const client = postgres(connectionString, { prepare: false, max: 1 });

  try {
    await client.unsafe(sql);
    console.log("RLS migration applied successfully.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to apply RLS migration:", message);
  process.exit(1);
});
