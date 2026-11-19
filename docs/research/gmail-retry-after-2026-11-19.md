# Gmail Retry-After repair — 19 November 2026

## Scope and historical symptom

Issue [#429](https://github.com/eshwarjay0-delS/job-dashboard/issues/429) initially recorded five Gmail `403 rateLimitExceeded` responses and one unreadable history-page error on 16 November. A newer read-only 7-day snapshot, recorded in the 19 Nov 08:59 UTC issue comment, supersedes that count: 16 rate-limit events (latest 18 Nov 03:45:38 UTC), 13 PGRST301 malformed-JWT errors (latest 17 Nov 00:35:21 UTC), and 3 history-page read failures (latest 17 Nov 00:23:20 UTC). The API already returned HTTP 429 with `Retry-After: 30`; the Overview client retried on fixed 15/40/65-second waits. This mismatch is a plausible contributor, not proof of the sole cause. The other JWT errors and stale snapshot are separate failure classes.

## Implemented current-master slice

Draft PR [#454](https://github.com/eshwarjay0-delS/job-dashboard/pull/454) restacks the approved correction onto master `d03f18892015bdfceb277500978cbacd95ae7808`.

- `src/lib/gmail-retry-after.ts` parses RFC delta-seconds and HTTP-date values.
- A valid server delay is never shortened; the existing 15/40/65-second fallback remains a minimum for missing, invalid or shorter values.
- `src/app/dashboard/overview/page.tsx` uses the header from the response for the current history page only.
- The same page is retried; the three-pause maximum, cursor, snapshot, receiving-account identity and cleanup remain unchanged.
- The proactive Poke worker, scheduler, notifications and sending remain disabled.

## Regression coverage

`scripts/tests/gmail-retry-after.test.mjs` covers numeric, HTTP-date, missing, invalid, overflow, shorter-than-fallback and interleaved-account inputs. `scripts/tests/mail-overview.test.mjs` asserts that the actual page retry path reads the response header. Full CI now runs these with the existing selected-sender/account-isolation suite.

The isolated helper suite was run from the exact source/test content in a temporary local directory: **5 passed, 0 failed**. On intermediate docs head `b8590b66272bbdca28c84100fb478e8223d69364`, Kompas baseline `44516816186` and Plan/REA schema `44516816120` passed; full CI `44516816009` was still running at dependency installation/Lint. This diagnostic update advances the PR head, so exact-head CI, baseline and schema checks must be reverified. No older PR #432 result is reused.

## Current release boundary

Vercel project `job-dashboard` reports `live:false`; latest production attempt `dpl_AknmUNcd9Cgo8mTiZz3Ex7FEfb9i` is CANCELED on master `d03f188`. The canonical alias remains on older READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. SSO protection is enabled, and the owner-controlled private `KOMPAS_VERCEL_API_TOKEN` is unavailable. No protected preview or deployment was attempted.

Acceptance still requires Safe Merge Gate review, a legitimate protected preview, authorized restoration of the project, production READY + canonical alias verification, and separate two-inbox, selected-From, reconnect and narrow-phone checks. Investigate the PGRST301 malformed-JWT context separately; Retry-After handling does not repair it. Metadata-only Vercel environment inspection with decryption disabled found production entries for SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, but the values were not read; validity and project match remain unverified and require authorized admin validation. The stale 3-row sync catalog / 2,002-thread cache also remains unrefreshed, and no cached row is called fresh. No Gmail API/OAuth call, inbox mutation, email/WhatsApp send, scheduler activation, production write or device test occurred. Cached threads are not evidence of fresh sync.

