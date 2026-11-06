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
  in production. Use a path on a persistent volume outside `public/`.
- Development creates the file on first use. Production **refuses to silently create a new
  database** when the configured file is missing. For an intentional first boot only, set
  `SQLITE_ALLOW_CREATE=1`, start once, run `npm run seed`, then unset it and set
  `SQLITE_REQUIRE_EXISTING=1`; otherwise restore the existing database.
  `SQLITE_REQUIRE_EXISTING=1` enforces the same guard in any environment.
- Schema changes are applied at startup as `PRAGMA user_version` migrations; existing rows are
  preserved. Back up before a deploy that introduces a schema migration.
- Blog media is stored beside the database at `<SQLITE_PATH directory>/blog-media/`; it must be
  on the same persistent volume and included in every backup.
- Runtime pragmas: `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON`,
  `synchronous = NORMAL`.
- Tables: `submissions`, `settings`, `subscribers`, `roi_estimates` (plain-SQL helpers),
  `leads`, `contact_messages`, `email_outbox`, `admin_audit`, `testimonials`, `specialties`,
  `case_studies`, `articles`, `faqs` and the first-party analytics tables
  (`analytics_sessions`, `analytics_pageviews`, `analytics_events`).

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
SQLITE_PATH=/var/data/app.db BACKUP_DIR=/var/backups/knight npm run db:backup
```

The script uses the SQLite online backup API, copies `blog-media`, writes a manifest and
applies `BACKUP_KEEP_DAYS` retention (default 14). Run it from cron:

```cron
15 2 * * * cd /srv/knight && SQLITE_PATH=/var/data/app.db BACKUP_DIR=/var/backups/knight npm run db:backup >> /var/log/knight-backup.log 2>&1
```

Keep a copy off the host (object storage or another volume). Test a restore before relying on
it. Do not copy only `app.db` while the app is running — WAL may contain committed pages.

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

**Safe local-to-production migration:**

```bash
# 1. Stop writes / switch the production site to maintenance.
# 2. Take a backup of the current production database first.
SQLITE_PATH=/var/data/app.db BACKUP_DIR=/var/backups/knight npm run db:backup
# 3. Copy the local application DB + blog-media into the persistent volume.
SOURCE_SQLITE_PATH="./data/app.db" \
DEST_SQLITE_PATH="/var/data/app.db" \
npm run db:migrate:production
# 4. Point SQLITE_PATH at /var/data/app.db, set SQLITE_REQUIRE_EXISTING=1, redeploy.
# 5. Verify /api/health reports sqlite.available true and make a test enquiry.
```

The copy script refuses to overwrite an existing destination unless
`OVERWRITE_PRODUCTION=1` is explicitly set. Never run it while the production app is
writing to the destination; stop the app or use the maintenance window first.

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


## SEO verification

Three runnable checks live in `tests/` and only report what they actually observe:

- `BASE_URL=https://www.knightmedicalbilling.com node tests/seo-audit.mjs` — crawls the
  sitemap plus internal links and reports status codes, redirects, missing/duplicate
  metadata and canonicals, noindex leaks, H1 counts, missing alt attributes, broken
  links/images and JSON-LD problems.
- `BASE_URL=... node tests/sitemap-check.mjs` — validates every sitemap URL returns 200,
  is indexable, is canonical to itself, and that robots.txt advertises the sitemap and
  blocks /admin and /api.
- `BASE_URL=... node tests/perf-mobile-audit.mjs` — Playwright lab measurements of FCP,
  LCP, CLS, TTFB, transferred JS/image bytes plus mobile overflow and tap-target checks.

The admin console has a matching **SEO health** page (`/admin/seo`) that runs the same
kind of real crawl from the server. It fetches `NEXT_PUBLIC_SITE_URL`, so build with the
public origin and make sure the site answers there.

First-party analytics (default): the public site sends a small first-party
pageview/engagement beacon to `/api/analytics`. Events are stored in the existing
SQLite database; no third-party tag is required. Analytics data is
visible in **Admin → Live Traffic**. Set `ANALYTICS_RETENTION_DAYS` (default 90)
to control retention and `ANALYTICS_HASH_SALT` to use a stable analytics hash salt
separate from the admin session secret. Raw IP addresses, form contents, passwords
and patient information are never stored by the analytics system.

For automated tests only, `ANALYTICS_ALLOW_TEST=1` disables the bot filter. Do not
enable it in production.

## AI agent (chat + voice)

The website includes an AI representative (DeepSeek reasoning + local retrieval) with text chat,
browser-native voice, real appointment booking and human handoff.

**Required server environment**

- `DEEPSEEK_API_KEY` (server only — never `NEXT_PUBLIC_*`) and optional `DEEPSEEK_MODEL`
  (default `deepseek-flash`, thinking mode disabled for latency).
- `ADMIN_EMAIL` for handoff/lead/appointment notifications (uses the existing Resend setup).
- `AI_AGENT_ENABLED` / `AI_TRANSCRIPT_RETENTION_DAYS` (optional; also editable in admin).

**Database:** migration v5 adds `ai_*` tables (conversations, messages, leads, appointments,
availability, blocked times, handoffs, knowledge sources/chunks + FTS5 index, usage logs).
No audio is stored and there are no PHI columns.

**Voice:** uses the browser's SpeechRecognition (STT) and speechSynthesis (TTS), with a WebAudio
energy monitor for barge-in. No third-party voice service or key is required. Voice works on
current Chrome/Edge and Safari; Firefox lacks SpeechRecognition, so visitors use text chat.
Microphone permission is requested only after a visitor enables voice, and the `Permissions-Policy`
header allows `microphone=(self)`.

**Knowledge base:** `ai_knowledge_sources`/`ai_knowledge_chunks` are built from approved website
content plus manual notes and searched with SQLite FTS5 (no vector database). Rebuild with the
button in Admin → AI agent → Knowledge after content changes.

**Booking:** availability rules live in `ai_availability_rules` (default Mon–Fri 09:00–17:00
America/New_York, 15-minute slots, 15-minute buffer). Bookings are stored in UTC, validated inside
`BEGIN IMMEDIATE`, and protected by a unique index on the start time. Confirmation emails include
a secure reschedule/cancel link to `/appointment/manage?token=…`.

**Timezone-aware scheduling (v6):** appointment times are converted with **Luxon**
(IANA tz database, DST-safe) — never fixed offsets. The visitor's zone (Eastern,
Central, Mountain or Pacific, or any IANA zone) is stored on the appointment together
with `local_date`, `local_time`, UTC start/end and duration (migration v6). The agent
asks for the timezone instead of assuming Eastern, checks real availability through
`check_appointment_availability`, requires an exact availability check before booking,
and confirms only after explicit visitor confirmation. Conflicts use full interval
overlap (`start < existing_end AND end > existing_start`), so partial overlaps are
rejected and back-to-back appointments are allowed. The chat state machine is persisted
in `ai_conversation_contexts` (DISCOVERY → … → BOOKED) with remembered visitor details.
The booking calendar (`/api/ai/slots?timezone=…`) and `/appointment/manage` display
times in the visitor's chosen zone.

**Natural voice:** browser speech synthesis now normalizes text for speech (A/R, RCM,
CPT, ICD-10, punctuation and links), splits sentences with question/statement prosody,
and scores available browser voices to prefer enhanced/neural voices (Samantha Enhanced,
Google, Microsoft Natural, etc.). Speech rate/voice-name remain configurable in admin.
No paid TTS is used.

**AI test suite (local, test-mode only):**

```bash
npm run build
AI_TEST_MODE=1 AI_TEST_SUPPRESS_EMAILS=1 npm run start   # test mode on :3000
npm run test:ai:unit                                    # timezone, ambiguity, overlap, voice text
npm run test:ai:conversation                            # 18-point scheduling + conversation suite
npm run test:ai:ui                                      # timezone-aware booking calendar
npm run test:ai:regression                              # original agent/voice/admin E2E
```

`AI_TEST_MODE=1` disables rate limiting and enables optional suppression/failure flags;
it must never be set in production. `AI_TEST_FAIL_CALENDAR=1` (with test mode, second
server on port 3101) verifies honest calendar-failure handling.

**Admin:** `/admin/ai` (overview), `/admin/ai/conversations`, `/leads`, `/appointments`,
`/handoffs`, `/knowledge`, `/settings`. Google Calendar sync is intentionally not part of v1; the
appointments table already has an `external_event_id` column for a future adapter.
