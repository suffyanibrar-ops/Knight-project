# Deployment guide — Knight Medical Billing

A **full-stack Next.js 16 (App Router)** application with route handlers, server actions, middleware
(`proxy.ts`), Drizzle ORM and **one embedded SQLite database**. It is **not** a static site and must
not be exported statically — the admin console, form APIs and SQLite file all require a server
runtime with a writable disk.

Any Node.js 22 host works: a VPS, a container, HostNext, Render, Railway, Fly.io, Google Cloud Run
or Google AI Studio — provided the host gives the app a writable **persistent** disk (see §6).

---

## 1. Build and run

```bash
npm install
npm run build
npm run start        # honours PORT; binds 0.0.0.0 by default
```

`npm run dev` starts the development server on `http://localhost:3000`.

`.env` is git-ignored; only `.env.example` is committed. Never commit credentials.

---

## 2. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SQLITE_PATH` | Required in production | Path to the SQLite file. Defaults to `./data/app.db`; in production use an absolute path on a persistent volume, e.g. `/var/data/app.db` |
| `ADMIN_PASSWORD` | For admin sign-in | Password for `/admin`; with no password from this var, a panel change or `ADMIN_PASSWORD_HASH`, sign-in is disabled (fail closed) |
| `ADMIN_PASSWORD_HASH` | Optional | Legacy peppered digest (`sha256(ADMIN_SESSION_SECRET + password)`), used only after a panel password and `ADMIN_PASSWORD`; requires the same `ADMIN_SESSION_SECRET` used to derive it |
| `ADMIN_SESSION_SECRET` | Required in production | Signs admin session cookies; without it production uses a random per-process key (sessions reset on restart, not shared between instances) |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Absolute site URL for canonical tags, sitemap, Open Graph, emails |
| `RESEND_API_KEY` | For email delivery | Server-side Resend key. Never exposed to the browser; without it no email is sent |
| `MAIL_FROM` | For email delivery | Sender identity; the domain must be verified for that key (default `Knight Medical Billing <website@knightmedicalbilling.com>`) |
| `ADMIN_EMAIL` | Optional | Owner inbox for notifications (default `admin@knightmedicalbilling.com`) |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Optional | SMTP fallback, tried when `RESEND_API_KEY` is unset or a Resend delivery fails |
| `TRUST_PROXY` | Optional | Default `1` = one trusted reverse proxy (last `X-Forwarded-For` hop is used for limits/audit). `0` = directly exposed, header ignored |
| `IMAGES_UNOPTIMIZED` | Optional | `1` serves original images when the host cannot run the `sharp` optimiser |

---

## 3. Embedded SQLite — the only store

The database is a single file, opened with `better-sqlite3`. There is no external
database, no connection string and no migration CLI.

- `SQLITE_PATH` is resolved from the project root when relative; absolute paths are recommended
  in production. The file, directories and tables are created automatically on first use.
- Schema changes are applied at startup as `PRAGMA user_version` migrations; existing rows are
  preserved.
- Runtime pragmas: `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON`,
  `synchronous = NORMAL`.
- Tables: `submissions`, `settings`, `subscribers`, `roi_estimates` (plain-SQL helpers) and
  `leads`, `contact_messages`, `email_outbox`, `admin_audit`, `testimonials`, `specialties`,
  `case_studies`, `articles`, `faqs` (Drizzle query builder on the same file).

API: `POST /api/submissions` (public, validated) · `GET /api/submissions` (admin) ·
`POST /api/leads` and `POST /api/contact` (CRM copies written by the forms) ·
`POST /api/subscribe` (newsletter) · `POST /api/roi` (ROI calculator) · `GET /api/health` ·
`GET /api/admin/inbox-export` (admin CSV) · `GET /api/admin/export?type=…` (admin CSV:
`leads`, `contacts`, `subscribers`, `estimates`, `outbox`).

**It must be a writable, persistent directory.** On ephemeral filesystems (serverless
functions, a fresh container on every request) the file is lost on each deploy, the admin
pages show a storage notice and the form APIs return an explicit error. There is no
fallback to a temporary directory.

**Do not put the database under `public/` or any static-served directory** — that can make the
file downloadable, and those directories are replaced on deploy. Not viable: a read-only image
layer, `/tmp`, `/proc`, a network share, or a path inside the build output.

**Content seeding (optional):** `npm run seed` upserts specialties, articles and FAQs from
`src/lib/site.ts` into SQLite. Public pages fall back to that same built-in content when the
tables are empty, so seeding is safe to run at any time and can be skipped.

**Health:** `GET /api/health` returns `ok: true` only when the SQLite file opens and answers a
query. It reports `stores.sqlite.{role,available,path,driver,error}`, the email channel status,
config issues, `fallbackContent`, environment, site URL and a timestamp.

---

## 4. Backup and restore

The SQLite file is the whole database — every submission, admin record and content
row. Back it up on a regular schedule and treat the backup as sensitive: it contains
form submissions and contact details.

**Safe online backup (WAL-safe, no downtime):**

```bash
mkdir -p /var/backups/knight
sqlite3 "${SQLITE_PATH:-./data/app.db}" ".backup '/var/backups/knight/app-$(date +%F-%H%M).db'"
```

If the `sqlite3` CLI is not installed, stop the app process and copy the file together with its
WAL companions — copying `app.db` alone while the app is running can miss committed pages:

```bash
cp app.db app.db-wal app.db-shm /var/backups/knight/
```

Keep backups off the host (object storage or another volume) and test a restore before you rely
on it.

**Restore:**

1. Stop the app process.
2. Copy the backup over `SQLITE_PATH`.
3. Remove any stale `app.db-wal` / `app.db-shm` files from the target directory.
4. `chown` the file and directory to the user that runs the app.
5. Start the app and verify `GET /api/health` reports `stores.sqlite.available: true`; check the
   admin pages for expected row counts.

**Routine:** back up before every deploy and keep at least one pre-migration copy so a failed
import or upgrade can be rolled back by restoring the previous file.

---

## 5. One-time import from an old PostgreSQL deployment

If this site previously ran on PostgreSQL, its data is imported once. The import
script is dependency-free (it reads the CSV files — no database driver) and
idempotent, so existing SQLite rows are preserved.

1. Export the 11 tables to CSV on the old Postgres host (the old connection URL is used only
   for this export):

   ```bash
   mkdir -p pg-dump
   for t in leads contact_messages subscribers roi_estimates email_outbox \
            admin_audit testimonials specialties case_studies articles faqs; do
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
       -c "\copy $t TO 'pg-dump/$t.csv' CSV HEADER"
   done
   ```

2. Import into the SQLite file selected by `SQLITE_PATH`. The script creates the file, its
   directory and the full schema if they do not exist yet, so the app does not have to have
   booted first:

   ```bash
   npm run db:import-postgres -- pg-dump
   ```

3. Verify row counts in the admin console. Re-running the import is safe: it skips existing
   rows and logs any row it could not map. After verification the old connection string is no
   longer needed — the application only ever reads SQLite.

---

## 6. HostNext / Node hosting notes

- Run the app as a **Node 22** service (`.nvmrc` is `22`): `npm install`, `npm run build`,
  `npm run start`. The platform's `PORT` is honoured automatically.
- Attach a **persistent disk** (volume) and set `SQLITE_PATH` to a file on it
  (e.g. `/var/data/app.db`). The directory must be writable by the service user and survive
  redeploys. If the volume is not mounted, the app still opens a fresh file inside the deployment
  directory — data is silently lost on the next release. Verify `stores.sqlite.path` in
  `GET /api/health` points at the volume after the first deploy.
- `better-sqlite3` is a **native module**. It ships prebuilt binaries for common Node ABIs and
  platforms; use a supported Node 22 x64/arm64 build. If `npm install` compiles from source or
  the app reports a `NODE_MODULE_VERSION` mismatch, run `npm rebuild better-sqlite3` using the
  same Node executable that runs the app.
- Do **not** deploy to a read-only/serverless filesystem (static hosting, Vercel serverless,
  Netlify functions, Cloudflare Workers). These have no durable local disk; use HostNext, a VPS,
  a container with a volume, or Cloud Run with a mounted volume.
- Run **one app instance** per SQLite file. WAL allows concurrent readers, but writes are
  serialised; do not point multiple replicas at the same file over NFS or a network share.
- Keep the database outside `public/` and back up the volume (§4).

---

## 7. Images

`next/image` is used throughout. Local assets live in `public/images`. External images are
allow-listed in `next.config.ts`:

```ts
images: { remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }] }
```

`sharp` is a production dependency, so the optimizer works on any Node host. Hosts with an
image-optimization service (Vercel, Netlify) use it automatically.

---

## 8. Admin console

- URL: `/admin` → redirects to `/admin/login`
- Password resolution: (1) password changed in **Settings** (scrypt hash in SQLite),
  (2) `ADMIN_PASSWORD` env var, (3) `ADMIN_PASSWORD_HASH` (legacy peppered digest).
  There is **no built-in/default password**: when none of these is configured, sign-in is
  disabled in **every** environment (fail closed).
- Sessions: signed HttpOnly cookie, 8-hour expiry, verified in `src/proxy.ts` **and** in every
  admin page. `ADMIN_SESSION_SECRET` should be set in production; without it a random
  per-process key is generated, so cookies cannot be forged, but sessions reset on restart and
  are not shared between multiple instances.
- Brute-force protection: 5 attempts / 15 minutes per IP, all attempts audit-logged.
- Pages: overview, SQLite inbox, submissions (status pipeline, search, CSV export), email
  outbox (retry + test email), subscribers, ROI estimates, settings.

---

## 9. Email notifications

**Resend (server-side):** every consultation and contact submission sends two
emails from `POST /api/submissions`:

- an **owner notification** to `ADMIN_EMAIL` with **Reply-To** set to the
  visitor's address, containing every submitted field plus the submission time;
- a **visitor confirmation** to the address the visitor entered.

The API key is server-only: the browser never calls Resend and never receives
`RESEND_API_KEY`.

Set `RESEND_API_KEY` and `MAIL_FROM` in the host's environment. `MAIL_FROM` must
be an address on a domain **verified for that key** at
https://resend.com/domains — an unverified/unauthorized domain fails with
`403 not authorized to send emails from <domain>`. Delivery runs after the
response is flushed; a failure is written to the submission's `email_status` and
logged, and the enquiry is never lost.

The same email + message within 10 minutes is treated as a duplicate: the existing
submission is returned and no second pair of emails is sent. Newsletter and ROI
submissions notify the owner but do not send a visitor confirmation. Configure
`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` instead to fall back to SMTP when
`RESEND_API_KEY` is unset or Resend delivery fails.

Owner notifications and visitor confirmations are both recorded in the SQLite
`email_outbox` (visitor rows use the `<kind>_visitor` kind). Configure a channel, then
use **Admin → Email delivery → Send test email** to confirm, and **Retry queued**
to deliver anything captured earlier. With no channel configured, messages remain
queued in the admin panel — nothing is lost.

**Delivery events (optional, recommended):** create a Resend webhook pointing at
`https://<your-domain>/api/webhooks/resend`, subscribe to `email.delivered`,
`email.bounced`, `email.complained`, `email.delivery_delayed` and `email.failed`, and set
`RESEND_WEBHOOK_SECRET` (the `whsec_…` signing secret from Resend). Events then update the
outbox row's status for either email, so bounces and complaints are visible in the admin
console. The endpoint verifies the Svix signature and refuses requests when the secret is
unset; sending still works without it.

Set `ADMIN_EMAIL` to the monitored owner inbox (for example
`thomas@knightmedicalbilling.com`). It is both the owner recipient and the Reply-To on
visitor confirmations, so replies reach a person rather than the sending address.

---

## 10. Google AI Studio / Cloud Run preview

`next.config.ts` allow-lists the AI Studio dev host in `allowedDevOrigins`, which resolves
cross-origin dev warnings:

```ts
allowedDevOrigins: ['ais-dev-vdquyz2ozg4bjeiy4hgdx6-797145459235.asia-southeast1.run.app']
```

If your preview hostname changes, add the new hostname to that array. Expose the port reported by
the platform (Cloud Run sets `PORT`; `npm run start` reads it automatically). These previews often
have no persistent disk — expect the storage notice and deploy production on a host with a volume.

---

## 11. Health and monitoring

`GET /api/health` is the single deployment check:

```bash
curl -s https://your-domain.com/api/health | jq
```

- `ok` — `true` only when the SQLite file opens and answers a query.
- `stores.sqlite` — `{ role, available, path, driver, error }`; `error` states what to fix.
- `email` — which server-side channel (if any) is active.
- `config.blockingErrors` / `config.issues` — admin password, session secret, site URL, SQLite
  path and email-channel problems.
- `fallbackContent` — `true` when the site is serving built-in content because SQLite is
  unavailable.

---

## 12. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Admin shows "Local database unavailable" / health `stores.sqlite.available: false` | Set `SQLITE_PATH` to a writable, persistent directory; check the directory exists and is owned by the app user |
| Data disappears after a deploy | The filesystem is ephemeral. Use a persistent volume and set `SQLITE_PATH` to it |
| `SQLITE_BUSY` / "database is locked" | Keep one app process per file; use a local disk (not NFS); WAL + the 5 s busy timeout should cover normal traffic |
| `NODE_MODULE_VERSION` / "was compiled against a different Node.js version" | Run `npm rebuild better-sqlite3` with the Node 22 binary that runs the app |
| Emails queued, never sent | No channel configured — add `RESEND_API_KEY` + `MAIL_FROM` (or SMTP) and retry from Email delivery |
| Resend `403 not authorized to send emails from <domain>` | Verify `MAIL_FROM`'s domain for that API key, or use a root domain the key can send from |
| Imported rows missing after migration | Check the CSV exports from the old database exist and have headers; the import logs skipped rows. Re-run it — it is idempotent |
| Cloudinary image fails to load | Confirm the hostname is present in `images.remotePatterns` |
| Cross-origin dev warning in AI Studio | Add the exact preview origin to `allowedDevOrigins` |
| Blank preview | The server process is not running. Check `/api/health` and the platform port |

---

## 13. Pre-launch checklist

- [ ] `SQLITE_PATH` set to a writable, persistent volume — not `/tmp` and not inside `public/`
- [ ] Backup procedure tested (§4); backup schedule in place
- [ ] Optional: `npm run seed` executed (or accept the built-in content fallback)
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain
- [ ] `ADMIN_PASSWORD` set (or a password saved from the panel); `ADMIN_SESSION_SECRET` randomised
- [ ] `RESEND_API_KEY` + `MAIL_FROM` configured (domain verified) and test email received
- [ ] `/api/health` monitored; `/admin` blocked from indexing (already configured)
- [ ] If migrating: old-database CSV import completed and verified (§5)
- [ ] `npm audit --omit=dev` reviewed on your release cadence


## Blog CMS

The blog stores posts, categories, tags, revisions and redirects in the same SQLite
database (schema migration v4). Imported images are **not** stored in SQLite: the
WebP variants live under `<SQLITE_PATH directory>/blog-media/<media id>/`. Back up
that directory together with the database file, otherwise existing articles will
render with missing images.

- Public routes: `/blog`, `/blog/[slug]`, `/blog/category/[slug]`, `/blog/tag/[slug]`.
- Admin routes: `/admin/blog` (dashboard), `/admin/blog/new`, `/admin/blog/[id]`,
  `/admin/blog/preview/[id]`, `/admin/blog/categories`.
- Scheduled posts are promoted on read by `publishDuePosts()` (also exposed as
  `POST /api/admin/blog/publish-due`), so no external cron or open browser is needed.
- Run `BASE_URL=... ADMIN_PW=... node tests/blog.e2e.mjs` against a running server to
  exercise the whole workflow end to end.
