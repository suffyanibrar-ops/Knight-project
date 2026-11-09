/**
 * Verify a deployed backup without modifying it.
 *
 *   node scripts/verify-backup.mjs /var/backups/knight/predeploy/<timestamp>
 *
 * Checks SQLite integrity, manifest size/counts and the presence of media files.
 * This is intentionally read-only and exits non-zero on any mismatch.
 */
import Database from "better-sqlite3";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const directory = process.argv[2];
if (!directory) {
  console.error("[verify-backup] usage: node scripts/verify-backup.mjs <backup-directory>");
  process.exit(2);
}
const databasePath = join(directory, "app.db");
const manifestPath = join(directory, "manifest.json");
if (!existsSync(databasePath)) {
  console.error(`[verify-backup] missing database: ${databasePath}`);
  process.exit(1);
}
const db = new Database(databasePath, { readonly: true, fileMustExist: true });
try {
  const rows = db.pragma("integrity_check");
  const result = Array.isArray(rows) ? rows : [];
  if (result.length !== 1 || String(result[0]?.integrity_check ?? result[0]) !== "ok") {
    console.error(`[verify-backup] integrity_check failed: ${JSON.stringify(result).slice(0, 500)}`);
    process.exit(1);
  }
} finally {
  db.close();
}

const databaseBytes = statSync(databasePath).size;
if (databaseBytes <= 0) {
  console.error("[verify-backup] database backup is empty");
  process.exit(1);
}

let manifest = null;
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    console.error("[verify-backup] manifest.json is malformed");
    process.exit(1);
  }
  if (manifest.databaseBytes && Number(manifest.databaseBytes) !== databaseBytes) {
    console.error(`[verify-backup] manifest database size mismatch: ${manifest.databaseBytes} vs ${databaseBytes}`);
    process.exit(1);
  }
}

const mediaRoot = join(directory, "blog-media");
let mediaFiles = 0;
if (existsSync(mediaRoot)) {
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else mediaFiles += 1;
    }
  };
  walk(mediaRoot);
}
if (manifest && manifest.mediaFiles !== undefined && Number(manifest.mediaFiles) !== mediaFiles) {
  console.error(`[verify-backup] manifest media count mismatch: ${manifest.mediaFiles} vs ${mediaFiles}`);
  process.exit(1);
}
console.log(`[verify-backup] OK database=${databaseBytes} bytes mediaFiles=${mediaFiles} path=${directory}`);
