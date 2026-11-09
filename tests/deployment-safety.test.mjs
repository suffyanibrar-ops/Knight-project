/**
 * Local-only safety tests for deployment backup/restore behavior.
 *
 *   npm run test:deploy-safety
 *
 * Uses temporary copies only. It never reads or writes /var/lib/knight, never
 * uses SSH and never touches production services.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const ROOT = resolve(process.cwd());
let passed = 0;
let failed = 0;
const check = (name, condition, detail = "") => {
  if (condition) { passed += 1; console.log("PASS", name); }
  else { failed += 1; console.log("FAIL", name, detail); }
};
const run = (script, env) => spawnSync(process.execPath, [join(ROOT, script)], {
  cwd: ROOT,
  env: { ...process.env, ...env },
  encoding: "utf8",
});
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const temp = mkdtempSync(join(tmpdir(), "kmb-deploy-safety-"));
const previousUmask = process.umask(0o027);

try {
  // ---------- backup retention must preserve predeploy ----------
  const sourceDir = join(temp, "source");
  mkdirSync(sourceDir, { recursive: true });
  const sourceDb = join(sourceDir, "app.db");
  copyFileSync(join(ROOT, "data/app.db"), sourceDb);
  const backupRoot = join(temp, "backups");
  const predeploy = join(backupRoot, "predeploy", "keep-me");
  mkdirSync(predeploy, { recursive: true });
  writeFileSync(join(predeploy, "marker"), "keep");
  const oldBackup = join(backupRoot, "2000-01-01T00-00-00-000Z");
  mkdirSync(oldBackup, { recursive: true });
  writeFileSync(join(oldBackup, "old"), "delete");
  const oldDate = new Date("2000-01-01T00:00:00Z");
  utimesSync(predeploy, oldDate, oldDate);
  utimesSync(oldBackup, oldDate, oldDate);

  const backupRun = run("scripts/backup-sqlite.mjs", { SQLITE_PATH: sourceDb, BACKUP_DIR: backupRoot, BACKUP_KEEP_DAYS: "1" });
  check("backup exits successfully", backupRun.status === 0, backupRun.stderr);
  check("predeploy directory survives retention", existsSync(join(predeploy, "marker")));
  check("old timestamped backup is removed", !existsSync(oldBackup));
  const backupDirs = readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(entry.name))
    .map((entry) => join(backupRoot, entry.name));
  check("new timestamped backup exists", backupDirs.length >= 1, String(backupDirs.length));
  if (backupDirs[0]) {
    const verify = spawnSync(process.execPath, [join(ROOT, "scripts/verify-backup.mjs"), backupDirs[0]], { cwd: ROOT, encoding: "utf8" });
    check("new backup passes integrity verification", verify.status === 0, verify.stderr || verify.stdout);
    const backupDirMode = statSync(backupDirs[0]).mode & 0o7777;
    const backupDbMode = statSync(join(backupDirs[0], "app.db")).mode & 0o777;
    // macOS temporary filesystems reject directory setgid. Linux (the target)
    // must retain it; all platforms must reject world access.
    check("backup directory is group-only", (backupDirMode & 0o007) === 0, backupDirMode.toString(8));
    if (process.platform !== "darwin") {
      check("backup directory retains setgid", (backupDirMode & 0o2000) !== 0, backupDirMode.toString(8));
    }
    check("backup database is 0640", backupDbMode === 0o640, backupDbMode.toString(8));
  }

  // ---------- restore requires explicit safety flags ----------
  const restoreSource = join(temp, "restore-source.db");
  const restoreDestination = join(temp, "restore-destination.db");
  copyFileSync(join(ROOT, "data/app.db"), restoreSource);
  copyFileSync(join(ROOT, "data/app.db"), restoreDestination);
  const before = hash(restoreDestination);
  const noFlags = run("scripts/copy-sqlite.mjs", { SOURCE_SQLITE_PATH: restoreSource, DEST_SQLITE_PATH: restoreDestination });
  check("restore refuses destination without explicit flags", noFlags.status !== 0);
  check("refused restore leaves destination unchanged", hash(restoreDestination) === before);
  const stoppedOnly = run("scripts/copy-sqlite.mjs", { SOURCE_SQLITE_PATH: restoreSource, DEST_SQLITE_PATH: restoreDestination, OVERWRITE_PRODUCTION: "1", PRODUCTION_APP_STOPPED: "1" });
  check("restore requires a verified destination backup flag", stoppedOnly.status !== 0);
  writeFileSync(`${restoreDestination}-wal`, "stale");
  const staleWal = run("scripts/copy-sqlite.mjs", { SOURCE_SQLITE_PATH: restoreSource, DEST_SQLITE_PATH: restoreDestination, OVERWRITE_PRODUCTION: "1", PRODUCTION_APP_STOPPED: "1", DESTINATION_BACKED_UP: "1" });
  check("restore refuses stale destination WAL", staleWal.status !== 0);
  rmSync(`${restoreDestination}-wal`, { force: true });
  const valid = run("scripts/copy-sqlite.mjs", { SOURCE_SQLITE_PATH: restoreSource, DEST_SQLITE_PATH: restoreDestination, OVERWRITE_PRODUCTION: "1", PRODUCTION_APP_STOPPED: "1", DESTINATION_BACKED_UP: "1" });
  check("restore succeeds with explicit safe flags", valid.status === 0, valid.stderr || valid.stdout);
  // verify-backup expects a directory with app.db; assert destination integrity directly.
  const integrity = spawnSync(process.execPath, ["-e", `
    const Database = require("better-sqlite3");
    const db = new Database(process.argv[1], { readonly: true });
    const rows = db.pragma("integrity_check");
    console.log(JSON.stringify(rows));
    db.close();
  `, restoreDestination], { cwd: ROOT, encoding: "utf8" });
  check("restored destination passes integrity_check", integrity.status === 0 && /ok/.test(integrity.stdout));
  check("restored database mode is 0640", (statSync(restoreDestination).mode & 0o777) === 0o640);

  // ---------- static deployment assertions ----------
  const deploy = readFileSync(join(ROOT, "ops/deploy.sh"), "utf8");
  check("deploy defaults to knight service", /SERVICE="\$\{SERVICE:-knight\}"/.test(deploy));
  check("deploy has no normal database overwrite", !/OVERWRITE_PRODUCTION/.test(deploy));
  check("deploy has no database migration command", !/db:migrate:production/.test(deploy));
  check("deploy checks nested health fields", /stores\.sqlite\.available/.test(deploy) && /blockingErrors/.test(deploy));
  check("deploy preflights restricted sudo", /sudo -n -l/.test(deploy));
  check("deploy isolates build SQLite", /BUILD_DB_DIR/.test(deploy) && /SQLITE_ALLOW_CREATE=1/.test(deploy));
  check("deploy has host concurrency lock", /flock -n 9/.test(deploy));
  check("deploy creates a restricted umask", /umask 0027/.test(deploy));
  check("deploy pre-creates only the Next.js cache", /prepare_runtime_cache/.test(deploy) && /chgrp -R "\$APP_GROUP" "\$cache"/.test(deploy));
  check("deploy uses an absolute systemctl path", /SYSTEMCTL="\/usr\/bin\/systemctl"/.test(deploy) && !/sudo -n systemctl/.test(deploy));

  const workflow = readFileSync(join(ROOT, ".github/workflows/deploy-vps.yml"), "utf8");
  check("workflow triggers on main push", /push:\s*\n\s*branches:\s*\[main\]/.test(workflow));
  check("workflow has production environment", /environment: production/.test(workflow));
  check("workflow has job timeouts", /timeout-minutes:/.test(workflow));
  check("workflow does not invoke sudo", !/\bsudo\s+\//.test(workflow));
  check("workflow invokes non-root deploy script", /ops\/deploy\.sh/.test(workflow));

  const backupUnit = readFileSync(join(ROOT, "ops/systemd/knight-backup.service"), "utf8");
  check("backup timer uses non-secret deploy.env", /EnvironmentFile=\/etc\/knight\/deploy\.env/.test(backupUnit) && !/knight\.env/.test(backupUnit));
  check("backup timer restricts new file modes", /UMask=0027/.test(backupUnit));
  const appUmask = readFileSync(join(ROOT, "ops/systemd/knight-umask.conf"), "utf8");
  check("app umask drop-in exists and is scoped", /^\[Service\]$/m.test(appUmask) && /UMask=0027/.test(appUmask) && !/^\s*EnvironmentFile=/m.test(appUmask) && !/^\s*User=/m.test(appUmask));
  const installer = readFileSync(join(ROOT, "ops/install-systemd.sh"), "utf8");
  check("installer never creates knight-next", !/knight-next\.service/.test(installer));
  check("installer never enables timers", !/systemctl enable/.test(installer));
  const docs = readFileSync(join(ROOT, "DEPLOYMENT.md"), "utf8");
  check("docs protect app environment from deploy account", /0600 -o root -g root \/etc\/knight\/knight\.env/.test(docs));
  check("docs use shared knight-backup group", /knight-backup/.test(docs));
  check("docs require SQLITE_REQUIRE_EXISTING in deploy.env", /BACKUP_DIR=\/var\/backups\/knight\nSQLITE_REQUIRE_EXISTING=1/.test(docs));
  check("docs do not grant deploy access to app env", !/grant group read access to the\s+application environment/.test(docs));
  check("docs standardize systemctl path", !/(^|[^a-z])\/bin\/systemctl/m.test(docs) && /\/usr\/bin\/systemctl restart knight/.test(docs));
  check("docs use setgid backup root", /-m 2770 \/var\/backups\/knight/.test(docs));
  check("docs cover app UMask and runtime cache", /UMask=0027/.test(docs) && /\.next\/cache/.test(docs));
  check("docs document separate GitHub Actions key", /knight-gha-deploy/.test(docs));
} finally {
  process.umask(previousUmask);
  rmSync(temp, { recursive: true, force: true });
}

console.log(`RESULT pass=${passed} fail=${failed}`);
process.exit(failed ? 1 : 0);
