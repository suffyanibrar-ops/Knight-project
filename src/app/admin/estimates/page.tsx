import { Download } from "lucide-react";
import { isSqliteAvailable, listRoiEstimates, parseSqliteDate } from "@/lib/sqlite";
import { AdminPageHeader, EmptyState, StatCard, formatDate } from "@/components/admin/ui";

import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { StorageNotice } from "@/components/admin/storage-notice";

export const dynamic = "force-dynamic";

/** The shape this page renders. */
type EstimateRecord = {
  id: number;
  email: string | null;
  monthlyCollections: number;
  denialRate: number;
  daysInAr: number;
  estimatedAnnualUplift: number;
  emailStatus: string;
  createdAt: Date | null;
};

/** ROI calculator submissions live only in the embedded SQLite file. */
function loadEstimates(): EstimateRecord[] {
  return listRoiEstimates().map((row) => ({
    id: row.id,
    email: row.email,
    monthlyCollections: row.monthly_collections,
    denialRate: row.denial_rate,
    daysInAr: row.days_in_ar,
    estimatedAnnualUplift: row.estimated_annual_uplift,
    emailStatus: row.email_status,
    createdAt: parseSqliteDate(row.created_at),
  }));
}

function money(value: number) {
  return `$${value.toLocaleString("en-US")}`;
}

export default async function EstimatesPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;
  const rows = loadEstimates();
  const withEmail = rows.filter((row) => row.email).length;
  const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.estimatedAnnualUplift, 0) / rows.length) : 0;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="ROI Opportunities"
        description="Calculator completions, visitor inputs and modelled annual opportunity. These are illustrative models, not guaranteed revenue. Contacts captured here are also emailed to the owner inbox."
        actions={
          <a href="/api/admin/export?type=estimates" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Calculations" value={rows.length} tone="brand" />
        <StatCard label="With contact email" value={withEmail} hint="Follow-up ready" tone="good" />
        <StatCard label="Average modelled opportunity" value={money(avg)} hint="Illustrative annual uplift · not a guarantee" />
      </div>

      <p className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-[0.72rem] leading-relaxed text-amber-900/80"><strong>Modeled / illustrative opportunity:</strong> the calculator applies assumptions to the visitor&apos;s inputs. Actual results depend on specialty, payer mix, claim volume, current processes and reimbursement. Nothing on this page is a guarantee of revenue.</p>

      {rows.length === 0 ? (
        <EmptyState title="No estimates yet" description="When a visitor completes the ROI calculator, the inputs appear here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-mist-200 bg-mist-50/70">
                  {["Created", "Email", "Monthly collections", "Denial rate", "Days in A/R", "Annual opportunity", "Owner notified"].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/80">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-mist-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 text-[0.68rem] text-ink-600/80">{formatDate(row.createdAt)}</td>
                    <td className="break-all px-3 py-2.5 text-[0.72rem] text-ink-800">{row.email ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[0.72rem] font-semibold text-ink-900">{money(row.monthlyCollections)}</td>
                    <td className="px-3 py-2.5 text-[0.72rem] text-ink-700">{row.denialRate}%</td>
                    <td className="px-3 py-2.5 text-[0.72rem] text-ink-700">{row.daysInAr}</td>
                    <td className="px-3 py-2.5 text-[0.72rem] font-extrabold text-mint-700">{money(row.estimatedAnnualUplift)}</td>
                    <td className="px-3 py-2.5 text-[0.7rem] capitalize text-ink-700">{row.emailStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
