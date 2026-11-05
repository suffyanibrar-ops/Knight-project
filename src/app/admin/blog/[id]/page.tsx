import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { BlogEditor } from "@/components/admin/blog/blog-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit post · Blog",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The editor fetches the post (and taxonomy) from the guarded JSON API, so the
 * same component is used for /admin/blog/new and /admin/blog/[id].
 */
export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();

  return <BlogEditor postId={postId} />;
}
