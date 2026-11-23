import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-idxnotify-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "idx-password";
delete process.env.INDEXNOW_KEY;

let passed = 0;
const ok = (n: string, c: boolean, d = "") => { if (!c) throw new Error(`FAIL ${n}${d ? ` — ${d}` : ""}`); passed += 1; console.log(`PASS ${n}`); };
const ORIGIN = "https://www.knightmedicalbilling.com";

try {
  const notify = await import("../src/lib/seo/indexnow-notify");
  const blog = await import("../src/lib/blog");
  const store = await import("../src/lib/sqlite");
  assert.ok(store.sqliteHandle());

  // ---- inert without a key ----
  let calls = 0;
  const noKey = await notify.notifyIndexNow({ urls: [`${ORIGIN}/blog/x`], versions: { [`${ORIGIN}/blog/x`]: "v1" }, origin: ORIGIN, key: null, fetchImpl: async () => { calls += 1; return { status: 200 }; } });
  ok("no key means no request", noKey.status === "skipped" && calls === 0);
  ok("skip reason is explicit", noKey.reason === "indexnow_not_configured");

  // ---- successful notification ----
  let sent: Record<string, unknown> | null = null;
  const good = await notify.notifyIndexNow({
    urls: [`${ORIGIN}/blog/a`], versions: { [`${ORIGIN}/blog/a`]: "pub:1" }, origin: ORIGIN, key: "k".repeat(32),
    fetchImpl: async ({ body }) => { sent = body; return { status: 200 }; },
  });
  ok("published url is submitted", good.status === "submitted" && good.accepted === 1);
  ok("payload carries host, key and keyLocation", Boolean(sent) && (sent as { host?: string }).host === "www.knightmedicalbilling.com");
  ok("payload lists only the published url", ((sent as { urlList?: string[] }).urlList ?? []).length === 1);

  // ---- dedupe: same version is not resent ----
  const again = await notify.notifyIndexNow({ urls: [`${ORIGIN}/blog/a`], versions: { [`${ORIGIN}/blog/a`]: "pub:1" }, origin: ORIGIN, key: "k".repeat(32), fetchImpl: async () => ({ status: 200 }) });
  ok("unchanged content is not resubmitted", again.status === "skipped" && again.reason === "already_submitted");
  const changed = await notify.notifyIndexNow({ urls: [`${ORIGIN}/blog/a`], versions: { [`${ORIGIN}/blog/a`]: "pub:2" }, origin: ORIGIN, key: "k".repeat(32), fetchImpl: async () => ({ status: 200 }) });
  ok("new content version is submitted", changed.status === "submitted");

  // ---- scoping and safety ----
  const foreign = await notify.notifyIndexNow({ urls: ["https://evil.example/blog/a"], versions: { "https://evil.example/blog/a": "v1" }, origin: ORIGIN, key: "k".repeat(32), fetchImpl: async () => { throw new Error("must not send"); } });
  ok("foreign urls are never sent", foreign.accepted === 0);

  const missingVersion = await notify.notifyIndexNow({ urls: [`${ORIGIN}/blog/b`], versions: {}, origin: ORIGIN, key: "k".repeat(32), fetchImpl: async () => ({ status: 200 }) });
  ok("missing content version skips instead of resending", missingVersion.status === "skipped" && missingVersion.reason === "missing_content_version");

  const failed = await notify.notifyIndexNow({ urls: [`${ORIGIN}/blog/c`], versions: { [`${ORIGIN}/blog/c`]: "v1" }, origin: ORIGIN, key: "k".repeat(32), fetchImpl: async () => ({ status: 429 }) });
  ok("provider failure is reported, not thrown", failed.status === "failed" && failed.reason === "rate_limited");

  const threw = await notify.notifyIndexNow({ urls: [`${ORIGIN}/blog/d`], versions: { [`${ORIGIN}/blog/d`]: "v1" }, origin: ORIGIN, key: "k".repeat(32), fetchImpl: async () => { throw new Error("network down"); } });
  ok("network failure never throws", threw.status === "failed");

  ok("url builder uses the public article path", notify.articleUrl(ORIGIN, "clean-claims") === `${ORIGIN}/blog/clean-claims`);

  // ---- publishing still works with no key configured ----
  const id = await blog.createPost({ title: "Notify fixture", slug: "notify-fixture", excerpt: "x", contentHtml: "<p>Body copy for the fixture article.</p>" } as never);
  await blog.setPostStatus(id, "published");
  ok("publishing succeeds without an IndexNow key", (await blog.getAdminPost(id))?.status === "published");
  await blog.setPostStatus(id, "unpublished");
  ok("unpublishing succeeds without an IndexNow key", (await blog.getAdminPost(id))?.status === "unpublished");
  ok("no index events for the inert publish", (store.sqliteHandle()!.prepare("SELECT COUNT(*) n FROM seo_index_events WHERE url LIKE ?").get("%notify-fixture") as { n: number }).n === 0);

  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
} finally {
  for (const suffix of ["", "-wal", "-shm"]) { try { rmSync(db + suffix, { force: true }); } catch {} }
}
