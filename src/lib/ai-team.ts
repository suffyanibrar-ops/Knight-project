import "server-only";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, contactMessages, contentWorkflows, leads, seoAuditRuns, seoAutomationRuns, seoOpportunities } from "@/db/schema";
import { getAnalyticsSnapshot, resolveAnalyticsRange } from "./analytics";
import { jiroHealth } from "./jiro-client";
import { getSeoSettings } from "./seo-automation";

export type TeamRoleKey = "seo" | "content" | "quality" | "growth" | "operations";

export type TeamRole = {
  key: TeamRoleKey;
  name: string;
  job: string;
  status: "ready" | "review" | "attention" | "unavailable";
  statusLabel: string;
  metrics: { label: string; value: string }[];
  action: { label: string; href: string };
};

export type TeamFocus = { label: string; detail: string; href: string };

export type TeamActivity = { title: string; detail: string; when: string; tone: "good" | "warn" | "muted" };

export type AiTeamDashboard = {
  roles: TeamRole[];
  focus: TeamFocus[];
  activity: TeamActivity[];
  analyticsAvailable: boolean;
  updatedAt: string;
};

function safeDate(value: Date | null | undefined): string {
  return value ? value.toISOString() : new Date(0).toISOString();
}

function relative(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "No activity yet";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

async function safeCount(query: Promise<{ value: number }[]>): Promise<number> {
  try { return Number((await query)[0]?.value ?? 0); } catch { return 0; }
}

export async function getAiTeamDashboard(): Promise<AiTeamDashboard> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  let analytics = { available: false, totals: { sessions: 0 } };
  try { analytics = getAnalyticsSnapshot(resolveAnalyticsRange("7d", null, null)); } catch { /* keep unavailable */ }

  const [
    newIdeas,
    draftWorkflows,
    approvedWorkflows,
    draftPosts,
    scheduledPosts,
    publishedPosts,
    leadsThisWeek,
    messagesThisWeek,
    latestAuditRows,
    latestRuns,
    workflowActivity,
    postActivity,
    health,
    settings,
  ] = await Promise.all([
    safeCount(db.select({ value: count() }).from(seoOpportunities).where(eq(seoOpportunities.status, "new"))),
    safeCount(db.select({ value: count() }).from(contentWorkflows).where(eq(contentWorkflows.stage, "topic_plan"))),
    safeCount(db.select({ value: count() }).from(contentWorkflows).where(eq(contentWorkflows.stage, "approved"))),
    safeCount(db.select({ value: count() }).from(blogPosts).where(and(eq(blogPosts.status, "draft"), isNull(blogPosts.deletedAt)))),
    safeCount(db.select({ value: count() }).from(blogPosts).where(eq(blogPosts.status, "scheduled"))),
    safeCount(db.select({ value: count() }).from(blogPosts).where(eq(blogPosts.status, "published"))),
    safeCount(db.select({ value: count() }).from(leads).where(gte(leads.createdAt, weekAgo))),
    safeCount(db.select({ value: count() }).from(contactMessages).where(gte(contactMessages.createdAt, weekAgo))),
    db.select().from(seoAuditRuns).orderBy(desc(seoAuditRuns.startedAt)).limit(1).catch(() => []),
    db.select().from(seoAutomationRuns).orderBy(desc(seoAutomationRuns.startedAt)).limit(8).catch(() => []),
    db.select({ id: contentWorkflows.id, topic: contentWorkflows.topic, stage: contentWorkflows.stage, updatedAt: contentWorkflows.updatedAt }).from(contentWorkflows).orderBy(desc(contentWorkflows.updatedAt)).limit(5).catch(() => []),
    db.select({ id: blogPosts.id, title: blogPosts.title, status: blogPosts.status, updatedAt: blogPosts.updatedAt }).from(blogPosts).orderBy(desc(blogPosts.updatedAt)).limit(5).catch(() => []),
    jiroHealth(2_500),
    getSeoSettings(),
  ]);

  const latestAudit = latestAuditRows[0] ?? null;
  const auditIssues = (() => { try { return latestAudit ? (JSON.parse(latestAudit.issuesJson) as unknown[]).length : 0; } catch { return 0; } })();
  const failedRuns = latestRuns.filter((run) => run.status === "failed").length;
  const automationOn = settings.enabled === "true";
  const hasAnalytics = Boolean(analytics.available);
  const sessions = hasAnalytics ? Number(analytics.totals.sessions ?? 0) : 0;
  const leadsCount = leadsThisWeek + messagesThisWeek;

  const roles: TeamRole[] = [
    {
      key: "seo",
      name: "SEO Manager",
      job: "Finds useful topics and watches search health.",
      status: newIdeas > 0 ? "review" : "ready",
      statusLabel: newIdeas > 0 ? `${newIdeas} idea${newIdeas === 1 ? "" : "s"} to review` : "Monitoring",
      metrics: [
        { label: "New ideas", value: String(newIdeas) },
        { label: "Automation", value: automationOn ? "On" : "Paused" },
      ],
      action: { label: "Open SEO", href: "/admin/seo" },
    },
    {
      key: "content",
      name: "Content Editor",
      job: "Moves approved ideas into clear, review-ready articles.",
      status: draftWorkflows + draftPosts + approvedWorkflows > 0 ? "review" : "ready",
      statusLabel: draftWorkflows + draftPosts + approvedWorkflows > 0 ? "Needs a review" : "Ready",
      metrics: [
        { label: "In the pipeline", value: String(draftWorkflows + draftPosts + approvedWorkflows) },
        { label: "Scheduled", value: String(scheduledPosts) },
      ],
      action: { label: "Open Content Studio", href: "/admin/content" },
    },
    {
      key: "quality",
      name: "QA Reviewer",
      job: "Checks the site and articles before they go live.",
      status: auditIssues > 0 ? "attention" : "ready",
      statusLabel: auditIssues > 0 ? `${auditIssues} issue${auditIssues === 1 ? "" : "s"} to check` : "All clear",
      metrics: [
        { label: "Last audit", value: latestAudit ? `${latestAudit.pagesChecked} pages` : "Not run" },
        { label: "Issues", value: String(auditIssues) },
      ],
      action: { label: "Review quality", href: "/admin/seo" },
    },
    {
      key: "growth",
      name: "Growth Analyst",
      job: "Watches traffic, enquiries and conversion signals.",
      status: hasAnalytics ? "ready" : "unavailable",
      statusLabel: hasAnalytics ? `${sessions} visit${sessions === 1 ? "" : "s"} this week` : "Traffic data unavailable",
      metrics: [
        { label: "Sessions (7d)", value: hasAnalytics ? String(sessions) : "—" },
        { label: "New enquiries (7d)", value: String(leadsCount) },
      ],
      action: { label: "Open Live Traffic", href: "/admin/traffic" },
    },
    {
      key: "operations",
      name: "Operations Monitor",
      job: "Keeps research and automation running in the background.",
      status: !health.ok || failedRuns > 0 ? "attention" : "ready",
      statusLabel: !health.ok ? "Research engine needs attention" : failedRuns > 0 ? `${failedRuns} failed check${failedRuns === 1 ? "" : "s"}` : "All systems ready",
      metrics: [
        { label: "Research engine", value: health.ok ? "Ready" : "Offline" },
        { label: "Automation", value: automationOn ? "Running" : "Paused" },
      ],
      action: { label: "Open settings", href: "/admin/settings" },
    },
  ];

  const focus: TeamFocus[] = [];
  if (newIdeas > 0) focus.push({ label: "Choose the next topic", detail: `${newIdeas} new content idea${newIdeas === 1 ? "" : "s"} ready for your review.`, href: "/admin/seo" });
  if (draftWorkflows + draftPosts + approvedWorkflows > 0) focus.push({ label: "Review the content queue", detail: `${draftWorkflows + draftPosts + approvedWorkflows} item${draftWorkflows + draftPosts + approvedWorkflows === 1 ? "" : "s"} need a human decision.`, href: "/admin/content" });
  if (auditIssues > 0) focus.push({ label: "Fix a site issue", detail: `${auditIssues} issue${auditIssues === 1 ? "" : "s"} found in the latest audit.`, href: "/admin/seo" });
  if (scheduledPosts > 0) focus.push({ label: "Check scheduled content", detail: `${scheduledPosts} article${scheduledPosts === 1 ? "" : "s"} queued to publish.`, href: "/admin/blog" });
  if (!focus.length) focus.push({ label: "Start a fresh research pass", detail: "Ask the SEO Manager to find new opportunities.", href: "/admin/seo" });

  const activities: TeamActivity[] = [
    ...latestRuns.map((run) => ({
      title: run.taskType === "technical_audit" ? "SEO audit" : run.taskType === "opportunity_discovery" ? "Opportunity research" : "Content review",
      detail: run.status === "failed" ? "Needs attention" : run.status === "completed" ? "Completed" : "Running",
      when: safeDate(run.startedAt),
      tone: run.status === "failed" ? "warn" as const : run.status === "completed" ? "good" as const : "muted" as const,
    })),
    ...workflowActivity.map((item) => ({ title: item.topic, detail: `Content workflow · ${item.stage.replaceAll("_", " ")}`, when: safeDate(item.updatedAt), tone: item.stage === "approved" ? "good" as const : "muted" as const })),
    ...postActivity.map((item) => ({ title: item.title, detail: `Blog post · ${item.status}`, when: safeDate(item.updatedAt), tone: item.status === "published" ? "good" as const : "muted" as const })),
  ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()).slice(0, 4).map((item) => ({ ...item, when: relative(item.when) }));

  return {
    roles,
    focus: focus.slice(0, 2),
    activity: activities,
    analyticsAvailable: hasAnalytics,
    updatedAt: new Date().toISOString(),
  };
}
