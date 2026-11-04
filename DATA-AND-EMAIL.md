# Data storage, email delivery and admin security

This document explains **where every piece of data goes**, so nothing is lost
silently and the deployment can be operated confidently.

---

## 1. Two stores, explicit responsibilities

| Store | File / service | Holds | Required? |
| --- | --- | --- | --- |
| **SQLite** | `SQLITE_PATH` (default `./data/app.db`) | Website form submissions (consultation + contact) — the **source of truth** for `/admin/inbox` | **Yes** for form capture |
| **PostgreSQL** | `DATABASE_URL` | CRM mirror of enquiries, newsletter subscribers, ROI estimates, email outbox, and the Drizzle-managed content tables (specialties, articles, FAQ) | Optional |

**Why two?** SQLite gives a zero-configuration, no-cloud store for enquiries.
Postgres gives a networked store for the CRM view, marketing list and content
that can be edited without a deploy.

**Neither silently replaces the other:**

- Postgres missing → the site renders from built-in content; SQLite still stores
  enquiries; Postgres-backed admin pages show a setup notice.
- SQLite unavailable → `POST /api/submissions` returns **503 with an explicit
  message**; the browser then falls back to `/api/leads` (Postgres) so the lead
  is still captured. Nothing reports success unless a store accepted the write.

There is **no SQLite → temp-directory fallback** and **no in-memory fallback**.
A failure is always reported.

---

## 2. SQLite persistence requirements

- The directory must **exist or be creatable** and be **writable** by the server process.
- It must **persist across restarts and redeploys**. Ephemeral container
  filesystems lose the file on every deploy.

Working examples:

```bash
SQLITE_PATH=/var/data/app.db        # Render / Railway persistent disk
SQLITE_PATH=/mnt/volume/app.db      # Docker / Fly.io volume
SQLITE_PATH=/data/app.db            # Kubernetes PVC
```

Not viable: a read-only image layer, `/tmp` on a serverless platform, `/proc`,
or any path inside the deployment bundle that is replaced on release.

**Backups:** copy `app.db` (ideally with `sqlite3 app.db ".backup backup.db"` or
while the process is stopped, since WAL mode uses `-wal`/`-shm` companions).

**Startup diagnostics:** `GET /api/health` returns
`stores.sqlite.{available,path,driver,error}`. If `available` is `false`, the
`error` field states exactly what to fix.

---

## 3. Email delivery

### 3a. Web3Forms (browser-side) — enabled, no configuration needed

`src/lib/web3forms.ts` posts directly from the visitor's browser to
`https://api.web3forms.com/submit` with the form-scoped access key.

- The access key is **public by design**; Web3Forms rejects server-IP calls and
  requires the browser. It cannot be used to read your inbox.
- Failures are logged to the browser console and recorded on the submission row
  (`email_status = failed`) — the enquiry is **never** lost because email failed.
- **Verified:** sending works from the browser. It cannot be tested from a
  server environment (provider policy), so confirm once from the live site.

### 3b. Server-side channel — optional, not configured yet

Configure **one** of:

```bash
RESEND_API_KEY=...          # + MAIL_FROM with a verified sending domain
# or
SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=...
```

When neither is present, `sendOwnerNotification` writes the message to the
Postgres `email_outbox` table with `status = queued` and logs:

```
[email] SETUP REQUIRED — no server-side email channel is configured...
```

The admin **Email delivery** page surfaces the same hint and lets you retry
queued messages after configuring a channel. **No email has been claimed as
delivered** — only Web3Forms (browser-side) is active.

---

## 4. Admin security model

| Control | Implementation |
| --- | --- |
| Password source | `ADMIN_PASSWORD` env → scrypt hash changed in `/admin/settings` → `ADMIN_PASSWORD_HASH`. **No usable default in production.** |
| Production without a password | Sign-in is **disabled**; login returns a setup error; `/api/health` reports a blocking error. |
| Session | HMAC-SHA256 signed token, 8-hour expiry, `HttpOnly`, `SameSite=Lax`, `Secure` in production. |
| Session secret | `ADMIN_SESSION_SECRET` required in production. Without it, the shared development pepper is never used to sign real sessions, so previously issued tokens are invalidated. |
| Brute force | 5 failed attempts per 15 min per IP, then blocked; attempts audit-logged. |
| Route protection | `src/proxy.ts` (edge) **and** a server-side session check inside every admin page and admin API route. |
| CSRF | All state-changing public APIs verify `Origin` against `Host`; cross-origin writes get **403**. Server Actions use Next.js built-in origin checks. |
| Rate limiting | Public form endpoints: 5 requests / 10 min per IP (ROI: 10). Exceeding returns **429** with `Retry-After`. |
| Duplicate submissions | Same email + identical message within 10 minutes returns the **existing** row and does not re-send email. |
| Indexing | `/admin*` and `/api*` send `X-Robots-Tag: noindex` and are disallowed in `robots.txt`. |
| Output escaping | React escapes all rendered values. No `dangerouslySetInnerHTML` on user input. |

---

## 5. Changing the admin password

1. Sign in at `/admin`.
2. Open **Settings** (`/admin/settings`).
3. Enter the current password, a new password (8+ chars, will be hashed with
   scrypt and a random salt) and confirm.

The change is stored in SQLite (`settings` table) and takes effect immediately.
To revert to `ADMIN_PASSWORD`, delete the `admin_password` row:

```sql
DELETE FROM settings WHERE key = 'admin_password';
```
