import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { BlogWorkspace } from "@/components/admin/blog/blog-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Blog workspace · Admin", robots: { index: false, follow: false } };

export default async function BlogWorkspacePage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  return <BlogWorkspace />;
}
