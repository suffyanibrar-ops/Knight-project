/**
 * Safe one-way copy for a database migration to production.
 *
 *   SOURCE_SQLITE_PATH="./data/app.db" \
 *   DEST_SQLITE_PATH="/var/data/app.db" \
 *   npm run db:migrate:production
 *
 * Refuses to overwrite an existing production database unless
 * OVERWRITE_PRODUCTION=1 is explicitly set. The source is copied with the
 * online backup API; blog-media is copied beside it.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

const sourceConfigured = process.env.SOURCE_SQLITE_PATH?.trim() || "data/app.db";
const source = isAbsolute(sourceConfigured) ? sourceConfigured : `${process.cwd()}/${sourceConfigured}`;
const destConfigured = process.env.DEST_SQLITE_PATH?.trim();
if (!destConfigured) {
  console.error("[migrate] DEST_SQLITE_PATH is required, e.g. /var/data/app.db");
  process.exit(1);
}
const destination = isAbsolute(destConfigured) ? destConfigured : `${process.cwd()}/${destConfigured}`;
if (!existsSync(source)) {
  console.error(`[migrate] source database does not exist: ${source}`);
  process.exit(1);
}
if (existsSync(destination) && process.env.OVERWRITE_PRODUCTION !== "1") {
  console.error(`[migrate] refusing to overwrite existing database: ${destination}`);
  console.error("[migrate] back it up, then set OVERWRITE_PRODUCTION=1 for an intentional replacement.");
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
const db = new Database(source);
try {
  db.pragma("busy_timeout = 5000");
  await db.backup(destination);
} finally {
  db.close();
}

const sourceMedia = join(dirname(source), "blog-media");
const destinationMedia = join(dirname(destination), "blog-media");
let mediaFiles = 0;
if (existsSync(sourceMedia)) {
  cpSync(sourceMedia, destinationMedia, { recursive: true });
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(directory, entry.name));
      else mediaFiles += 1;
    }
  };
  walk(destinationMedia);
}

console.log(`[migrate] copied ${source} -> ${destination}`);
console.log(`[migrate] database=${statSync(destination).size} bytes mediaFiles=${mediaFiles}`);
console.log("[migrate] set SQLITE_PATH to the destination and verify /api/health before switching traffic.");
