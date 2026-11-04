import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, Inbox } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { isSqliteAvailable } from "@/lib/sqlite";
import { StorageNotice } from "@/components/admin/storage-notice";
import { AdminPageHeader } from "@/components/admin/ui";
import { LiveDashboard } from "@/components/admin/live-charts";

export const dynamic = "force-dynamic";

/**
 * Owner overview: live analytics for the SQLite-backed console.
 *
 * The page itself only performs the session check and the storage check; the
 * numbers come from the client component, which polls
 * GET /api/admin/analytics every 15 seconds so the dashboard stays live
 * without a full page reload.
 */
export default async function AdminOverviewPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description="Live analytics for the website: form submissions, newsletter opt-ins, ROI estimates and email delivery — read straight from the embedded SQLite database and refreshed automatically."
        actions={
          <>
            <Link
              href="/admin/inbox"
              className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600"
            >
              Open inbox <Inbox className="h-3.5 w-3.5" />
            </Link>
            <a
              href="/api/admin/inbox-export"
              className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
          </>
        }
      />

      <LiveDashboard />
    </div>
  );
}
