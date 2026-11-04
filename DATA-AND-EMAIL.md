# Data storage, email delivery and admin security

This document explains **where every piece of data goes**, so nothing is lost
silently and the deployment can be operated confidently.

---

## 1. One store, every responsibility

The application has a **single embedded SQLite database** at `SQLITE_PATH`
(default `./data/app.db`). There is no external database, no connection string,
no mirror and no fallback store.

| Store | File / service | Holds | Required? |
| --- | --- | --- | --- |
| **SQLite** | `SQLITE_PATH` (default `./data/app.db`) | Every website submission (consultation, contact, newsletter, ROI estimate), the CRM rows (`leads`, `contact_messages`), `settings` (admin password), `email_outbox`, `admin_audit`, and the editable content tables (`testimonials`, `specialties`, `case_studies`, `articles`, `faqs`) | **Yes** — there is nothing else |

The file is opened with `better-sqlite3` (WAL mode, `busy_timeout = 5000`).
Tables are created and upgraded automatically at startup through
`PRAGMA user_version` migrations — there is no separate migration command.

- `submissions`, `settings`, `subscribers` and `roi_estimates` are written with
  parameterized plain SQL helpers in `src/lib/sqlite.ts`.
- `leads`, `contact_messages`, `email_outbox`, `admin_audit`, `testimonials`,
  `specialties`, `case_studies`, `articles` and `faqs` are queried through the
  Drizzle query builder on the **same** connection (`src/db/index.ts`).

**What happens when SQLite cannot be opened** (read-only host, bad
`SQLITE_PATH`):

- Public pages still render, using the built-in content from `src/lib/site.ts`
  when the content tables cannot be read.
- `POST /api/submissions` returns **503 with an explicit message**; the
  consultation and contact forms surface that error instead of pretending to save.
- `POST /api/subscribe` and `POST /api/roi` return **503** as well.
- The CRM calls (`POST /api/leads`, `POST /api/contact`) also fail; the form only
  reports success after the primary SQLite write is accepted.
- Admin pages render a **Local database unavailable** notice explaining what to
  fix (`StorageNotice`).

There is **no SQLite → temp-directory fallback** and **no in-memory fallback**.
A failure is always reported; nothing reports success unless the SQLite write
was accepted.

For backup and restore, see **DEPLOYMENT.md §4**.

---

## 2. SQLite persistence requirements

- The directory must **exist or be creatable** and be **writable** by the app
  process. The file is created automatically on first use.
- It must **persist across restarts and redeploys**. Ephemeral container
  filesystems lose the file on every deploy.
- Keep it **out of `public/`** (or any static-served directory) and out of the
  build/release bundle — those are replaced on deploy and may be publicly served.

Working examples:

```bash
SQLITE_PATH=/var/data/app.db        # HostNext / Render / Railway persistent disk
SQLITE_PATH=/mnt/volume/app.db      # Docker / Fly.io volume
SQLITE_PATH=/data/app.db            # Kubernetes PVC
```

Not viable: a read-only image layer, `/tmp` on a serverless platform, `/proc`,
a network share, or any path inside the deployment bundle that is replaced on
release.

Because SQLite uses WAL mode, the file has `-wal`/`-shm` companions while the
app runs. For a safe online backup use
`sqlite3 "${SQLITE_PATH:-./data/app.db}" ".backup …"`; if you copy files
manually, stop the process first and copy all three. Details and the restore
procedure are in **DEPLOYMENT.md §4**.

**Startup diagnostics:** `GET /api/health` returns
`stores.sqlite.{role,available,path,driver,error}`. If `available` is `false`,
the `error` field states exactly what to fix. The same response reports the
active email channel, configuration issues and whether built-in content is
being used as a fallback.

---

## 3. Email delivery

### 3a. Resend (server-side) — the primary path

`POST /api/submissions` sends **two** emails through the Resend API for every
consultation or contact submission:

| Email | Recipient | Contents |
| --- | --- | --- |
| **Owner notification** | `ADMIN_EMAIL` (default `admin@knightmedicalbilling.com`) | every field the visitor submitted (name, email, phone, practice, specialty, facility type, providers, interests, message, source) plus the submission date; **Reply-To** is the visitor's email, so replying reaches them directly |
| **Visitor confirmation** | the address in the form's email field | a receipt of what they submitted, the submission date, and response expectations |

- `RESEND_API_KEY` is read only by server code. The browser never calls Resend
  and never receives the credential; it only posts the form to the app's API.
- `MAIL_FROM` must be an address on a domain **verified for that key** in Resend.
  An unverified/unauthorized domain fails with `403 not authorized to send
  emails from <domain>`.
- Delivery runs after the response is flushed (`after()`), so visitors never wait.
- A delivery failure never loses the enquiry: the submission is already in
  SQLite; an owner-notification failure sets `email_status` to `failed` and is
  logged.
- **Duplicate guard:** the same email + message within 10 minutes returns the
  existing submission and does **not** send a second pair of emails.
- Newsletter (`/api/subscribe`) and ROI (`/api/roi`) submissions notify the owner
  but do not send a visitor confirmation.
- Owner notifications are recorded in the SQLite `email_outbox` (`status`,
  `provider`, `attempts`, `last_error`). The admin **Email delivery** page shows
  delivery status and lets you retry queued messages or send a test email.

### 3b. SMTP fallback and no-channel behaviour

When `RESEND_API_KEY` is unset, SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`) is used with the same two-email behaviour; SMTP is also tried when
a Resend delivery fails. With neither configured, submissions are still stored
in SQLite and the owner notification is written to the outbox as **queued**
(the visitor confirmation is skipped and logged). Queued messages can be
retried after a channel is configured. `GET /api/health` reports the missing
channel.

---

## 4. Admin security model

| Control | Implementation |
| --- | --- |
| Password source | Password changed in `/admin/settings` (scrypt hash) → `ADMIN_PASSWORD` env → `ADMIN_PASSWORD_HASH` (legacy peppered digest). **There is no built-in/default password.** |
| No password configured | Sign-in is **disabled** in **every** environment (fail closed); in production `/api/health` reports a blocking error. |
| Session | HMAC-SHA256 signed token, 8-hour expiry, `HttpOnly`, `SameSite=Lax`, `Secure` in production. |
| Session secret | Set `ADMIN_SESSION_SECRET` in production. Without it a random per-process key is generated once: cookies cannot be forged, but previously issued sessions end on restart and are not shared between instances. |
| Brute force | 5 failed attempts per 15 min per IP, then blocked; attempts audit-logged (the `admin_audit` table lives in SQLite). |
| Route protection | `src/proxy.ts` (Node.js runtime) **and** a server-side session check inside every admin page and admin API route. |
| CSRF | All state-changing public APIs verify `Origin` against `Host`; cross-origin writes get **403**. Server Actions use Next.js built-in origin checks. |
| Rate limiting | Public form endpoints: 5 requests / 10 min per IP (ROI: 10). Exceeding returns **429** with `Retry-After`. |
| Duplicate submissions | Same email + identical message within 10 minutes returns the **existing** row and does not send a second pair of emails. |
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
