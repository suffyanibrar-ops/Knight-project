import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const db = join(tmpdir(), `knight-blog-visibility-${process.pid}.db`);
process.env.SQLITE_PATH = db;
process.env.SQLITE_ALLOW_CREATE = "1";
process.env.SQLITE_REQUIRE_EXISTING = "0";
process.env.ADMIN_PASSWORD = "visibility-test-password";

let passed = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (!condition) throw new Error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${name}`);
}

try {
  const blog = await import("../src/lib/blog");
  const workflow = await import("../src/lib/content-workflow");

  const categoryId = await blog.createCategory({ name: "Publication Visibility" });
  const tagId = await blog.createTag({ name: "Visibility Rules" });
  const base = {
    excerpt: "Visibility fixture.",
    contentHtml: "<h2>Fixture heading</h2><p>Published content only.</p>",
    seoTitle: "Publication visibility fixture",
    seoDescription: "A fixture used to verify public publication visibility rules.",
    categoryId,
    tagIds: [tagId],
  };
  const published = await blog.createPost({ ...base, title: "Published visibility fixture", slug: "published-visibility-fixture", status: "published" });
  const draft = await blog.createPost({ ...base, title: "Draft visibility fixture", slug: "draft-visibility-fixture", status: "draft" });
  const ready = await blog.createPost({ ...base, title: "Ready review visibility fixture", slug: "ready-review-visibility-fixture", status: "draft" });
  const approved = await blog.createPost({ ...base, title: "Approved visibility fixture", slug: "approved-visibility-fixture", status: "draft" });
  const scheduled = await blog.createPost({ ...base, title: "Future scheduled visibility fixture", slug: "future-scheduled-visibility-fixture", status: "scheduled", scheduledFor: new Date(Date.now() + 86_400_000) });
  const unpublished = await blog.createPost({ ...base, title: "Unpublished visibility fixture", slug: "unpublished-visibility-fixture", status: "draft" });
  const trashed = await blog.createPost({ ...base, title: "Trashed visibility fixture", slug: "trashed-visibility-fixture", status: "draft" });

  await blog.setPostStatus(unpublished, "unpublished");
  await blog.trashPost(trashed);
  await workflow.createContentWorkflow({ topic: "Ready review private article", data: { blogPostId: ready, review: { passed: true, summary: "Ready." } }, stage: "seo_review" });
  await workflow.createContentWorkflow({ topic: "Approved private article", data: { blogPostId: approved, approvedAt: new Date().toISOString(), review: { passed: true, summary: "Approved." } }, stage: "approved" });

  const listing = await blog.listPublicPosts({ page: 1, perPage: 20 });
  ok("only published posts appear in the public listing", listing.posts.length === 1 && listing.posts[0].id === published, JSON.stringify(listing.posts.map((post) => post.slug)));
  ok("published post is accessible", (await blog.getPublicPost("published-visibility-fixture"))?.post?.slug === "published-visibility-fixture");
  for (const slug of ["draft-visibility-fixture", "ready-review-visibility-fixture", "approved-visibility-fixture", "future-scheduled-visibility-fixture", "unpublished-visibility-fixture", "trashed-visibility-fixture"]) {
    ok(`private post is inaccessible: ${slug}`, (await blog.getPublicPost(slug)) === null);
  }
  const categories = await blog.listCategoriesWithCounts();
  const tags = await blog.listTags({ publicOnly: true });
  ok("category count excludes private posts", categories.find((item) => item.id === categoryId)?.count === 1, JSON.stringify(categories));
  ok("tag count excludes private posts", tags.find((item) => item.id === tagId)?.postCount === 1, JSON.stringify(tags));

  let pastScheduleRejected = false;
  try { await blog.setPostStatus(published, "scheduled", new Date(Date.now() - 60_000)); } catch { pastScheduleRejected = true; }
  ok("past scheduling is rejected", pastScheduleRejected);

  let pastCreateRejected = false;
  try {
    await blog.createPost({ ...base, title: "Past schedule fixture", slug: "past-schedule-fixture", status: "scheduled", scheduledFor: new Date(Date.now() - 60_000) });
  } catch { pastCreateRejected = true; }
  ok("past schedule cannot be created as published", pastCreateRejected);

  console.log(`RESULT pass=${passed} fail=0`);
} finally {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${db}${suffix}`, { force: true });
}
