import Link from "next/link";
import { ArrowRight, Bot, CalendarCheck, CheckCircle2, CircleDot, Inbox, LayoutDashboard, Mail, Newspaper, SearchCheck, UserRound, Users, Activity, AlertTriangle, Database, Gauge, Radar } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminOverview } from "@/lib/admin-overview";
import { AdminPageHeader, EmptyState, StatCard, formatDate } from "@/components/admin/ui";
import { StorageNotice } from "@/components/admin/storage-notice";
import { OverviewAutoRefresh } from "@/components/admin/overview-auto-refresh";
import { isSqliteAvailable } from "@/lib/sqlite";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const quickActions = [
  { label: "View enquiries", href: "/admin/inbox", icon: Inbox },
  { label: "Live Traffic", href: "/admin/traffic", icon: Activity },
  { label: "Blog Workspace", href: "/admin/blog/workspace", icon: Newspaper },
  { label: "Search visibility", href: "/admin/seo", icon: SearchCheck },
];

const moduleGuide = [
  { name: "Overview", href: "/admin", text: "The daily command center: traffic, enquiries, alerts and recent activity." },
  { name: "Live Traffic", href: "/admin/traffic", text: "Real-time visitors, pages, sources and conversion events." },
  { name: "Enquiries", href: "/admin/inbox", text: "All contact, consultation and lead messages, searchable and status-tracked." },
  { name: "AI & Conversations", href: "/admin/ai", text: "Assistant conversations, qualified leads, appointments and human handoffs." },
  { name: "Blog Workspace", href: "/admin/blog/workspace", text: "AI-assisted article planning, research, drafting, review and publishing." },
  { name: "Published Articles", href: "/admin/blog/published", text: "The live blog library; edit or unpublish any existing article." },
  { name: "SEO", href: "/admin/seo", text: "Search performance, content ideas, audits and technical findings." },
  { name: "Email / Subscribers", href: "/admin/outbox", text: "Owner notifications and newsletter sign-ups from the website." },
  { name: "Settings", href: "/admin/settings", text: "Password, storage, email, AI and booking configuration." },
];

const activityIcon = {
  enquiry: Inbox,
  ai_lead: Bot,
  appointment: CalendarCheck,
  handoff: UserRound,
  subscriber: Users,
  email: Mail,
} as const;

function statusTone(ok: boolean) {
  return ok ? "text-mint-700 bg-mint-50 border-mint-200" : "text-amber-700 bg-amber-50 border-amber-200";
}

function valueOrDash(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-US");
}

export default async function AdminOverviewPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  if (!isSqliteAvailable()) return <StorageNotice />;

  const data = await getAdminOverview();
  const { status, traffic, business, alerts, activity } = data;

  return (
    <div className="space-y-6">
      <OverviewAutoRefresh />
      <AdminPageHeader
        title="Command center"
        description="What is happening on the website, what needs attention and where visitors are turning into business. First-party traffic and business records are stored in the same application database."
        actions={
          <>
            <Link href="/admin/inbox" className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white hover:bg-brand-600">
              View enquiries <Inbox className="h-3.5 w-3.5" />
            </Link>
            <Link href="/admin/traffic" className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 hover:border-brand-300">
              Live Traffic <Activity className="h-3.5 w-3.5" />
            </Link>
          </>
        }
      />

      <details className="group rounded-2xl border border-mist-200 bg-surface">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[0.8rem] font-extrabold text-ink-900">
          <span>What each module does</span>
          <span className="text-[0.64rem] font-semibold text-ink-600/60">New here? Start with this 30-second guide</span>
        </summary>
        <div className="grid gap-2 border-t border-mist-100 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {moduleGuide.map((item) => (
            <Link key={item.name} href={item.href} className="rounded-xl border border-mist-200 bg-mist-50/50 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
              <p className="text-[0.76rem] font-extrabold text-ink-900">{item.name}</p>
              <p className="mt-1 text-[0.68rem] leading-relaxed text-ink-600/75">{item.text}</p>
            </Link>
          ))}
        </div>
      </details>

      <section aria-label="System status" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className={`rounded-2xl border p-4 ${statusTone(status.website)}`}>
          <p className="flex items-center gap-1.5 text-[0.58rem] font-extrabold uppercase tracking-[0.14em] opacity-70"><CircleDot className="h-3 w-3" /> Website</p>
          <p className="mt-2 text-[0.92rem] font-extrabold">Responding</p>
          <p className="mt-1 text-[0.66rem] opacity-65">Admin page and server are reachable.</p>
        </div>
        <div className={`rounded-2xl border p-4 ${statusTone(status.database.available)}`}>
          <p className="flex items-center gap-1.5 text-[0.58rem] font-extrabold uppercase tracking-[0.14em] opacity-70"><Database className="h-3 w-3" /> Database</p>
          <p className="mt-2 text-[0.92rem] font-extrabold">{status.database.available ? "SQLite ready" : "Unavailable"}</p>
          <p className="mt-1 text-[0.66rem] opacity-65">{status.database.driver ? `${status.database.driver} · single database` : "Storage warning"}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${statusTone(status.email.configured)}`}>
          <p className="flex items-center gap-1.5 text-[0.58rem] font-extrabold uppercase tracking-[0.14em] opacity-70"><Mail className="h-3 w-3" /> Email</p>
          <p className="mt-2 text-[0.92rem] font-extrabold">{status.email.configured ? "Configured" : "Not configured"}</p>
          <p className="mt-1 text-[0.66rem] opacity-65">{status.email.channels.length ? status.email.channels.join(" · ") : "Submissions still save"}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${statusTone(status.ai.configured && status.ai.enabled)}`}>
          <p className="flex items-center gap-1.5 text-[0.58rem] font-extrabold uppercase tracking-[0.14em] opacity-70"><Bot className="h-3 w-3" /> AI agent</p>
          <p className="mt-2 text-[0.92rem] font-extrabold">{!status.ai.configured ? "No API key" : status.ai.enabled ? "Online" : "Disabled"}</p>
          <p className="mt-1 text-[0.66rem] opacity-65">DeepSeek · browser voice</p>
        </div>
        <div className={`rounded-2xl border p-4 ${statusTone(status.analytics.enabled && status.database.available)}`}>
          <p className="flex items-center gap-1.5 text-[0.58rem] font-extrabold uppercase tracking-[0.14em] opacity-70"><Gauge className="h-3 w-3" /> Analytics</p>
          <p className="mt-2 text-[0.92rem] font-extrabold">{status.analytics.enabled ? "First-party live" : "Unavailable"}</p>
          <p className="mt-1 text-[0.66rem] opacity-65">SQLite · {status.analytics.retentionDays}-day retention</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <section>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Business snapshot</p>
                <h2 className="mt-1 text-[1.05rem] font-extrabold tracking-tight text-ink-950">Today at a glance</h2>
              </div>
              <Link href="/admin/traffic" className="inline-flex items-center gap-1 text-[0.7rem] font-bold text-brand-700 hover:text-brand-500">Traffic detail <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Visitors today" value={valueOrDash(traffic.visitorsToday)} hint={traffic.visitorsToday === null ? "Analytics unavailable" : "First-party · unique visitors"} tone={traffic.visitorsToday === null ? "warn" : "brand"} />
              <StatCard label="Online now" value={valueOrDash(traffic.activeNow)} hint={traffic.activeNow === null ? "Realtime unavailable" : "Active in last 5 min · 8s polling"} tone={traffic.activeNow === null ? "warn" : "good"} />
              <StatCard label="Enquiries today" value={business.enquiriesToday} hint={`${business.enquiries} in last 7 days`} tone={business.enquiriesToday ? "good" : "default"} />
              <StatCard label="AI-qualified leads" value={business.aiLeads} hint="Last 7 days · SQLite" tone={business.aiLeads ? "brand" : "default"} />
              <StatCard label="Upcoming appointments" value={business.appointmentsUpcoming} hint="Confirmed · local calendar" tone={business.appointmentsUpcoming ? "good" : "default"} />
              <StatCard label="Email issues" value={business.emailIssues} hint={`${business.emailQueued} queued · ${business.emailSent} delivered in 7 days`} tone={business.emailIssues ? "warn" : "good"} />
            </div>
          </section>

          <section className="rounded-2xl border border-mist-200 bg-surface">
            <div className="flex items-center justify-between border-b border-mist-100 px-4 py-3">
              <div>
                <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Recent activity</p>
                <h2 className="mt-0.5 text-[0.95rem] font-extrabold tracking-tight text-ink-950">Across the business</h2>
              </div>
              <span className="text-[0.64rem] font-semibold text-ink-600/55">Latest {activity.length}</span>
            </div>
            {activity.length === 0 ? (
              <div className="p-6"><EmptyState title="No activity yet" description="Enquiries, AI leads, appointments, handoffs and email events will appear here as visitors use the site." /></div>
            ) : (
              <ul className="divide-y divide-mist-100">
                {activity.map((item) => {
                  const Icon = activityIcon[item.kind];
                  return (
                    <li key={item.id}>
                      <Link href={item.href} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-mist-50/70">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.78rem] font-extrabold text-ink-900">{item.title}</span>
                          <span className="mt-0.5 block truncate text-[0.7rem] text-ink-600/75">{item.detail}</span>
                        </span>
                        <span className="shrink-0 text-[0.62rem] font-semibold text-ink-600/55">{formatDate(new Date(item.at))}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-mist-200 bg-surface">
            <div className="flex items-center justify-between border-b border-mist-100 px-4 py-3">
              <div>
                <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Attention required</p>
                <h2 className="mt-0.5 text-[0.95rem] font-extrabold tracking-tight text-ink-950">What needs a decision</h2>
              </div>
              {alerts.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.62rem] font-extrabold text-amber-700">{alerts.length}</span>}
            </div>
            {alerts.length === 0 ? (
              <div className="p-4">
                <p className="flex items-center gap-2 rounded-xl border border-mint-200 bg-mint-50 p-3 text-[0.78rem] font-semibold text-mint-800"><CheckCircle2 className="h-4 w-4 shrink-0" /> No urgent items right now.</p>
              </div>
            ) : (
              <ul className="divide-y divide-mist-100">
                {alerts.map((alert) => (
                  <li key={alert.key} className="px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${alert.tone === "bad" ? "text-rose-600" : alert.tone === "warn" ? "text-amber-600" : "text-brand-600"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.78rem] font-extrabold text-ink-900">{alert.title}</p>
                        <p className="mt-0.5 text-[0.7rem] leading-relaxed text-ink-600/75">{alert.detail}</p>
                        <Link href={alert.href} className="mt-1.5 inline-flex items-center gap-1 text-[0.68rem] font-extrabold text-brand-700 hover:text-brand-500">{alert.action} <ArrowRight className="h-3 w-3" /></Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-brand-700">Quick actions</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href} className="group flex items-center gap-2 rounded-xl border border-mist-200 bg-mist-50/60 px-3 py-2.5 text-[0.7rem] font-bold text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-800">
                  <action.icon className="h-3.5 w-3.5 text-brand-700" /> <span className="min-w-0 truncate">{action.label}</span>
                </Link>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[0.62rem] leading-relaxed text-ink-600/55"><Radar className="h-3 w-3" /> Last refreshed {formatDate(new Date(data.checkedAt))}. Auto-refreshes every 60 seconds while this tab is visible.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
