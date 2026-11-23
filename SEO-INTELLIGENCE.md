# SEO intelligence (Phase 6)

Evidence pipeline: **observe → store → consolidate → decide → act → verify → learn**.

## Modules

| Module | Role |
|---|---|
| `src/lib/seo/observations.ts` | Immutable `Observation` type, URL canonicalisation, evidence hashing, finding keys |
| `src/lib/seo/store.ts` | Append-only observation writes, finding upserts (preserves `first_seen`) |
| `src/lib/seo/findings.ts` | Consolidation, claim classes, execution levels, disagreement handling |
| `src/lib/seo/priority.ts` | Bounded 0–100 priority index (no division, versioned weights) |
| `src/lib/seo/rules/*` | Deterministic technical + editorial-rubric checks (no Python) |
| `src/lib/seo/gsc-sync.ts` | Search Analytics sync (25k pages, 50k/day/type cap, sample marking) |
| `src/lib/seo/bing-sync.ts` | Bing JSON API (OData `d` envelope, `IsVerified`) |
| `src/lib/seo/scheduler.ts` | Task locks, quotas, stale recovery, sync task runner |
| `src/lib/seo/opportunities.ts` | CTR gap, striking distance, cannibalisation, decay |
| `src/lib/seo/measure.ts` | Before/after windows, confounders, verdicts |
| `src/lib/seo/crawl.ts` | Bounded same-origin crawl, link graph, orphans |
| `src/lib/seo/indexnow.ts` | Change notification with per-content dedupe |
| `src/lib/seo/retention.ts` | Pruning windows |

## Settings (`seo_settings`)

`enabled`, `gsc_interval_hours` (6), `bing_interval_hours` (12), `gsc_lookback_days` (3),
`gsc_max_requests_per_run` (20), `gsc_daily_request_budget` (48), `bing_daily_request_budget` (24).
Budgets are self-imposed; Google's documented limit is 1,200 requests/minute per site.

## Security

- Keys live only in `/etc/knight/knight.env`: `BING_WEBMASTER_API_KEY`, `INDEXNOW_KEY`.
- Crawled pages and API payloads are untrusted data, never instructions.
- Level A automation is limited to notifications and queue upkeep; page changes are Level B/C.
- Every finding is attributable, deduplicated on `(check, subject)` and carries confidence/impact/effort/risk.

## Operational commands

```bash
npm run test:seo           # rules, priority, consolidation, schema
npm run test:seo:sync      # GSC + Bing normalisation and persistence
npm run test:seo:scheduler # task registration, locks, quotas, failures
npm run test:seo:intel     # opportunities, measurement, crawler
npm run test:seo:ops       # IndexNow, retention
```

## Known limits

- Live sync and live crawl have not been run; the dev database is still `user_version = 12`.
- IndexNow requires `INDEXNOW_KEY` plus the key file served at `/<key>.txt` before it will submit anything.
- No action executor exists yet: findings are read-only in the admin UI.

## Rule calibration (2026 audit)

These changes keep the rubric honest about what a measurement means:

- `image_alt_missing` reports only a genuinely absent `alt` attribute. `alt=""` is
  the correct decorative marker and is no longer reported as a defect. The count
  of correctly decorative images is stored as evidence.
- Content metrics run on `<main>` (header, footer and navigation excluded). When
  Next.js streams a dynamic page, the real markup lives in hidden `S:N` segments;
  those are joined before measuring, so a suspended page is not mistaken for a
  loading skeleton.
- Paragraph, heading and list-item boundaries count as sentence boundaries for
  readability, so bullet lists no longer inflate average sentence length.
- Thin-content floors are page-type aware: 150 words for utility and listing
  routes, 300 for landing and detail pages.
- Readability flags a page only when Flesch Reading Ease is below 25 or the
  average sentence exceeds 28 words, and never on directory/listing pages.
  Specialist medical-billing vocabulary lowers Flesch by syllable count even in
  short, clear sentences; the long-sentence signal is the actionable part.
- Bing OData dates (`/Date(milliseconds)/`) are parsed to `YYYY-MM-DD`. A date is
  a site-level reporting period, never a page URL. Legacy malformed subjects are
  repaired on read and their stale findings are closed during consolidation.
- A crawl resolves deterministic URL findings it can no longer reproduce. A
  newer observation re-opens a resolved finding; re-consolidating the same
  historical observations does not.

