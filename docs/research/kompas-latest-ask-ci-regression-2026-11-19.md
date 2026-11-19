# Kompas latest-ask caption-once CI regression — 19 November 2026

## Owner decision

The 19 November owner correction (9:25–9:27 AM CT, recorded in `docs/completion-watch.md`) is authoritative: a manual AI Answer press starts immediately with the latest already-heard question; the next two seconds of transcript may be folded in once only when they materially change that question. Caption Capture remains a separate one-shot path that uses only the uniquely selected Windows Live Captions window. The ordinary microphone/call-audio path is not routed through the stricter screenshot recognizer.

## Exact release and CI evidence

- Canonical repository: `eshwarjay0-delS/job-dashboard`.
- Master: `5332e1459429644f661f969dbcd7ccb92fe525d0`.
- Production deployment: `dpl_2fVQUdmo7YD4TZ2rKx1rU5MJCFfM`, READY, production, exact SHA above; the canonical alias was independently confirmed by Vercel metadata.
- GitHub push workflow `44561744692` (CI — Lint · Type-check · Build · Audit) failed in job `135692584542`. Lint and type-check passed. The caption one-shot suite reported 138/139; subtest 52 failed because it still required the removed expression `await flushHeard(options.captionOnce ? 250 : 1500)`.
- The same master push had successful Vercel deployment verification `44561744508`, Windows executable workflow `44561744553`, Plan Journal/REA regression `44561744672`, Kompas baseline `44561744578`, and contract crawler manual-only regression `44561744503`.

## Root cause

This is a stale regression assertion, not evidence that the production runtime reverted. In current `public/kompas/app.js`, the one-shot `options.captionOnce` branch validates the frozen caption question and returns directly to `generateAnswer(..., source: "caption-window")` before the normal microphone/call-audio press flow. The normal manual press path explicitly does not wait for `flushHeard`; automatic capture still retains its bounded `flushHeard(1500)` path. The newer `scripts/tests/kompas-latest-ask.test.mjs` also covers latest-question selection, immediate manual press scheduling and the two-second late-context fold.

## Corrective change

Branch: `fix/kompas-caption-once-ci-20261119-1713`, based on exact master `5332e1459429644f661f969dbcd7ccb92fe525d0`.

The test-only correction replaces the obsolete delay assertion with checks that:
1. the one-shot caption branch returns before the normal press flow and does not call `flushHeard`;
2. the manual press branch does not await `flushHeard`;
3. automatic capture still keeps its bounded 1.5-second flush.

No runtime source, provider, auth, account-isolation, capture permissions, audio path or answer behavior is changed.

- Test commit: `0f21fb5d00ad40ea10d865e9ded9b87eba3ff40f`.
- Exact-head full CI, Kompas baseline and Plan/REA checks are pending on the final PR head.
- This correction does not prove a live resume/JD match, actual model quality, or native Windows behavior.

## Verification limits and blockers

- Vercel reports the production deployment READY on the exact master SHA, but public HTTP smoke for `/api/health`, `/kompas/version.json`, `/kompas/latest-ask.js` and `/kompas/` could not be completed from this scheduled runtime: both the browser fetch and container request failed at DNS resolution. Do not treat alias metadata as route-level HTTP smoke.
- No authenticated Windows device, browser session, phone or WhatsApp session was available for real UX acceptance.
- The 50 actual authenticated Kompas-versus-ChatGPT answer pairs and independent human grades remain open.
- The separate Kompas Continuous Voice Delivery automation is disabled in the accessible inventory; no duplicate voice/caption implementation was started.

## Continue

Run exact-head CI, Kompas baseline and Plan/REA on the completed PR head. Keep this PR test-only and let MFit Safe Merge Gate sequence it with the other shared Plan/REA branches. Do not change the immediate-answer runtime path, do not claim native acceptance, and retry public route smoke only when DNS/network access is available.
