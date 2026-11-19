# Gmail Retry-After repair — 19 November 2026

## Scope and historical symptom

Issue [#429](https://github.com/eshwarjay0-delS/job-dashboard/issues/429) records five Gmail `403 rateLimitExceeded` responses on `/api/gmail/application-chains` and one unreadable history-page error on 16 November. The API already returned HTTP 429 with `Retry-After: 30`; the Overview client retried on fixed 15/40/65-second waits. This mismatch is a plausible contributor, not proof of the sole cause, and the evidence is historical rather than a current live error claim.

## Implemented current-master slice

Draft PR [#454](https://github.com/eshwarjay0-delS/job-dashboard/pull/454) restacks the approved correction onto master `d03f18892015bdfceb277500978cbacd95ae7808`.

- `src/lib/gmail-retry-after.ts` parses RFC delta-seconds and HTTP-date values.
- A valid server delay is never shortened; the existing 15/40/65-second fallback remains a minimum for missing, invalid or shorter values.
- `src/app/dashboard/overview/page.tsx` uses the header from the response for the current history page only.
- The same page is retried; the three-pause maximum, cursor, snapshot, receiving-account identity and cleanup remain unchanged.
- The proactive Poke worker, scheduler, notifications and sending remain disabled.

## Regression coverage

`scripts/tests/gmail-retry-after.test.mjs` covers numeric, HTTP-date, missing, invalid, overflow, shorter-than-fallback and interleaved-account inputs. `scripts/tests/mail-overview.test.mjs` asserts that the actual page retry path reads the response header. Full CI now runs these with the existing selected-sender/account-isolation suite.

The isolated helper suite was run from the exact source/test content in a temporary local directory: **5 passed, 0 failed**. On code head `e9868c521f9470fd6cd11e1c8453abec0cdd8ac5`, GitHub Kompas baseline `44515989389` passed and full CI `44515989253` was still running. The Plan/REA update advances the PR head, so exact-head CI, baseline and schema checks must be reverified. No older PR #432 result is reused.

## Current release boundary

Vercel project `job-dashboard` reports `live:false`; latest production attempt `dpl_AknmUNcd9Cgo8mTiZz3Ex7FEfb9i` is CANCELED on master `d03f188`. The canonical alias remains on older READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. SSO protection is enabled, and the owner-controlled private `KOMPAS_VERCEL_API_TOKEN` is unavailable. No protected preview or deployment was attempted.

Acceptance still requires Safe Merge Gate review, a legitimate protected preview, authorized restoration of the project, production READY + canonical alias verification, and separate two-inbox, selected-From, reconnect and narrow-phone checks. No Gmail API/OAuth call, inbox mutation, email/WhatsApp send, scheduler activation, production write or device test occurred. Cached threads are not evidence of fresh sync.

