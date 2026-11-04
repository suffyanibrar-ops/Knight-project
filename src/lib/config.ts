import "server-only";

/**
 * Central production configuration + startup validation.
 *
 * The application deliberately supports TWO independent stores, and the split
 * is explicit:
 *
 *   SQLITE  (./data/app.db)  — primary store for website form submissions
 *                              (consultation + contact). Source of truth for the
 *                              /admin/inbox pages.
 *   POSTGRES (DATABASE_URL)  — optional CRM mirror + marketing list + email
 *                              outbox + Drizzle-managed content (specialties,
 *                              articles, FAQs). Enables /admin/submissions,
 *                              /admin/outbox, /admin/subscribers, /admin/estimates.
 *
 * Neither store silently replaces the other. When Postgres is absent, the
 * SQLite inbox still works and the Postgres pages show a setup notice. When
 * SQLite is unavailable, the submission API returns an explicit error (and the
 * client falls back to the Postgres route) rather than pretending to save.
 */

export const isProduction = process.env.NODE_ENV === "production";

export type Severity = "error" | "warning" | "info";
export type ConfigIssue = { key: string; severity: Severity; message: string };

function has(key: string): boolean {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0;
}

/** Absolute site URL, validated. Falls back to the production domain. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!raw) return "https://www.knightmedicalbilling.com";
  if (!/^https?:\/\//.test(raw)) return `https://${raw}`;
  return raw;
}

export function adminEmail(): string {
  return process.env.ADMIN_EMAIL?.trim() || "admin@knightmedicalbilling.com";
}

export function isPostgresConfigured(): boolean {
  return has("DATABASE_URL");
}

/** True when a server-side email channel (Resend or SMTP) is configured. */
export function isServerEmailConfigured(): boolean {
  return has("RESEND_API_KEY") || has("SMTP_HOST");
}

/** True when an admin password has been explicitly supplied. */
export function hasConfiguredAdminPassword(): boolean {
  return has("ADMIN_PASSWORD") || has("ADMIN_PASSWORD_HASH");
}

/**
 * Collects configuration problems. Used by /api/health and the admin settings
 * page so operators get an explicit setup error instead of silent degradation.
 */
export function configIssues(): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  // --- Admin password -------------------------------------------------------
  if (!hasConfiguredAdminPassword()) {
    issues.push({
      key: "ADMIN_PASSWORD",
      severity: isProduction ? "error" : "warning",
      message: isProduction
        ? "ADMIN_PASSWORD is not set. Admin sign-in is DISABLED in production until a password is configured."
        : "ADMIN_PASSWORD is not set. A development-only default is in use — set ADMIN_PASSWORD before deploying.",
    });
  } else if (has("ADMIN_PASSWORD") && (process.env.ADMIN_PASSWORD ?? "").length < 12) {
    issues.push({ key: "ADMIN_PASSWORD", severity: "warning", message: "ADMIN_PASSWORD is shorter than 12 characters. Use a longer passphrase." });
  }

  // --- Session secret -------------------------------------------------------
  if (!has("ADMIN_SESSION_SECRET")) {
    issues.push({
      key: "ADMIN_SESSION_SECRET",
      severity: isProduction ? "error" : "warning",
      message: "ADMIN_SESSION_SECRET is not set. Sessions are signed with a shared development secret; set a long random value in production.",
    });
  } else if ((process.env.ADMIN_SESSION_SECRET ?? "").length < 32) {
    issues.push({ key: "ADMIN_SESSION_SECRET", severity: "warning", message: "ADMIN_SESSION_SECRET should be at least 32 characters." });
  }

  // --- Site URL -------------------------------------------------------------
  if (!has("NEXT_PUBLIC_SITE_URL")) {
    issues.push({
      key: "NEXT_PUBLIC_SITE_URL",
      severity: "warning",
      message: "NEXT_PUBLIC_SITE_URL is not set. Canonical URLs and the sitemap use https://www.knightmedicalbilling.com.",
    });
  } else {
    const url = siteUrl();
    if (!url.startsWith("https://") && isProduction) {
      issues.push({ key: "NEXT_PUBLIC_SITE_URL", severity: "warning", message: "NEXT_PUBLIC_SITE_URL should use https:// in production." });
    }
    if (/localhost|127\.0\.0\.1/.test(url)) {
      issues.push({ key: "NEXT_PUBLIC_SITE_URL", severity: "error", message: "NEXT_PUBLIC_SITE_URL points at localhost — canonical URLs and the sitemap would be wrong." });
    }
  }

  // --- Database -------------------------------------------------------------
  if (!isPostgresConfigured()) {
    issues.push({
      key: "DATABASE_URL",
      severity: "warning",
      message: "Postgres is not configured. Website enquiries are still stored in SQLite; the Postgres admin pages stay disabled.",
    });
  }

  // --- Email ----------------------------------------------------------------
  if (!isServerEmailConfigured()) {
    issues.push({
      key: "RESEND_API_KEY / SMTP_HOST",
      severity: "warning",
      message: "No server-side email channel is configured. Owner notifications are queued in the outbox, not delivered. Web3Forms (client-side) is independent.",
    });
  }

  return issues;
}

export function hasBlockingConfigIssues(): boolean {
  return configIssues().some((issue) => issue.severity === "error");
}

/** Compact status object for /api/health and admin diagnostics. */
export function configStatus() {
  return {
    environment: process.env.NODE_ENV ?? "development",
    siteUrl: siteUrl(),
    adminEmail: adminEmail(),
    stores: {
      sqlite: { role: "primary form storage", path: process.env.SQLITE_PATH || "./data/app.db" },
      postgres: { role: "CRM mirror, content, outbox", configured: isPostgresConfigured() },
    },
    email: {
      web3forms: "client-side (public access key)",
      serverChannel: isServerEmailConfigured() ? (has("RESEND_API_KEY") ? "resend" : "smtp") : "not-configured",
    },
    adminPasswordConfigured: hasConfiguredAdminPassword(),
    issues: configIssues(),
  };
}
