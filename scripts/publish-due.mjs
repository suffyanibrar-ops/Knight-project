/**
 * Independent scheduled-publication runner.
 *
 *   SQLITE_PATH=/var/lib/knight/app.db npm run blog:publish-due
 *
 * The site also promotes due posts lazily on read, but production must not
 * depend on a visitor arriving. This script is safe to run from a systemd timer
 * or cron: it updates only rows that are still `scheduled` and due, so repeated
 * or overlapping executions cannot create duplicate posts or duplicate state.
 * All missed schedules are caught the next time it runs.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

const configured = process.env.SQLITE_PATH?.trim() || "data/app.db";
const databasePath = isAbsolute(configured) ? configured : `${process.cwd()}/${configured}`;
if (!existsSync(databasePath)) {
  console.error(`[publish-due] database does not exist: ${databasePath}`);
  process.exit(1);
}

const db = new Database(databasePath);
try {
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  const now = Date.now();
  const due = db.prepare(
    `SELECT id, scheduled_for FROM blog_posts
     WHERE status = 'scheduled' AND deleted_at IS NULL
       AND scheduled_for IS NOT NULL AND scheduled_for <= ?
     ORDER BY scheduled_for ASC`,
  ).all(now);
  const update = db.prepare(
    `UPDATE blog_posts
       SET status = 'published', published_at = ?, scheduled_for = NULL, updated_at = ?
     WHERE id = ? AND status = 'scheduled' AND deleted_at IS NULL`,
  );
  let published = 0;
  const run = db.transaction(() => {
    for (const row of due) {
      const scheduledAt = Number(row.scheduled_for) || now;
      const result = update.run(scheduledAt, now, row.id);
      if (result.changes === 1) published += 1;
    }
  });
  run();
  console.log(`[publish-due] checked=${due.length} published=${published} at=${new Date(now).toISOString()}`);
} catch (error) {
  console.error(`[publish-due] failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown"}`);
  process.exitCode = 1;
} finally {
  db.close();
}
