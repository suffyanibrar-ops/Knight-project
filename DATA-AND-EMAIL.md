# Data storage, email delivery and admin security

This document explains **where every piece of data goes**, so nothing is lost
silently and the deployment can be operated confidently.

---

## 1. Two stores, explicit responsibilities

| Store | File / service | Holds | Required? |
| --- | --- | --- | --- |
| **SQLite** | `SQLITE_PATH` (default `./data/app.db`) | Website form submissions (consultation + contact), newsletter subscribers and ROI estimates — the **source of truth** for `/admin/inbox`, `/admin/subscribers` and `/admin/estimates` | **Yes** for form capture |
| **PostgreSQL** | `DATABASE_URL` | Optional **mirror** of enquiries, subscribers and ROI estimates, plus the email outbox and the Drizzle-managed content tables (specialties, articles, FAQ) | Optional |

**Why two?** SQLite gives a zero-configuration, no-cloud store for enquiries,
opt-ins and estimates. Postgres gives a networked mirror for the CRM view,
marketing list and content that can be edited without a deploy.

**Neither silently replaces the other:**

- Postgres missing → the site renders from built-in content; SQLite still stores
  enquiries, subscribers and estimates, and the admin pages read SQLite, so
  nothing is lost or hidden.
- SQLite unavailable → `POST /api/submissions` returns **503 with an explicit
  message**; the browser then falls back to `/api/leads` (Postgres) so the lead
  is still captured. `POST /api/subscribe` and `POST /api/roi` return **503**
  too, unless Postgres accepted the write. Nothing reports success unless a
  store accepted the write.

A Postgres mirror failure is logged and never fails the request — the SQLite row
is already the durable copy.

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
- The outcome is reported back by `POST /api/submissions/email-status`. That
  callback requires the id-bound HMAC token returned by `POST /api/submissions`
  (the forms submit it automatically), so one visitor cannot alter another
  submission's status; there is no visitor-visible change and no admin session is
  needed.
- **Verified:** sending works from the browser. It cannot be tested from a
  server environment (provider policy), so confirm once from the live site.

### 3b. Server-side channel — optional, not configured yet

Configure **one** of:

```bash
RESEND_API_KEY=...          # + MAIL_FROM with a verified sending domain
# or
SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=...
```

When neither is present, `sendOwnerNotification` (with `DATABASE_URL` configured)
writes the message to the Postgres `email_outbox` table with `status = queued` and
records a setup notice on the row; nothing is delivered.

The admin **Email delivery** page surfaces the same hint and lets you retry
queued messages after configuring a channel. **No email has been claimed as
delivered** — only Web3Forms (browser-side) is active.

---

## 4. Admin security model

| Control | Implementation |
| --- | --- |
| Password source | Password changed in `/admin/settings` (scrypt hash) → `ADMIN_PASSWORD` env → `ADMIN_PASSWORD_HASH` (legacy peppered digest). **There is no built-in/default password.** |
| No password configured | Sign-in is **disabled** in **every** environment (fail closed); in production `/api/health` reports a blocking error. |
| Session | HMAC-SHA256 signed token, 8-hour expiry, `HttpOnly`, `SameSite=Lax`, `Secure` in production. |
| Session secret | Set `ADMIN_SESSION_SECRET` in production. Without it a random per-process key is generated once: cookies cannot be forged, but previously issued sessions end on restart and are not shared between instances. |
| Brute force | 5 failed attempts per 15 min per IP, then blocked; attempts audit-logged. |
| Route protection | `src/proxy.ts` (Node.js runtime) **and** a server-side session check inside every admin page and admin API route. |
| CSRF | All state-changing public APIs verify `Origin` against `Host`; cross-origin writes get **403**. Server Actions use Next.js built-in origin checks. |
| Rate limiting | Public form endpoints: 5 requests / 10 min per IP (ROI: 10). Exceeding returns **429** with `Retry-After`. |
| Duplicate submissions | Same email + identical message within 10 minutes returns the **existing** row and does not re-send email. |
| Indexing | `/admin*` and `/api/admin*` send `X-Robots-Tag: noindex` (other `/api/*` responses do not), and `/admin` and `/api` paths are disallowed in `robots.txt`. |
| Output escaping | React escapes all rendered values. No `dangerouslySetInnerHTML` on user input. |

---

## 5. Changing the admin password

1. Sign in at `/admin`.
2. Open **Settings** (`/admin/settings`).
3. Enter the current password, a new password (8+ chars, will be hashed with
   scrypt and a random salt) and confirm.

The change is stored in SQLite (`settings` table) and takes effect immediately.
To revert to the environment password, delete the `admin_password` row — the
resolution order then falls back to `ADMIN_PASSWORD`, then `ADMIN_PASSWORD_HASH`:

```sql
DELETE FROM settings WHERE key = 'admin_password';
```
