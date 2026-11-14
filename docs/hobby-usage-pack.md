# Hobby usage pack (10 Nov 2026)

Permanent cuts so `job-dashboard` can stay on the Vercel Hobby team after the 10 Dec 2026 unpause without repeating the Fast Origin Transfer / Fluid Active CPU pause. The same build can also run on a parallel Oracle host: set `NEXT_PUBLIC_APP_URL` to that origin.

Nothing in this document is a deploy. Ship with the checklist in `/workspace/release-docs/SHIP_CHECKLIST.md`.

## Cron trim

Hobby already forbids anything more frequent than once per day, so frequency cannot go lower. The change is which jobs still run automatically.

**Still scheduled (daily, UTC hour as before):**

| Path | Schedule | Why it stays |
| --- | --- | --- |
| `/api/agent/watchdog` | `0 13 * * *` | Interview / vendor tripwires. Product still depends on this running unattended. |
| `/api/gmail/crawl` | `0 12 * * *` | Warms the interview cache so the inbox is not empty on first open. |
| `/api/whatsapp/recover` | `45 11 * * *` | Resumes interrupted WhatsApp work. Required for the durability contract. |

**Removed from `vercel.json` crons (routes are unchanged and can still be invoked with `CRON_SECRET` / `WATCHDOG_CRON_SECRET`, or later from GitHub Actions):**

| Path | Was | Why it was dropped from the Vercel schedule |
| --- | --- | --- |
| `/api/crawl/run` | `0 11 * * *` | Heaviest job (300 s, many outbound portal fetches). Not needed for the site to stay up. Trigger it by hand when a crawl is wanted. |
| `/api/chief/watch/run` | `17 4 * * *` | Only useful when Chief watches are active. Run on demand from the product or with the same secret. |

## Kill switch

Set `KOMPAS_POLL_DISABLED=1` (also accepts `true` / `yes` / `on`) on the server. Conditional catalog polls (`If-None-Match`) then return **429** with `Retry-After: 3600` and `X-Kompas-Poll: disabled`, without a database read. A first load or an explicit full refresh (no `If-None-Match`) still works.

The browser also stops its timer when it sees that response, or when `window.KOMPAS_POLL_DISABLED` is set before `start()`.

A per-user cap of **3 conditional polls per 60 seconds** returns 429 with `X-Kompas-Poll: throttled` if a surface bursts (several tabs plus focus).

## Cache

`/_next/static` stays immutable. `/version.json`, `/kompas/version.json`, `/api/health`, and `/health` may be cached briefly at the CDN. Every other `/api/*` path stays `no-store`. User catalog data is never CDN-cached; clients reuse it only through ETag / 304.

## Usage guard

`.github/workflows/hobby-usage-guard.yml` runs weekly (Monday 14:00 UTC) and on `workflow_dispatch`. It hits `/api/health` once. If `KOMPAS_VERCEL_API_TOKEN` and the team id are present, it also tries the Vercel usage API and fails when Fast Origin Transfer or Active CPU cross half of the Hobby caps. A missing token or a 402 from Hobby Observability is not a failure.


## 14 November 2026 schedule reconciliation

The earlier table records the owner-approved removal of the contract crawler from Vercel scheduling. A current-master audit nevertheless found `/api/crawl/run` still present at `0 12 * * *` (the older table's `0 11 * * *` value was stale). PR #381 removes that remaining entry. The separate `/api/gmail/crawl` schedule is not the contract crawler and remains unchanged. No crawl was run during this correction.
