# Deployment guide — Knight Medical Billing

A **full-stack Next.js 16 (App Router)** application with route handlers, server actions, middleware
(`proxy.ts`), Drizzle ORM and PostgreSQL. It is **not** a static site and must not be exported
statically — the admin console, form APIs and database require a server runtime.

Any Node.js 22 host works: Vercel, Render, Railway, Fly.io, Google Cloud Run, Google AI Studio,
Northflank, a Docker container or a VPS. No host-specific files or attributes are required.

---

## 1. Build and run

```bash
npm install
npm run build
npm run start        # honours PORT; binds 0.0.0.0 by default
```

`npm run dev` starts the development server on `http://localhost:3000`.

Environment variables (all documented in `.env.example`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | For admin/forms/DB | Hosted Postgres connection string (`?sslmode=require` in production) |
| `DATABASE_SSL_INSECURE` | Optional | `1` disables Postgres TLS certificate verification — only for a private/self-signed CA; it weakens MITM protection |
| `TRUST_PROXY` | Optional | Default `1` = one trusted reverse proxy (last `X-Forwarded-For` hop is used for limits/audit). `0` = directly exposed, header ignored |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Absolute site URL for canonical tags, sitemap, Open Graph, emails |
| `ADMIN_EMAIL` | Optional | Owner inbox for notifications (default `admin@knightmedicalbilling.com`) |
| `ADMIN_PASSWORD` | For admin sign-in | Password for `/admin`; with no password from this var, a panel change or `ADMIN_PASSWORD_HASH`, sign-in is disabled (fail closed) |
| `ADMIN_PASSWORD_HASH` | Optional | Legacy peppered digest (`sha256(ADMIN_SESSION_SECRET + password)`), used only after a panel password and `ADMIN_PASSWORD`; requires the same `ADMIN_SESSION_SECRET` used to derive it |
| `ADMIN_SESSION_SECRET` | Recommended in production | Signs admin session cookies; without it production uses a random per-process key (sessions reset on restart, not shared between instances) |
| `RESEND_API_KEY` | For email delivery | Server-side Resend key. Never exposed to the browser; without it no email is sent |
| `MAIL_FROM` | For email delivery | Sender identity; the domain must be verified for that key (default `Knight Medical Billing <website@knightmedicalbilling.com>`) |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Optional | SMTP fallback, used only when `RESEND_API_KEY` is unset |

`.env` is git-ignored; only `.env.example` is committed. Never commit credentials.

---

## 2. Embedded SQLite (forms, subscribers and estimates)

`./data/app.db` is created automatically. Plain SQL via `better-sqlite3`
(declared in `serverExternalPackages`). Tables: `submissions`, `subscribers`,
`roi_estimates`, `settings`.

This is the **primary store** for every website form: consultation and contact
submissions, newsletter opt-ins and ROI calculator estimates are written here
first, and the admin pages read them from here. Postgres mirrors the data when
it is configured but is never required to capture it.

- Needs a **writable, persistent directory**. Use a VPS, Docker volume, or a
  platform disk (Render/Railway/Fly). On ephemeral serverless filesystems the
  submission endpoint returns a clear message instead of failing silently.
- Override the location with `SQLITE_PATH=/mnt/volume/app.db`.
- There is **no fallback to a temporary directory**: an unwritable path is
  reported (HTTP 503 + `/api/health`) instead of losing submissions.
- Full details: **[DATA-AND-EMAIL.md](./DATA-AND-EMAIL.md)**
- Back up by copying `data/app.db` (plus `-wal`/`-shm` while running).

API: `POST /api/submissions` (public, validated — stores the submission and
queues the owner notification + visitor confirmation) · `GET /api/submissions`
(admin) · `GET /api/admin/inbox-export` (admin CSV). Other public form
endpoints: `POST /api/subscribe` (newsletter) and `POST /api/roi` (ROI
calculator).

## 3. Database (PostgreSQL, optional)

The connection string is read from `process.env.DATABASE_URL` in both places:

- `src/db/index.ts` — Drizzle client (lazy pool, TLS with certificate verification by default; `DATABASE_SSL_INSECURE=1` opts out for private/self-signed CAs)
- `drizzle.config.ts` — Drizzle Kit (throws a clear error if the variable is missing)

No credentials are hardcoded. The embedded SQLite inbox in §2 is a separate
local store, not a Postgres driver or a fallback for Postgres.

```bash
npm run db:push      # npx drizzle-kit push — apply src/db/schema.ts
npm run db:seed      # node --experimental-strip-types scripts/seed.mjs
npm run db:generate  # optional: emit SQL migrations
```

Run both commands once against your production database after the first deploy.

**Resilience:** if `DATABASE_URL` is missing, public pages still render from built-in content and
`/api/health` reports `stores.postgres.status: "not-configured"`. Admin pages show setup
instructions. Nothing crashes at import time.

---

## 4. Images

`next/image` is used throughout. Local assets live in `public/images`. External images are
allow-listed in `next.config.ts`:

```ts
images: { remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }] }
```

`sharp` is a production dependency, so the optimizer works on any Node host. Hosts with an
image-optimization service (Vercel, Netlify) use it automatically.

---

## 5. Admin console

- URL: `/admin` → redirects to `/admin/login`
- Password resolution: (1) password changed in **Settings** (scrypt hash in SQLite),
  (2) `ADMIN_PASSWORD` env var, (3) `ADMIN_PASSWORD_HASH` (legacy peppered digest).
  There is **no built-in/default password**: when none of these is configured, sign-in is
  disabled in **every** environment (fail closed).
- Sessions: signed HttpOnly cookie, 8-hour expiry, verified in `src/proxy.ts` **and** in every
  admin page. `ADMIN_SESSION_SECRET` should be set in production; without it a random
  per-process key is generated, so cookies cannot be forged, but sessions reset on restart and
  are not shared between multiple instances.
- Brute-force protection: 5 attempts / 15 minutes per IP, all attempts audit-logged
- Pages: overview, submissions (status pipeline, search, CSV export), email outbox (retry + test
  email), subscribers, ROI estimates

---

## 6. Email notifications

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
`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` instead to use SMTP when
`RESEND_API_KEY` is unset.

Configure a channel, then use **Admin → Email delivery → Send test email** to confirm, and
**Retry queued** to deliver anything captured earlier. With no channel configured and
`DATABASE_URL` set, messages remain queued in the admin panel — nothing is lost.

---

## 7. Google AI Studio / Cloud Run preview

`next.config.ts` allow-lists the AI Studio dev host in `allowedDevOrigins`, which resolves
cross-origin dev warnings:

```ts
allowedDevOrigins: ['ais-dev-vdquyz2ozg4bjeiy4hgdx6-797145459235.asia-southeast1.run.app']
```

If your preview hostname changes, add the new hostname to that array. Expose the port reported by the
platform (Cloud Run sets `PORT`; `npm run start` reads it automatically).

---

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build error `DATABASE_URL is not set` | Only Drizzle CLI commands need it. Set `DATABASE_URL`, or skip DB commands for a content-only preview. |
| `relation "leads" does not exist` | Run `npm run db:push` against the deployed database. |
| Cloudinary image fails to load | Confirm the hostname is present in `images.remotePatterns`. |
| Cross-origin dev warning in AI Studio | Add the exact preview origin to `allowedDevOrigins`. |
| Admin shows "connect a database" | `DATABASE_URL` is missing in that environment. |
| Emails queued, never sent | No channel configured — add `RESEND_API_KEY` or SMTP and retry. |
| Blank preview | The server process is not running. Check `/api/health` and the platform port. |

---

## 9. Pre-launch checklist

- [ ] `DATABASE_URL` set and `npm run db:push && npm run db:seed` executed
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain
- [ ] `ADMIN_PASSWORD` set (or a password saved from the panel); `ADMIN_SESSION_SECRET` randomised
- [ ] Email channel configured and test email received
- [ ] `/api/health` monitored; `/admin` blocked from indexing (already configured)
- [ ] `npm audit --omit=dev` reviewed on your release cadence
