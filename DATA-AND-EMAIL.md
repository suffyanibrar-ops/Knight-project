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

### 3a. Resend (server-side) — the only delivery path

`POST /api/submissions` sends **two** emails through the Resend API for every
consultation or contact submission:

| Email | Recipient | Contents |
| --- | --- | --- |
| **Owner notification** | `ADMIN_EMAIL` (default `admin@knightmedicalbilling.com`) | every field the visitor submitted (name, email, phone, practice, specialty, facility type, providers, interests, message, source) plus the submission date; **Reply-To** is the visitor's email, so replying reaches them directly |
| **Visitor confirmation** | the address in the form's email field | a receipt of what they submitted, the submission date, and response expectations |

- `RESEND_API_KEY` is read only by server code. The browser never calls Resend
  and never receives the credential.
- `MAIL_FROM` must be an address on a domain **verified for that key** in Resend.
  An unverified/unauthorized domain fails with `403 not authorized to send
  emails from <domain>`.
- Delivery runs after the response is flushed (`after()`), so visitors never wait.
- A mail failure never loses the enquiry: the submission is already in SQLite,
  `email_status` becomes `failed`, and the error is logged.
- **Duplicate guard:** the same email + message within 10 minutes returns the
  existing submission and does **not** send a second pair of emails.
- Newsletter (`/api/subscribe`) and ROI (`/api/roi`) submissions notify the owner
  but do not send a visitor confirmation.

### 3b. Optional SMTP fallback

When `RESEND_API_KEY` is unset, SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`) is used with the same two-email behaviour. With neither configured,
submissions are still stored but nothing is delivered, and `/api/health` reports
the missing channel.

The admin **Email delivery** page shows delivery status per submission and queues
owner notifications in the Postgres outbox when `DATABASE_URL` is configured.

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
