import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { AdminPageHeader } from "@/components/admin/ui";
import { listAdminCategories, listTags } from "@/lib/blog";
import { TaxonomyManager } from "@/components/admin/blog/taxonomy-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categories & tags · Blog",
  robots: { index: false, follow: false, nocache: true },
};

export default async function BlogTaxonomyPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  const [categories, tags] = await Promise.all([listAdminCategories(), listTags()]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Blog categories & tags"
        description="Organise articles by topic. Categories drive the public archive pages; tags power cross-links between related posts."
        actions={
          <Link
            href="/admin/blog"
            className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to posts
          </Link>
        }
      />
      <TaxonomyManager initialCategories={categories} initialTags={tags} />
    </div>
  );
}
