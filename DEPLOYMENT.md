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
| `RESEND_API_KEY` + `MAIL_FROM` | Optional | Email channel #1 |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Optional | Email channel #2 |

`.env` is git-ignored; only `.env.example` is committed. Never commit credentials.

---

## 2. Embedded SQLite (consultation inbox)

`./data/app.db` is created automatically. Plain SQL via `better-sqlite3`
(declared in `serverExternalPackages`). Tables: `submissions`, `settings`.

- Needs a **writable, persistent directory**. Use a VPS, Docker volume, or a
  platform disk (Render/Railway/Fly). On ephemeral serverless filesystems the
  submission endpoint returns a clear message instead of failing silently.
- Override the location with `SQLITE_PATH=/mnt/volume/app.db`.
- There is **no fallback to a temporary directory**: an unwritable path is
  reported (HTTP 503 + `/api/health`) instead of losing submissions.
- Full details: **[DATA-AND-EMAIL.md](./DATA-AND-EMAIL.md)**
- Back up by copying `data/app.db` (plus `-wal`/`-shm` while running).

API: `POST /api/submissions` (public, validated) · `GET /api/submissions`
(admin) · `POST /api/submissions/email-status` (token-gated callback from the
forms) · `GET /api/admin/inbox-export` (admin CSV). Other public form
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

**Web3Forms (client-side):** the consultation and contact forms post to
`https://api.web3forms.com/submit` with the public access key in
`src/lib/web3forms.ts`; newsletter and ROI calculator submissions do not use it.
Web3Forms blocks server-IP requests by design, so this must run in the browser
(it does). If the provider rejects a request, the submission is still saved and
the inbox shows `failed`.

**Server-side channels (optional):** when `DATABASE_URL` is configured,
consultation and contact submissions are also mirrored to Postgres (best-effort,
after the SQLite save) and each owner notification is written to `email_outbox`,
then delivered to `ADMIN_EMAIL` through the first configured channel
(Resend → SMTP → optional FormSubmit relay). Delivery runs after the response is
flushed, so visitors never wait. Without `DATABASE_URL` there is no outbox or
Postgres storage: newsletter/ROI submissions are not stored and queued-message
retry is unavailable (a configured channel still sends directly).

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
