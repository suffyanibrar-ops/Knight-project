import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { getAiTeamDashboard, type AiTeamDashboard } from "@/lib/ai-team";
import { AiTeamView } from "@/components/admin/ai-team";
import { AdminPageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Team · Admin",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function AiTeamPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  let data: AiTeamDashboard | null = null;
  if (isSqliteAvailable()) {
    try { data = await getAiTeamDashboard(); } catch { data = null; }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="AI Team"
        description="A simple overview of the helpers working on SEO, content, quality, growth and operations."
      />
      {data ? <AiTeamView data={data} /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[0.78rem] font-semibold text-amber-900">The AI team overview is temporarily unavailable. The rest of the admin system is unaffected.</div>}
    </div>
  );
}
