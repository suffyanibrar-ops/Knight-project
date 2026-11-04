# Knight Medical Billing

Custom-tailored medical billing and revenue cycle management website, admin console and form pipeline.

- **Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Drizzle ORM · SQLite (better-sqlite3) · Framer Motion
- **Website:** home, services (16), who we serve (5 + index), specialties (30 + index), process, results,
  about, resources (6 guides), FAQ, contact, schedule a consultation, HIPAA, privacy, terms
- **Admin console:** `/admin` — dashboard, SQLite inbox, submissions, email outbox, subscribers, ROI
  estimates, CSV exports
- **Forms:** consultation wizard, contact, newsletter, ROI calculator — all four write to SQLite.
  Consultation and contact submissions send two Resend emails server-side: an owner notification
  (Reply-To set to the visitor) and a visitor confirmation.

## Quick start

```bash
npm install
cp .env.example .env      # optional — the site runs without any env vars
npm run dev               # http://localhost:3000
```

The database is one embedded SQLite file. There is no external database to start
and no migration CLI — the file and its tables are created automatically on
first run:

- Default path `./data/app.db`; override with `SQLITE_PATH`.
- Schema changes run at startup as `PRAGMA user_version` migrations.
- Content (specialties, articles, FAQs) can be seeded from the built-in content;
  this is optional because the site falls back to it when the tables are empty:

```bash
npm run seed
```

Production:

```bash
npm run build
npm run start          # honours the PORT environment variable
```

Images use `next/image`; `res.cloudinary.com` is allow-listed in
`next.config.ts`, and `sharp` is installed so optimisation works on any Node host.

### Storage and admin

Every form submission is stored in the embedded SQLite file and read back from
it by the admin console:

- `POST /api/submissions` — validates, enforces length limits, parameterized insert, then
  queues the owner notification and visitor confirmation
- `GET  /api/submissions` — admin-only listing
- `POST /api/leads` and `POST /api/contact` — CRM copies of the submission written by the forms
  after the primary save
- `POST /api/subscribe` (newsletter) and `POST /api/roi` (ROI calculator)
- `/admin` — dashboard; `/admin/inbox` — submissions with search, view, delete and CSV export
- `/admin/submissions` — CRM leads and contact messages with status pipeline and CSV export
- `/admin/outbox` — email delivery: retry queued messages and send a test email
- `/admin/subscribers` and `/admin/estimates` — marketing list and ROI estimates
- `/admin/settings` — change the admin password (scrypt hash stored in SQLite)

Content pages (specialties, insights, FAQs) read the seeded SQLite rows and fall
back to the built-in content in `src/lib/site.ts` when the database is empty or
unavailable.

SQLite data requires a writable, persistent directory. On read-only hosts the
admin pages show a setup notice, form endpoints return an explicit error, and the
public site keeps rendering from built-in content.

### Email notifications

- **Resend (server-side).** `POST /api/submissions` sends two emails for every consultation or
  contact submission: an **owner notification** to `ADMIN_EMAIL` (default
  `admin@knightmedicalbilling.com`) with the visitor's email set as **Reply-To**, and a
  **visitor confirmation** to the address the visitor typed. Both include the submitted details
  and the submission time.
- Delivery is queued after the response, so visitors never wait. A mail failure is logged and
  recorded on the submission (`email_status`), and never loses the enquiry or reports a false
  success.
- The browser never calls Resend and never sees `RESEND_API_KEY`. Newsletter and ROI calculator
  submissions notify the owner but do not send a visitor confirmation.
- Configure `RESEND_API_KEY` and `MAIL_FROM` (see `.env.example`); the sender domain must be
  verified for that key in Resend. `SMTP_*` is an optional fallback (tried when Resend is
  unset or delivery fails), and the admin **Email delivery** page keeps the SQLite outbox and
  lets you retry.

This is a full-stack app — do not add `output: 'export'`.

Admin password: there is **no built-in default**. Admin sign-in stays **disabled** until
`ADMIN_PASSWORD` (or a legacy `ADMIN_PASSWORD_HASH` with a matching `ADMIN_SESSION_SECRET`) is
set; once signed in, change it at `/admin/settings` (scrypt hash stored in SQLite, which then
takes precedence over both environment variables).

## Before you deploy — required environment

```bash
ADMIN_PASSWORD=<long random passphrase>          # required for admin sign-in (no default)
ADMIN_SESSION_SECRET=<64 hex chars>              # required in production for stable sessions
NEXT_PUBLIC_SITE_URL=https://your-domain.com     # required for correct SEO
SQLITE_PATH=/var/data/app.db                     # persistent, writable volume — never /tmp or public/
RESEND_API_KEY=re_…                              # server-only; required for email delivery
MAIL_FROM="Knight Medical Billing <website@knightmedicalbilling.com>"   # domain must be verified in Resend
ADMIN_EMAIL=admin@knightmedicalbilling.com       # optional owner recipient (this is the default)
TRUST_PROXY=1                                    # optional: 1 = one trusted reverse proxy (default); 0 only if directly exposed
# Optional SMTP fallback (tried when Resend is unset or fails):
# SMTP_HOST=… SMTP_PORT=587 SMTP_USER=… SMTP_PASS=…
```

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `ADMIN_SESSION_SECRET` on every instance: without it, production generates a random
per-process signing key, so forged admin cookies are impossible but sessions reset on restart
and are not shared between instances.

Check deployment readiness at any time:

```bash
curl -s https://your-domain.com/api/health | jq
```

Full hosting instructions, backup/restore and troubleshooting: **[DEPLOYMENT.md](./DEPLOYMENT.md)**
Data storage, email behaviour and the admin security model: **[DATA-AND-EMAIL.md](./DATA-AND-EMAIL.md)**

Motion system and interaction rules: **[MOTION-SYSTEM.md](./MOTION-SYSTEM.md)**

Browser tests (Playwright, real Chromium):

```bash
npm run build && npm run start &
BASE_URL=http://127.0.0.1:3000 npm run test:browser       # routes, console, responsive, forms
BASE_URL=http://127.0.0.1:3000 npm run test:interactions  # motion, lightbox, toasts, a11y
BASE_URL=http://127.0.0.1:3000 npm run test:redesign      # theme, sticky header, new sections
BASE_URL=http://127.0.0.1:3000 npm run test:breakpoints   # 7 widths × 11 routes overflow
```
