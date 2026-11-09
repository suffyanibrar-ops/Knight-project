/**
 * Consistent SQLite + blog-media backup.
 *
 *   npm run db:backup
 *   SQLITE_PATH=/var/lib/knight/app.db BACKUP_DIR=/var/backups/knight npm run db:backup
 *
 * The database is copied with better-sqlite3's online backup API (safe while
 * the app is running in WAL mode). Media is copied beside it. This script never
 * creates a database; a missing source is an error.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";

// Keep new backup files group-readable only. The shared backup directory is
// setgid, so group ownership is inherited from /var/backups/knight.
process.umask(0o027);

const configured = process.env.SQLITE_PATH?.trim() || "data/app.db";
const source = isAbsolute(configured) ? configured : `${process.cwd()}/${configured}`;
if (!existsSync(source)) {
  console.error(`[backup] refusing to continue: database does not exist at ${source}`);
  process.exit(1);
}

const keepDays = Math.max(1, Math.min(3650, Number(process.env.BACKUP_KEEP_DAYS ?? 14) || 14));
const backupRoot = process.env.BACKUP_DIR?.trim()
  ? (isAbsolute(process.env.BACKUP_DIR.trim()) ? process.env.BACKUP_DIR.trim() : `${process.cwd()}/${process.env.BACKUP_DIR.trim()}`)
  : join(dirname(source), "backups");

mkdirSync(backupRoot, { recursive: true, mode: 0o2770 });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = join(backupRoot, stamp);
mkdirSync(destination, { recursive: true, mode: 0o2750 });
chmodSync(destination, 0o2750);
const databaseBackup = join(destination, "app.db");

const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  db.pragma("busy_timeout = 5000");
  await db.backup(databaseBackup);
} finally {
  db.close();
}
chmodSync(databaseBackup, 0o640);

const mediaSource = join(dirname(source), "blog-media");
const mediaDestination = join(destination, "blog-media");
let mediaFiles = 0;
if (existsSync(mediaSource)) {
  cpSync(mediaSource, mediaDestination, { recursive: true });
  chmodSync(mediaDestination, 0o2750);
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(directory, entry.name));
      else mediaFiles += 1;
    }
  };
  walk(mediaDestination);
}

const manifest = {
  createdAt: new Date().toISOString(),
  sourceDatabase: source,
  sourceMedia: existsSync(mediaSource) ? mediaSource : null,
  databaseBytes: statSync(databaseBackup).size,
  mediaFiles,
  keepDays,
};
const manifestPath = join(destination, "manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
chmodSync(manifestPath, 0o640);

// Retention only removes our own ISO-timestamp directories. Never remove an
// unknown directory: `predeploy/` (and future recovery folders) must survive
// normal scheduled cleanup even when it is old.
const cutoff = Date.now() - keepDays * 86_400_000;
const TIMESTAMP_DIR = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
for (const entry of readdirSync(backupRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || !TIMESTAMP_DIR.test(entry.name)) continue;
  const parsed = Date.parse(entry.name.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1-$2-$3T$4:$5:$6.$7Z"));
  const timestamp = Number.isNaN(parsed) ? null : parsed;
  if (timestamp !== null && timestamp < cutoff) {
    rmSync(join(backupRoot, entry.name), { recursive: true, force: true });
  }
}

console.log(`[backup] ${destination}`);
console.log(`[backup] database=${statSync(databaseBackup).size} bytes mediaFiles=${mediaFiles} retainDays=${keepDays}`);
