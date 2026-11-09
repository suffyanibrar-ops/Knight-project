import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { requireAdmin, limitAdmin } from "@/lib/api-admin";
import {
  SEO_TASK_TYPES,
  acceptOpportunityIntoWorkflow,
  getSeoAutomationDashboard,
  runSeoTask,
  setSeoSettings,
  updateOpportunityStatus,
  type SeoTaskType,
} from "@/lib/seo-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, dashboard: await getSeoAutomationDashboard() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("seo-automation", 15);
  if (limited) return limited;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const action = String(body.action ?? "");
    if (action === "run_task") {
      const task = String(body.task ?? "");
      if (!(SEO_TASK_TYPES as readonly string[]).includes(task)) return NextResponse.json({ ok: false, error: "Unknown task." }, { status: 400 });
      const result = await runSeoTask(task as SeoTaskType);
      return NextResponse.json({ ok: result.ok, result, dashboard: await getSeoAutomationDashboard() });
    }
    if (action === "accept_opportunity") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid opportunity." }, { status: 400 });
      const result = await acceptOpportunityIntoWorkflow(id);
      return NextResponse.json({ ok: true, ...result, dashboard: await getSeoAutomationDashboard() });
    }
    if (action === "opportunity_status") {
      const id = Number(body.id);
      const status = String(body.status ?? "");
      if (!Number.isInteger(id) || id <= 0 || !["new", "accepted", "dismissed"].includes(status)) return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
      await updateOpportunityStatus(id, status as "new" | "accepted" | "dismissed");
      return NextResponse.json({ ok: true, dashboard: await getSeoAutomationDashboard() });
    }
    if (action === "settings") {
      const settings = await setSeoSettings((body.settings && typeof body.settings === "object" ? body.settings : {}) as Record<string, unknown>);
      return NextResponse.json({ ok: true, settings, dashboard: await getSeoAutomationDashboard() });
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "Automation request failed." }, { status: 400 });
  }
}
