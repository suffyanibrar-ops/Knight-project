import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { BlogEditor } from "@/components/admin/blog/blog-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog editor · Admin",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Dedicated blog editor. It is intentionally separate from the workspace: the
 * workspace plans work, this module writes and publishes a single article.
 */
export default async function BlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();

  return <BlogEditor postId={postId} />;
}
