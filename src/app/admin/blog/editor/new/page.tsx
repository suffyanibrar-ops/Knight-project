import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { BlogEditor } from "@/components/admin/blog/blog-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New article · Blog editor", robots: { index: false, follow: false, nocache: true } };

export default async function NewBlogPostPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;
  return <BlogEditor />;
}
