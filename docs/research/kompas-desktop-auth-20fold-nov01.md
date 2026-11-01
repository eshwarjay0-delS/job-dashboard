# MFit Kompas — Desktop and authentication reliability / 20-scenario verification
**Date:** 2026-11-01  
**Canonical repository:** `eshwarjay0-delS/job-dashboard`  
**Owner requirement:** avoid demo failure before customers/investors; test before claiming release; separate source-tested, signed-in endpoint-tested and installed native-device-tested.

## Source audit / exact evidence
- Inspected last 100 master commits (Oct 31–Nov 1) and latest master, CI and Vercel live alias. Baseline at branch creation: `3f8172bb85fc25fc623f04fc1805d95026958654`. Vercel READY on exact SHA, aliases assigned and no alias error. **READY confirms deployment, not end-user auth success.**
- Current active Mfit Supabase project `ruajlrzmxzprmmngluxy` is ACTIVE_HEALTHY. Read-only schema confirmed `public.kompas_desktop_handoffs`, `public.kompas_account_sessions`, `public.kompas_account_session_artifacts` exist with RLS. `claim_kompas_desktop_handoff(text)` exists. Related database migrations are recorded. No private session row contents were accessed or altered. A real mint/redeem roundtrip has not been performed.
- Outstanding GitHub PR #163 contains a draft cleanup of Bearer identity fallback. Review found the current `src/lib/supabase/server.ts` still silently falls back to cookie identity for a **present but malformed** Authorization header; some direct `createClientFromRequest` API routes are affected even if `authenticatedUser` rejects malformed headers independently.
- Desktop launcher and signed-in session acceptance are NOT established by source-marker tests alone. Windows OS protocol registration, installed executable update state, extension profile isolation, real Chrome Google OAuth callback, phone mic, device audio routing and WhatsApp remain actual-device gates.

## Fix under test
For `createClientFromRequest` only, a literally absent Authorization header may use browser cookies. An explicitly present malformed header returns an anonymous fail-closed client. A syntactically valid Bearer token remains the explicit identity and is validated by Supabase `getUser()`; expiry or rejection never chooses a different cookie account. No bypass, mocked production credentials or relaxation of the owner boundary.

## Twenty-fold regression matrix
The new `scripts/tests/kompas-desktop-auth-20fold.test.mjs` has **20 independent scenarios** (plus a count/uniqueness assertion), exercising production request-client code under a stubbed identity service and actual shared session merge helpers.

| Case | Test objective |
|---|---|
| 01 | Absent header may use same browser cookie identity |
| 02 | Valid explicit Bearer uses its own identity |
| 03 | Lowercase bearer scheme |
| 04 | Mixed-case bearer scheme |
| 05 | Tab-delimited bearer syntax |
| 06 | Explicit empty header fails closed |
| 07 | Missing Bearer payload fails closed |
| 08 | Whitespace-only Bearer fails closed |
| 09 | Wrong authentication scheme fails closed |
| 10 | Multiple space-delimited bearer tokens fail closed |
| 11 | Invalid token never becomes cookie identity |
| 12 | Expired token never becomes cookie identity |
| 13 | Header newline injection cannot select cookie identity |
| 14 | Missing Supabase configuration is anonymous for cookies |
| 15 | Missing Supabase configuration is anonymous for bearer |
| 16 | Remote cloud session becomes visible on second device |
| 17 | Disjoint edits produce independent minimal patches |
| 18 | Cloud deletion tombstone defeats stale local change |
| 19 | Pending change preserves newest remote fields |
| 20 | Desktop launch uses short-lived ticket, single-use claim and no resume/JD in deep-link URL |

The workflow also executes existing desktop sign-in callback state, auth boundaries, refresh lock, session continuity, ticket and database-migration contract suites.

**Honesty of the test layer:** all twenty run inside Node with a controlled local identity-provider stub; desktop OS/browser integration is not reproduced. The handoff contract case checks real source invariants but does not mint a production ticket or install an exe. These tests are *regression protection*, not proof of investor-ready native release.

## Mandatory release acceptance checklist (not inferred from CI)
- CI current PR SHA succeeds including Lint, TypeScript, migration parity, 20-fold and Webpack.
- Vercel preview or exact master target is READY on the intended SHA, production alias verified, and auth error clusters reviewed.
- On a real Windows installation signed in with an approved test account: cold launch, browser OAuth, callback nonce/state, token expiry/renewal after idle, network outage/recovery, sign-out, account switch, second-device session created/edited/deleted, long instructions, single-use handoff and live microphone + system audio.
- Cross-account negative test with two *consented* accounts must show no session, document or bearer/cookie crossover.
- On Android: full screen within device safe area, mic permission, actual speech capture and stop/silence behavior, no illicit device-output capture promise.
- WhatsApp: explicit opt-in, voice transcription with actual consented test media, 'kompas' and 'revert', minimal latency, session scope verified.
- Preserve video/screen/voice and account-state distinctions; record actual measured timing p50/p95, not synthetic timing.
- If any test fails, keep failed case open, isolate root cause, rerun and record commit SHA. Do not call deployment READY equivalent to end-to-end accepted.

## Release decision
Implementation and source regression will be called complete only after CI passes and the fix merges. **Native/real-user acceptance stays pending** until an authorized signed-in Windows and mobile test has been executed. A separate follow-through task tracks open cases; never hide them as completed.
