/**
 * Safe, explicit one-way database restoration/copy. NOT used during deployment.
 *
 *   SOURCE_SQLITE_PATH=/var/backups/knight/predeploy/.../app.db \
 *   DEST_SQLITE_PATH=/var/lib/knight/app.db \
 *   OVERWRITE_PRODUCTION=1 PRODUCTION_APP_STOPPED=1 DESTINATION_BACKED_UP=1 \
 *   npm run db:migrate:production
 *
 * The destination is never modified until:
 *   - the source has passed integrity_check
 *   - the new database has been written to a temporary sibling and verified
 *   - no stale destination -wal/-shm remains
 *   - explicit "manual maintenance" flags are supplied
 *
 * The copy is then an atomic rename in the destination directory. Existing
 * destination media is copied/overwritten from the source media directory.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

const sourceConfigured = process.env.SOURCE_SQLITE_PATH?.trim() || "data/app.db";
const source = isAbsolute(sourceConfigured) ? sourceConfigured : `${process.cwd()}/${sourceConfigured}`;
const destConfigured = process.env.DEST_SQLITE_PATH?.trim();
if (!destConfigured) {
  console.error("[restore] DEST_SQLITE_PATH is required, e.g. /var/lib/knight/app.db");
  process.exit(1);
}
const destination = isAbsolute(destConfigured) ? destConfigured : `${process.cwd()}/${destConfigured}`;
if (!existsSync(source)) {
  console.error(`[restore] source database does not exist: ${source}`);
  process.exit(1);
}
const destinationExists = existsSync(destination);
if (destinationExists) {
  if (process.env.OVERWRITE_PRODUCTION !== "1") {
    console.error(`[restore] refusing to overwrite existing database: ${destination}`);
    console.error("[restore] back it up, then set OVERWRITE_PRODUCTION=1 for an intentional replacement.");
    process.exit(1);
  }
  if (process.env.PRODUCTION_APP_STOPPED !== "1") {
    console.error("[restore] refusing to overwrite a live production database.");
    console.error("[restore] stop the app and set PRODUCTION_APP_STOPPED=1 after confirming it is stopped.");
    process.exit(1);
  }
  if (process.env.DESTINATION_BACKED_UP !== "1") {
    console.error("[restore] refusing to overwrite without a verified destination backup.");
    console.error("[restore] create and verify a backup, then set DESTINATION_BACKED_UP=1.");
    process.exit(1);
  }
  if (existsSync(`${destination}-wal`) || existsSync(`${destination}-shm`)) {
    console.error("[restore] destination still has -wal/-shm files.");
    console.error("[restore] with the app stopped, checkpoint/back up the database and remove only the stale WAL/SHM after verification.");
    process.exit(1);
  }
}

function integrity(file) {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const rows = db.pragma("integrity_check");
    const value = Array.isArray(rows) && rows.length === 1 ? String(rows[0]?.integrity_check ?? rows[0]) : "";
    return value === "ok";
  } finally {
    db.close();
  }
}

if (!integrity(source)) {
  console.error(`[restore] source database failed integrity_check: ${source}`);
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
const temporary = `${destination}.restore-${process.pid}-${Date.now()}.tmp`;
try {
  const sourceDb = new Database(source, { readonly: true, fileMustExist: true });
  try {
    sourceDb.pragma("busy_timeout = 5000");
    await sourceDb.backup(temporary);
  } finally {
    sourceDb.close();
  }
  if (!integrity(temporary)) {
    console.error("[restore] temporary restored database failed integrity_check; destination unchanged");
    rmSync(temporary, { force: true });
    process.exit(1);
  }
  // Keep the restored DB group-readable only, even if the process umask is lax.
  chmodSync(temporary, 0o640);
  // Atomic on the same filesystem. The live destination is untouched until here.
  renameSync(temporary, destination);
} catch (error) {
  rmSync(temporary, { force: true });
  console.error(`[restore] failed before replacing destination: ${error instanceof Error ? error.message.slice(0, 300) : "unknown"}`);
  process.exit(1);
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

console.log(`[restore] replaced ${destination} from ${source}`);
console.log(`[restore] database=${statSync(destination).size} bytes mediaFiles=${mediaFiles}`);
console.log("[restore] start the app only after verifying /api/health and the restored data.");
