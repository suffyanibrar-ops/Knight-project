import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAdminAuthenticated } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/ui";
import { SeoAudit } from "@/components/admin/seo/seo-audit";
import { SeoControlCenter } from "@/components/admin/seo/seo-control-center";

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
        title="SEO Control Center"
        description="Live research opportunities, scheduled automation, technical audits and performance readiness in one admin area."
      />
      <SeoControlCenter />
      <SeoAudit />
    </div>
  );
}
