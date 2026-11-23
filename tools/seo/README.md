# SEO tools (isolated)

Pinned, CI-only measurement tools. They are **not** application dependencies:
`/srv/knight` runs `npm ci` from the repository root only, so nothing here is
installed on the VPS and nothing here is bundled into the site.

| Tool | Version | License | Purpose |
|---|---|---|---|
| `lighthouse` | 12.8.2 | Apache-2.0 | Lab performance / accessibility / best-practices / SEO |
| `linkinator` | 8.1.0 | MIT | Independent broken-link and redirect validation |

## First-time setup (requires explicit go-ahead)

```bash
cd tools/seo && npm install          # generates package-lock.json
```

The lockfile must be committed before any `npm ci` runs in CI, otherwise the
workflow would be non-reproducible.

## Removal

Delete this directory. Nothing outside `tools/` references it.
