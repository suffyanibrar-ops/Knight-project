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
| `SQLITE_PATH` | Required in production | Path to the SQLite file. Defaults to `./data/app.db`; in production use an absolute path on a persistent volume, e.g. `/var/lib/knight/app.db` |
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

**Health:** `GET /api/health` returns top-level `ok: true` only when the SQLite
file opens and answers a query. It reports
`stores.sqlite.{role,available,path,driver,error}`, the email channel status,
`config.{blockingErrors,issues}`, `fallbackContent`, environment, site URL and a
timestamp. Deployment requires `ok === true`, `stores.sqlite.available === true`
and `config.blockingErrors === 0`.

---

## 4. Backup and restore

The SQLite file is the whole database — every submission, admin record and content
row. Back it up on a regular schedule and treat the backup as sensitive: it contains
form submissions and contact details.

**Safe online backup (WAL-safe, no downtime):**

```bash
SQLITE_PATH=/var/lib/knight/app.db BACKUP_DIR=/var/backups/knight npm run db:backup
```

The script opens SQLite read-only, uses the online backup API, copies `blog-media`, writes a
manifest and applies `BACKUP_KEEP_DAYS` retention (default 14). Retention only
touches ISO-timestamp directories; it never deletes `predeploy/` or other
unknown recovery directories. Run it from cron (or the separately approved timer):

```cron
15 2 * * * cd /srv/knight && SQLITE_PATH=/var/lib/knight/app.db BACKUP_DIR=/var/backups/knight npm run db:backup >> /var/log/knight-backup.log 2>&1
```

Keep a copy off the host (object storage or another volume). Test a restore before relying on
it. Do not copy only `app.db` while the app is running — WAL may contain committed pages.

Keep backups off the host (object storage or another volume) and test a restore before you rely
on it.

**Restore (maintenance-only, never in normal deployment):**

1. Stop the application and keep it stopped.
2. Take and verify a fresh backup of the current destination DB and media.
3. Confirm the restoration source passes integrity checks.
4. Remove stale destination `-wal`/`-shm` only after the stopped database has been
   checkpointed/backed up. The restore script refuses to proceed if they remain.
5. Run the explicit guarded restore:
   ```bash
   SOURCE_SQLITE_PATH=/var/backups/knight/predeploy/.../app.db \
   DEST_SQLITE_PATH=/var/lib/knight/app.db \
   OVERWRITE_PRODUCTION=1 PRODUCTION_APP_STOPPED=1 DESTINATION_BACKED_UP=1 \
   npm run db:migrate:production
   ```
   The script verifies source and temporary destination integrity and atomically
   renames the new database into place.
6. `chown` the restored database/directory to `knight:knight`; verify media.
7. Start the app and verify `GET /api/health` reports
   `stores.sqlite.available: true`; check admin row counts.
8. Do not restore a database automatically because a deployment health check
   failed. Preserve the failed database/WAL for diagnosis.

**Routine:** back up before every deploy and keep at least one pre-migration copy.
A failed application deploy rolls back application code only. Restoring a
database file is a separate, explicit recovery action; it must never happen
automatically because it can erase newer production data.

**Safe local-to-production migration:**

```bash
# 1. Stop writes / switch the production site to maintenance.
# 2. Take a backup of the current production database first.
SQLITE_PATH=/var/lib/knight/app.db BACKUP_DIR=/var/backups/knight npm run db:backup
# 3. Copy the local application DB + blog-media into the persistent volume.
SOURCE_SQLITE_PATH="./data/app.db" \
DEST_SQLITE_PATH="/var/lib/knight/app.db" \
npm run db:migrate:production
# 4. Point SQLITE_PATH at /var/lib/knight/app.db, set SQLITE_REQUIRE_EXISTING=1, redeploy.
# 5. Verify /api/health reports sqlite.available true and make a test enquiry.
```

The restore script requires all three explicit flags for an existing
destination: `OVERWRITE_PRODUCTION=1`, `PRODUCTION_APP_STOPPED=1` and
`DESTINATION_BACKED_UP=1`. It checks source and temporary-copy integrity, refuses
stale destination WAL/SHM, and atomically replaces the database only after
verification. It is never used in normal deployment.

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
  (e.g. `/var/lib/knight/app.db`). The directory must be writable by the service user and survive
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

## AI Content Studio and admin password recovery (schema v9 + v10)

Schema v9 adds two additive tables without rewriting existing content or auth rows:
`content_workflows` and `admin_password_resets`.

### Content Studio

The existing admin Content page now includes the AI-assisted editorial pipeline:
Research → Topic Plan → Draft → SEO Review → Human Approval → Publish.

- Requires `DEEPSEEK_API_KEY`; the server-side route `/api/admin/content/workflows` is admin-only.
- AI drafts are always created as private `blog_posts` drafts. Approval and a separate human Publish/Schedule action are required.
- The server does not have a live SERP/search-volume provider. Editor-supplied notes are the only external research input, and only editor-supplied URLs may be cited.
- Review is a mix of deterministic checks and an AI editorial critique; it is not a substitute for human factual review.

### Password recovery

- Set `ADMIN_EMAIL` to the owner inbox and configure Resend or SMTP; no new secret is required.
- Forgot/reset pages are public admin routes: `/admin/forgot-password` and `/admin/reset-password`.
- Tokens are 30-minute, single-use, stored only as SHA-256 hashes; reset links are deliberately not written to the email outbox.
- Requests are rate-limited per client. The public response does not reveal whether the address exists.
- A successful reset or panel password change invalidates outstanding reset tokens.
- If `NEXT_PUBLIC_SITE_URL` is wrong, the reset link points to the wrong host; set it before deployment.

## Additional production hardening (schema v10)

### Session invalidation

Schema v10 adds a server-side `admin_session_version` setting. Every admin cookie
contains the current generation; a successful password reset or panel password
change rotates the generation, invalidating all previously issued sessions on
their next request. The proxy can only verify the signature, so page/layout/API
guards enforce the generation check. The login page now lets the server decide
whether a cookie is still valid, avoiding redirect loops after rotation.

### Persistent rate limits

Schema v10 stores security-sensitive rate-limit buckets in SQLite. Login failures,
password-reset requests/confirmations, and admin API writes survive process
restarts. High-volume public endpoints continue to use the in-process limiter to
avoid a database write per analytics event. Run exactly one app process with the
single SQLite database.

### Independent scheduled publishing

The systemd timer units are prepared but **must not be enabled yet**. The
existing website service is `knight`; there is no `knight-next.service`.

Run the read-only preflight first:

```bash
/srv/knight/current/ops/install-systemd.sh --check
```

After separate approval, the units can be installed without starting them:

```bash
sudo /srv/knight/current/ops/install-systemd.sh --install-timers
```

Only `knight-publish-due.timer` and `knight-backup.timer` are installed. The
installer never enables timers. Enabling them is a separate, explicitly approved
post-deployment action using `/usr/bin/systemctl enable --now` after inspecting the
units. The publishing script catches missed schedules on its next run; lazy
publish-on-read remains a fallback.

The timer services run as `knight` and read `/etc/knight/deploy.env` (never the
application secrets file). The `knight` account must be in the shared
`knight-backup` group so `knight-backup.timer` can write
`/var/backups/knight`. The backup unit uses `UMask=0027`; the shared backup root
is setgid (`2770`) so new snapshots inherit `knight-backup` and remain group-only.

### Search / Search Console configuration

Content Studio can use real search results through `SERPER_API_KEY` or
`GOOGLE_CUSTOM_SEARCH_API_KEY` + `GOOGLE_CUSTOM_SEARCH_CX`. Optional Search
Console metrics use `GSC_SITE_URL` and either `GSC_SERVICE_ACCOUNT_JSON` or
`GSC_SERVICE_ACCOUNT_FILE` (add the service account as a property user). These
provide clicks, impressions, CTR and position only; the app never invents search
volume, keyword difficulty, rankings or citations.

### GitHub Actions deployment

The active workflow is prepared at `.github/workflows/deploy-vps.yml`. It runs on
an approved `push` to `main` (and supports manual dispatch on `main`), requires
the protected GitHub Environment named `production`, and runs `npm ci`,
typecheck, lint and a production build before deployment.

It requires these repository/environment secrets:

- `VPS_HOST`
- `VPS_USER` — the dedicated non-root deploy account, not `knight` admin/root
- `VPS_SSH_KEY`
- `VPS_KNOWN_HOSTS` — pinned host key; never use ad-hoc `ssh-keyscan`
- optional `VPS_PORT` (defaults to 22)

Before enabling automatic deployment, configure the `production` environment
with required reviewers in GitHub. The workflow deliberately uses no `sudo`;
the deploy script elevates only the exact `/usr/bin/systemctl restart knight` command
through the restricted sudoers policy described in the server setup section.

The workflow uploads a release without `data/`, media, `.env*`, `.next/` or
`node_modules/`, and the VPS deploy script builds there. It takes a verified
online SQLite/media backup, switches the release, checks the exact health JSON,
and on failure rolls back application code only. **It never restores or overwrites
the production database automatically.**

### Local preparation vs future VPS setup

The local repository now contains corrected deployment artifacts. None of the
following server actions have been performed and all require separate approval:

1. Create the dedicated deploy account with read access to the database/media
   and the **non-secret** `/etc/knight/deploy.env`. Never grant it read access to
   `/etc/knight/knight.env`.
2. Install a restricted sudoers policy for only:
   `/usr/bin/systemctl restart knight`, `/usr/bin/systemctl stop knight`,
   `/usr/bin/systemctl start knight`, `/usr/bin/systemctl status knight`.
3. Verify the existing `knight.service` unit; do not create a second website
   service.
4. Ensure `/srv/knight/releases` and `/srv/knight/.deploy.lock` are writable by
   the deploy account, and `/srv/knight/current` is managed by deployment.
5. Ensure `/var/lib/knight/app.db` and `/var/lib/knight/blog-media` are readable
   by the backup process and writable by `knight`.
6. Ensure `/var/backups/knight` is writable by the deploy account and the
   `knight` application account through the shared `knight-backup` group; configure
   off-host retention.
7. Put production secrets in `/etc/knight/knight.env`, never in Git, a release,
   or GitHub workflow files.
8. Configure GitHub Environment `production` with required reviewers and the
   secrets listed above.

### Nginx client-IP contract

Rate limits and audit IPs derive the client from the LAST `X-Forwarded-For` hop
when `TRUST_PROXY=1` (the production default). Keep exactly one trusted reverse
proxy and configure it with:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Do not enable additional proxy layers without updating `TRUST_PROXY`; otherwise
the last hop becomes an internal address and all visitors share one bucket.

---

## 10. Corrected dedicated-server setup (future, explicit approval required)

These steps are documentation only. They have **not** been executed. Do not
create the account, change sudoers, modify the existing service or enable timers
until this section is approved.

### Accounts and ownership

```bash
# Dedicated non-root deployment account. Do not use root or the existing
# unrestricted administrative SSH account for GitHub deployments.
sudo adduser --disabled-password --gecos "" deploy

# Shared backup group: both the deploy account (pre-deploy backup) and the
# application account (scheduled backup) may write this directory.
sudo groupadd --system knight-backup
sudo usermod -aG knight deploy          # read DB/media for backup
sudo usermod -aG knight-backup deploy
sudo usermod -aG knight-backup knight

# Releases, the current symlink and the deploy lock are managed by the deploy account.
# The app only reads /srv/knight/current; it does not need write access there.
sudo install -d -o deploy -g deploy -m 0755 /srv/knight
sudo install -d -o deploy -g deploy -m 0755 /srv/knight/releases
sudo chown deploy:deploy /srv/knight
# Setgid on the shared backup root makes every new backup subdirectory inherit
# the knight-backup group. Files are created group-readable only (0640).
sudo install -d -o root -g knight-backup -m 2770 /var/backups/knight
sudo chown root:knight-backup /var/backups/knight
sudo chgrp -R knight-backup /var/backups/knight
sudo find /var/backups/knight -type d -exec chmod 2770 {} +
sudo find /var/backups/knight -type f -exec chmod 0640 {} +

# Application-owned persistent data.
sudo install -d -o knight -g knight -m 0750 /var/lib/knight
sudo chown knight:knight /var/lib/knight/app.db
sudo chmod 640 /var/lib/knight/app.db
sudo chown knight:knight /var/lib/knight/app.db-wal /var/lib/knight/app.db-shm 2>/dev/null || true
sudo chmod 640 /var/lib/knight/app.db-wal /var/lib/knight/app.db-shm 2>/dev/null || true
sudo chown -R knight:knight /var/lib/knight/blog-media
sudo find /var/lib/knight/blog-media -type d -exec chmod 0750 {} +
sudo find /var/lib/knight/blog-media -type f -exec chmod 0640 {} +

# /etc/knight is traversable by the deploy/backup group; the app env itself is
# root-only. systemd reads EnvironmentFile as root before dropping to knight.
sudo install -d -o root -g knight-backup -m 0750 /etc/knight
sudo chown root:knight-backup /etc/knight
sudo install -m 0640 -o root -g knight-backup /etc/knight/deploy.env
sudo install -m 0600 -o root -g root /etc/knight/knight.env
```

`/etc/knight/deploy.env` is non-secret and is readable by the deploy account
and the backup/publish services. It should contain only:

```env
SQLITE_PATH=/var/lib/knight/app.db
BACKUP_DIR=/var/backups/knight
SQLITE_REQUIRE_EXISTING=1
NEXT_PUBLIC_SITE_URL=https://www.knightmedicalbilling.com
```

`SQLITE_REQUIRE_EXISTING=1` is required by `ops/deploy.sh`; without it deployment
stops before taking a backup or switching releases.

`/etc/knight/knight.env` remains the full runtime environment used by the
existing `knight.service`, including email/admin secrets. It is `0600 root:root`;
systemd reads it before dropping privileges to `knight`, so the application
still receives it but the deploy account cannot read it.

The timer services use `/etc/knight/deploy.env`, not the application secrets file.

### Restricted sudoers

Verify the systemctl path first:

```bash
command -v systemctl
```

Then add a narrowly scoped file after approval:

```sudoers
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart knight, /usr/bin/systemctl stop knight, /usr/bin/systemctl start knight, /usr/bin/systemctl status knight
```

The VPS audit verified `/usr/bin/systemctl`; use that exact path. Do not grant
`ALL`, shell access, file editing, or unrestricted systemctl.

### Next.js runtime cache and service umask

New releases are deploy-owned and must remain read-only to the application,
except for Next.js runtime cache data. `ops/deploy.sh` creates
`<release>/.next/cache`, changes its group to `knight`, sets directories to
`2770`, and leaves code/database/media paths untouched. This is the only writable
path inside a release and is required for Next.js image optimisation/cache work.

After a release containing this file is current, install the minimal systemd
drop-in on the VPS during an approved maintenance window so newly created
database/WAL/SHM/cache files are not world-readable:

```bash
sudo install -d -m 0755 /etc/systemd/system/knight.service.d
sudo install -m 0644 /srv/knight/current/ops/systemd/knight-umask.conf \
  /etc/systemd/system/knight.service.d/umask.conf
sudo systemd-analyze verify /etc/systemd/system/knight.service
sudo /usr/bin/systemctl daemon-reload
sudo /usr/bin/systemctl restart knight
```

`UMask=0027` is appropriate for the Next.js application: it does not remove the
app's ability to write its cache/database, but new files are `0640` and new
directories are `0750` instead of world-readable. This drop-in does not replace
the existing unit, change `User`/`Group`, or change `EnvironmentFile`.

Verify after restart:

```bash
readlink -f /srv/knight/current
stat -c '%A %U:%G %n' /srv/knight/current/.next/cache
curl -fsS http://127.0.0.1:3000/api/health
```

### Deployment SSH key for GitHub Actions

Create a **separate** key for GitHub Actions. Do not reuse the personal Mac
`~/.ssh/id_ed25519` key or add it to the deploy account.

```bash
# Run locally, only after approval. Protect the private key.
ssh-keygen -t ed25519 -a 100 -f ~/.ssh/knight-gha-deploy \
  -C "github-actions-knight-deploy" -N ""

# Install only the PUBLIC key for the deploy account:
sudo install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
sudo install -m 0600 -o deploy -g deploy \
  ~/.ssh/knight-gha-deploy.pub /home/deploy/.ssh/authorized_keys
```

Put the **private** key file's contents into the GitHub secret `VPS_SSH_KEY`.
Set `VPS_USER=deploy`. Never put a private key in the repository, a release, a
command line, or this document. Put the verified host key(s) in
`VPS_KNOWN_HOSTS`; do not use an unverified `ssh-keyscan` result.

### SSH account

After approval, install the dedicated public key for `deploy` only, with:

```text
~deploy/.ssh/authorized_keys  mode 0600
~deploy/.ssh                 mode 0700
```

In `/etc/ssh/sshd_config` (or a drop-in), keep root login disabled, password
authentication disabled, and limit the deploy key to the deploy account. Do not
give the GitHub key to a root account. Review the config with `sshd -t` before
reloading it.

### Existing service

Before any deployment, inspect the existing unit:

```bash
/usr/bin/systemctl cat knight
/usr/bin/systemctl show knight -p User -p Group -p WorkingDirectory -p EnvironmentFile -p ExecStart
```

Do not install `knight-next.service` or create a second website service.

### First bootstrap

The first production database must be created and seeded manually with
`SQLITE_ALLOW_CREATE=1` and `SQLITE_REQUIRE_EXISTING` unset. After seeding:

```env
SQLITE_PATH=/var/lib/knight/app.db
SQLITE_REQUIRE_EXISTING=1
TRUST_PROXY=1
NEXT_PUBLIC_SITE_URL=https://www.knightmedicalbilling.com
```

Then set `SQLITE_REQUIRE_EXISTING=1` permanently. Automatic deployment requires
this flag and refuses a missing database.

### Migration / code rollback compatibility

- Current schema migrations through v10 are additive; the application applies
  them in a transaction at startup.
- Older application code can ignore tables added by v9/v10, but future
  destructive or column-changing migrations require a separately reviewed
  rollback plan.
- The deploy script never restores the database automatically. If a deployment
  fails, preserve the failed database and its WAL/SHM files before any manual
  recovery decision.
- `scripts/copy-sqlite.mjs` is for intentional manual migration only; never use
  `OVERWRITE_PRODUCTION=1` in a normal deployment.
