import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-blog-lifecycle-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "blog-lifecycle-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

const base = {
  title: "Lifecycle article",
  slug: "lifecycle-article",
  excerpt: "Fixture article for the lifecycle test.",
  contentHtml: "<h2>Section</h2><p>Body copy for the lifecycle fixture.</p>",
  author: "Knight Medical Billing",
};

try {
  const blog = await import("../src/lib/blog");
  const workflow = await import("../src/lib/content-workflow");

  // ---- idea (workflow) -> draft post ----
  const workflowId = await workflow.createContentWorkflow({
    topic: "Idea stage fixture",
    audience: "Hospital revenue managers",
    stage: "idea",
    data: {},
  });
  ok("idea recorded in the workspace workflow table", workflowId > 0);

  const draftId = await blog.createPost({ ...base, status: "draft" } as never);
  const draft = await blog.getAdminPost(draftId);
  ok("draft created in draft state", draft?.status === "draft");

  const workspaceDrafts = await blog.listWorkspacePosts(50);
  const publishedList = await blog.listPublishedPosts(50);
  ok("draft appears in the workspace queue", workspaceDrafts.some((p) => p.id === draftId));
  ok("draft never appears in Published Articles", !publishedList.some((p) => p.id === draftId));

  // ---- draft -> published ----
  await blog.setPostStatus(draftId, "published");
  const published = await blog.getAdminPost(draftId);
  ok("publish persists", published?.status === "published");
  ok("published article leaves the workspace queue", !(await blog.listWorkspacePosts(50)).some((p) => p.id === draftId));
  ok("published article appears in Published Articles", (await blog.listPublishedPosts(50)).some((p) => p.id === draftId));

  const publicList = await blog.listPublicPosts({});
  ok("published article is public", publicList.posts.some((p) => p.slug === "lifecycle-article"));
  ok("public article page resolves", (await blog.getPublicPost("lifecycle-article")) !== null);

  // ---- published -> unpublished ----
  await blog.setPostStatus(draftId, "unpublished");
  ok("unpublish persists", (await blog.getAdminPost(draftId))?.status === "unpublished");
  ok("unpublished article leaves Published Articles", !(await blog.listPublishedPosts(50)).some((p) => p.id === draftId));
  ok("unpublished article returns to the workspace queue", (await blog.listWorkspacePosts(50)).some((p) => p.id === draftId));
  ok("unpublished article is not public", (await blog.listPublicPosts({})).posts.every((p) => p.slug !== "lifecycle-article"));
  ok("unpublished article page is gone", (await blog.getPublicPost("lifecycle-article")) === null);

  // ---- workflow queue separation ----
  const linkedWorkflow = await workflow.createContentWorkflow({
    topic: "Linked workflow fixture",
    stage: "seo_review",
    data: { blogPostId: draftId },
  });
  await workflow.attachWorkflowPost(linkedWorkflow, draftId, {}, "seo_review");
  const visibleWorkflows = await workflow.listContentWorkflows(50);
  ok("workspace workflows include unpublished work", visibleWorkflows.some((w) => w.id === linkedWorkflow));

  // ---- scheduled publication ----
  const futureId = await blog.createPost({ ...base, title: "Future scheduled", slug: "future-scheduled", status: "scheduled", scheduledFor: new Date(Date.now() + 86_400_000) } as never);
  ok("future scheduled post is not published", !(await blog.listPublishedPosts(50)).some((p) => p.id === futureId));
  ok("future scheduled post is not public", (await blog.listPublicPosts({})).posts.every((p) => p.slug !== "future-scheduled"));

  // Scheduling requires a future time, so create it just ahead and let it come due.
  const dueId = await blog.createPost({ ...base, title: "Due scheduled", slug: "due-scheduled", status: "scheduled", scheduledFor: new Date(Date.now() + 1200) } as never);
  ok("scheduled post is not public before it is due", (await blog.listPublicPosts({})).posts.every((p) => p.slug !== "due-scheduled"));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const promoted = await blog.publishDuePosts();
  ok("due scheduled post is promoted on read", promoted >= 1 && (await blog.getAdminPost(dueId))?.status === "published");
  ok("promoted post is public", (await blog.listPublicPosts({})).posts.some((p) => p.slug === "due-scheduled"));

  // ---- failed publish keeps the record unchanged ----
  const trashedId = await blog.createPost({ ...base, title: "Trashed fixture", slug: "trashed-fixture", status: "draft" } as never);
  await blog.trashPost(trashedId);
  let publishFailed = false;
  try { await blog.setPostStatus(trashedId, "published"); } catch { publishFailed = true; }
  ok("publishing a trashed post is rejected", publishFailed && (await blog.getAdminPost(trashedId))?.status === "trashed");

  // ---- duplicate prevention ----
  const dupA = await blog.createPost({ ...base, title: "Duplicate fixture", slug: "duplicate-fixture" } as never);
  const dupB = await blog.createPost({ ...base, title: "Duplicate fixture", slug: "duplicate-fixture" } as never);
  const [postA, postB] = [await blog.getAdminPost(dupA), await blog.getAdminPost(dupB)];
  ok("duplicate slugs are deduplicated on insert", Boolean(postA && postB) && postA!.slug !== postB!.slug, `${postA?.slug} / ${postB?.slug}`);
  ok("no duplicate article rows are created", dupA !== dupB && Boolean(postA && postB));

  // ---- filters stay consistent with the modules ----
  const draftsOnly = await blog.listAdminPosts({ status: "draft" });
  ok("status filter returns only drafts", draftsOnly.posts.every((p) => p.status === "draft"));
  const archivedId = await blog.createPost({ ...base, title: "Archived fixture", slug: "archived-fixture", status: "archived" } as never);
  ok("archived post is not public", (await blog.listPublicPosts({})).posts.every((p) => p.id !== archivedId));
  ok("archived post is outside both queues",
    !(await blog.listWorkspacePosts(50)).some((p) => p.id === archivedId) &&
    !(await blog.listPublishedPosts(50)).some((p) => p.id === archivedId));

  const counts = await blog.getModuleCounts();
  ok("module counts are computed server-side", counts.published >= 1 && counts.workspace >= 1, JSON.stringify(counts));

  // ---- editing a published article keeps it live ----
  await blog.updatePost(draftId, { ...base, title: "Lifecycle article edited", slug: "lifecycle-article", status: "published" } as never);
  const edited = await blog.getAdminPost(draftId);
  ok("editing a published article preserves publication", edited?.status === "published" && edited?.title === "Lifecycle article edited");

  assert.ok(passed > 0);
  console.log(`RESULT pass=${passed} fail=0`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.log("RESULT pass=0 fail=1");
  process.exitCode = 1;
} finally {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { rmSync(db + suffix, { force: true }); } catch {}
  }
}
