import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { SeoAudit } from "@/components/admin/seo/seo-audit";
import { SeoControlCenter } from "@/components/admin/seo/seo-control-center";
import { SearchConsoleConnection } from "@/components/admin/seo/search-console-connection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SEO health · Admin Console",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function SeoHealthPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="SEO"
        description="Find topics, audit the site, and keep content fresh. You stay in control of every article."
      />
      <SeoControlCenter />
      <SearchConsoleConnection />
      <details className="group rounded-2xl border border-mist-200 bg-surface">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3.5 text-[0.76rem] font-extrabold text-ink-800">
          Advanced: full technical crawl
          <span className="text-[0.64rem] font-semibold text-ink-600/55">Run a deeper manual audit</span>
        </summary>
        <div className="border-t border-mist-100 p-4">
          <SeoAudit />
        </div>
      </details>
    </div>
  );
}
