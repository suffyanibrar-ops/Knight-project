import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { isAdminAuthenticated } from "@/lib/auth";
import { isDatabaseConfigured } from "@/db";
import { OWNER_EMAIL } from "@/lib/email";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin Console",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authenticated = await isAdminAuthenticated();

  // The sign-in screen renders without the console chrome. Every admin page
  // performs its own session check as well, so a host without middleware
  // support can never expose submissions.
  if (!authenticated) return <>{children}</>;

  // Postgres-backed pages render their own inline notice when DATABASE_URL is
  // absent, so the SQLite inbox and settings remain reachable at all times.
  const showPostgresHint = !isDatabaseConfigured();

  const logout = (
    <form action={logoutAction}>
      <button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[0.7rem] font-bold text-white/80 transition-colors hover:bg-rose-500/80 hover:text-white">
        Sign out
      </button>
    </form>
  );

  return (
    <AdminShell email={OWNER_EMAIL} logout={logout}>
      {showPostgresHint && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[0.72rem] leading-relaxed text-amber-900">
          <strong>PostgreSQL not configured.</strong> The SQLite inbox and settings work normally. Add <code className="rounded bg-surface px-1 py-0.5">DATABASE_URL</code> to
          enable the Postgres-backed pages (CRM submissions, email outbox, subscribers, estimates).
        </div>
      )}
      {children}
    </AdminShell>
  );
}
