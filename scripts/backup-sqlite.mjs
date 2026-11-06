/**
 * Consistent SQLite + blog-media backup.
 *
 *   npm run db:backup
 *   SQLITE_PATH=/var/data/app.db BACKUP_DIR=/var/backups/knight npm run db:backup
 *
 * The database is copied with better-sqlite3's online backup API (safe while
 * the app is running in WAL mode). Media is copied beside it. This script never
 * creates a database; a missing source is an error.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";

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

mkdirSync(backupRoot, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = join(backupRoot, stamp);
mkdirSync(destination, { recursive: true });
const databaseBackup = join(destination, "app.db");

const db = new Database(source);
try {
  db.pragma("busy_timeout = 5000");
  await db.backup(databaseBackup);
} finally {
  db.close();
}

const mediaSource = join(dirname(source), "blog-media");
const mediaDestination = join(destination, "blog-media");
let mediaFiles = 0;
if (existsSync(mediaSource)) {
  cpSync(mediaSource, mediaDestination, { recursive: true });
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
writeFileSync(join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

// Retention is based on the timestamp directory prefix so only our own dirs are removed.
const cutoff = Date.now() - keepDays * 86_400_000;
for (const entry of readdirSync(backupRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const parsed = Date.parse(entry.name.replace(/-/g, (char, index) => (index === 4 || index === 7 ? ":" : char)));
  const timestamp = Number.isNaN(parsed) ? null : parsed;
  const stat = statSync(join(backupRoot, entry.name));
  if ((timestamp !== null && timestamp < cutoff) || (timestamp === null && stat.mtimeMs < cutoff)) {
    rmSync(join(backupRoot, entry.name), { recursive: true, force: true });
  }
}

console.log(`[backup] ${destination}`);
console.log(`[backup] database=${statSync(databaseBackup).size} bytes mediaFiles=${mediaFiles} retainDays=${keepDays}`);
