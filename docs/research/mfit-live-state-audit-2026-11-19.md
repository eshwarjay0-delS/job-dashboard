# MFit live-state audit — 19 November 2026

## Scope

Read-only continuation of the owner's approved MFit/MarketFit backlog. Approval, source changes, tests, deployment and user acceptance remain separate. No real email/WhatsApp sends, live crawler requests, production writes, model calls, or device tests were performed.

## Canonical source and production

- Repository: `eshwarjay0-delS/job-dashboard`.
- Master: `5332e1459429644f661f969dbcd7ccb92fe525d0`.
- Production deployment: `dpl_2fVQUdmo7YD4TZ2rKx1rU5MJCFfM`, READY, target production.
- Aliases: `job-dashboard-fawn.vercel.app`, `marketfit-app.vercel.app`.
- Vercel project metadata reports `live:false` for protected preview context; the production alias remains READY. Protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run.

## Gmail and Poke-inspired mobile

Read-only Supabase aggregate:
- `mfit_gmail_sync`: 3 rows, 1 user, 3 account IDs; latest `last_sync_at` 2026-11-10 14:44:44.277 UTC.
- `mfit_gmail_threads`: 2,002 rows, 1 user, 3 account IDs; latest `updated_at` 2026-11-10 14:46:49.790 UTC.
- `connected_services`: one Gmail service row at user/service granularity; this does not establish three independent OAuth connections.
- Supabase project `ruajlrzmxzprmmngluxy` reports `ACTIVE_HEALTHY`.

Vercel runtime error aggregates:
- Seven-day `/api/gmail/alerts`: 10 `exceed_egress_quota` errors across 3 users, first 11 Nov 17:59:33 UTC, last 13 Nov 14:25:48 UTC, on older deployment `dpl_7jPvvxLg9ASAELyVXhwDeAVApswS`.
- No `/api/gmail/alerts` runtime errors in the last 24h or 1h.
- No new Gmail sync timestamp after 10 Nov was found, so current two-inbox/reconnect acceptance remains absent.

Owner correction retrieved 19 Nov 14:02:57 UTC: preserve the existing four-account ceiling; PR #440's no-cap migration is unapproved. Mobile menu expands below the sticky header in normal document flow and pushes content down; no overlay, scrim, dimming or page inertness. Poke proactive worker, notifications, scheduler and automated sending remain disabled.

PR evidence:
- #452 `a6ed0cf8f14f541c078beab74b02bcdce418062f`: full CI `44495139409`, Plan/REA `44495139313`, Kompas baseline `44495139791` SUCCESS.
- #454 `6262fcc4e770c0805ac9174fec2085f33c920e98`: full CI `44546759808`, Plan/REA `44546759585`, Kompas baseline `44546759545` SUCCESS.
- Both are DRAFT and non-mergeable on base `d03f188`; protected preview, two authorized inboxes, colliding-thread identity, selected-From/reconnect and narrow-phone acceptance remain.

## Contract job crawler

Read-only Supabase aggregate:
- Latest run: 10 Nov 2026 11:00:24.379–11:01:11.601 UTC; 20 portals; 6,818 jobs found/upserted; one error.
- `mfit_crawl_jobs`: 14,566 total, 12,407 active, 8,551 seen in 14 days; latest `last_seen_at` 10 Nov 11:01:11 UTC.
- No later run exists in `mfit_crawl_runs`.

PR #451 `cede6180da3aaf4a83b3e3b8baeb7b6d633baba1` passed full CI `44472689901`, crawler regression `44472689912`, Kompas baseline `44472689791`, and Plan/REA `44472689839`. It is diagnostic-only: local timeout versus upstream AbortError attribution and malformed-URL pacing; it does not add retries or new portals. Keep manual/on-demand only, no daily contract-crawler cron, eTeam excluded and Robert Half manual-only. No live crawl.

## WhatsApp resume incident and current errors

Owner correction at 2026-11-19 16:38:41 UTC: only an explicitly selected same-account Files/library resume may be sent as **Original resume — NOT TAILORED**. A fresh upload without explicit library selection must not be sent as original or silently replaced; return a text explanation and preserve the conversation. This supersedes earlier ambiguity while preserving the 27 Oct closest-matched same-account library failsafe.

Current master still has the source-level exposure: `chosenResumeMatchesProfile(text, undefined)` returns true; `sendClosest` can read `session.resumePath` without an explicit Files selection; `unverified_jd_terms` remains in the shortfall allowlist. This is a source defect, not proof of the 17 Oct incident's root cause.

Vercel seven-day `/api/whatsapp/webhook` aggregation:
- Three quality-gate rejections across three users; last 16 Nov 15:02:15 UTC.
- One `ServiceUnavailable` at 19 Nov 14:45:44 UTC.
- Both groups are attributed to older deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`; no WhatsApp runtime errors in the last hour.

PR #450 prior code head `7e794037141b85d8de9cfb5c1d76a787a883ba0f` passed full CI `44469659655`, WhatsApp recovery `44469659713`, Plan/REA `44469659726`, Kompas baseline `44469659703`. It contains the approved selected-library fallback/hard hold but also unapproved R2 ETag-CAS/conditional-write/lease/fencing changes. Child PR #453 `b71006e5037d5247e24485f620b0556843fa1624` passed 96/96 targeted tests and Plan/REA `44505879476`, but remains stacked and needs integrated full CI/baseline. The updated documentation head `b1f45e16774e2750bb43f0fe5e7c94c2a96265bf` has zero check runs; earlier results do not transfer.

Historical 17 Oct 17:28 Chicago delivery remains unverified: exact output DOCX, per-run R2 object/version, request correlation, Meta message ID and signed delivered/read receipt are missing. No replay, resend, R2 write or real Meta send.

## Kompas

Production master 5332e145 includes the 19 Nov latest-queued-question selection, two-second transcript fold, full-width desktop rows and `kompas-20261119-latest` cache stamp.

PR #455 `2e5b835d12e799d25d9a6c6c2d804fe371481fcd` passed full CI `44561416100`, Kompas baseline `44561416165`, Plan/REA `44561415783`, cross-device sync `44561415795`, and Windows Caption Capture `44561416163`. It remains DRAFT/non-mergeable on base `d03f188`; protected preview and real iOS/Android acceptance remain. The live 50-pair Kompas/ChatGPT comparison, independent human scoring and native Windows/WhatsApp/mobile acceptance remain open. Kompas Continuous Voice Delivery is disabled; no duplicate voice/caption work was performed.

PR #431 confirmed-skill alignment head `fa0037c2b3436f13dfeb7e1fa60eaa714c7f32b5` passed full CI `44388165144`, WhatsApp recovery `44388164799`, Kompas baseline `44388164907` and Plan/REA `44388164888`; actual source resume/JD/first-person confirmation and exported-DOCX inspection remain missing. The expanded final-DOCX Gemini correction/re-export/recheck loop remains proposed, not approved.

## Environment and release blockers

- Vercel project `live:false` and SSO-protected preview require owner-controlled `KOMPAS_VERCEL_API_TOKEN`; no credential was exposed or bypass attempted.
- Vercel sandbox creation failed with HTTP 402 because Hobby snapshot-storage quota was exceeded. No billing or snapshot deletion was attempted.
- GitHub API-created docs head `b1f45e16774e2750bb43f0fe5e7c94c2a96265bf` has zero workflow runs/check-runs. No local test/build was run; the AGENTS-required Next.js route-handler guide in `node_modules/next/dist/docs/` could not be read without a runnable checkout/sandbox.
- No real email/WhatsApp, live crawl, production write, model call or device acceptance occurred.

## Next

Keep all active PRs DRAFT and let MFit Safe Merge Gate sequence shared Plan/REA changes. Isolate the approved WhatsApp fallback/hard-hold from unapproved R2 concurrency architecture once a compliant test environment is available. Restore legitimate protected-preview access before any runtime release. Do not enable Poke automation or run a crawler without explicit authorization.
