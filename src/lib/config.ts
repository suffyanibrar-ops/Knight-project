import "server-only";
import { isSqliteAvailable, sqliteStatus } from "./sqlite";

/**
 * Central production configuration + startup validation.
 *
 * The application uses a SINGLE embedded store:
 *
 *   SQLITE (SQLITE_PATH, default ./data/app.db) — website form submissions,
 *   subscribers, ROI estimates, CRM leads/contact messages, the email outbox,
 *   admin audit log and the editable content tables. There is no external
 *   database service and no DATABASE_URL.
 *
 * When the SQLite file cannot be opened (read-only host, bad path), the site
 * still renders from built-in content and the form APIs report an explicit
 * error instead of pretending to save.
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
      message:
        "ADMIN_PASSWORD is not set. Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH, or make sure a password was saved from the admin panel — otherwise admin sign-in is DISABLED.",
    });
  } else if (has("ADMIN_PASSWORD") && (process.env.ADMIN_PASSWORD ?? "").length < 12) {
    issues.push({ key: "ADMIN_PASSWORD", severity: "warning", message: "ADMIN_PASSWORD is shorter than 12 characters. Use a longer passphrase." });
  }

  // --- Session secret -------------------------------------------------------
  if (!has("ADMIN_SESSION_SECRET")) {
    issues.push({
      key: "ADMIN_SESSION_SECRET",
      severity: isProduction ? "error" : "warning",
      message: isProduction
        ? "ADMIN_SESSION_SECRET is not set. Sessions use a random per-process key: cookies cannot be forged, but sessions reset when the process restarts and are not shared between instances."
        : "ADMIN_SESSION_SECRET is not set. Sessions use a development fallback signing key; set a long random value before deploying.",
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

  // --- Local database -------------------------------------------------------
  if (!isSqliteAvailable()) {
    const status = sqliteStatus();
    issues.push({
      key: "SQLITE_PATH",
      severity: "error",
      message:
        `SQLite is not available at "${status.path}". Set SQLITE_PATH to a writable, persistent directory (for example /var/data/app.db). ` +
        (status.error ?? "Form submissions and admin data cannot be stored until this is fixed."),
    });
  }

  // --- Email ----------------------------------------------------------------
  if (!isServerEmailConfigured()) {
    issues.push({
      key: "RESEND_API_KEY / SMTP_HOST",
      severity: "warning",
      message: "No server-side email channel is configured. Owner notifications and visitor confirmations cannot be delivered; submissions are still stored and the failure is logged.",
    });
  }

  return issues;
}

export function hasBlockingConfigIssues(): boolean {
  return configIssues().some((issue) => issue.severity === "error");
}

/** Compact status object for /api/health and admin diagnostics. */
export function configStatus() {
  const sqlite = sqliteStatus();
  return {
    environment: process.env.NODE_ENV ?? "development",
    siteUrl: siteUrl(),
    adminEmail: adminEmail(),
    stores: {
      sqlite: {
        role: "primary and only store (forms, CRM, outbox, audit, content)",
        available: sqlite.available,
        driver: sqlite.driver,
        path: sqlite.path,
        error: sqlite.error,
      },
    },
    email: {
      serverChannel: isServerEmailConfigured() ? (has("RESEND_API_KEY") ? "resend" : "smtp") : "not-configured",
      ownerNotifications: true,
      visitorConfirmations: true,
    },
    adminPasswordConfigured: hasConfiguredAdminPassword(),
    issues: configIssues(),
  };
}
