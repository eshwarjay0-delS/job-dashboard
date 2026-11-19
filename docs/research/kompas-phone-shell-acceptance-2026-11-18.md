# Kompas phone-native shell and live relevance acceptance — 18 November 2026

## Approved source scope

The owner-approved 31 October request is a full-screen, device-adaptive Kompas phone view. PR [#444](https://github.com/eshwarjay0-delS/job-dashboard/pull/444), exact head `8d1be1f3153e20b974d4f4dcfac7616453836192`, adds `public/kompas/mobile-shell.css`, markup and source tests. It respects safe areas, dynamic viewport sizing, internal answer/transcript scrolling and touch-target dimensions.

It explicitly excludes microphone, computer audio, Caption Capture, input-source and voice pipeline behavior. This continuation did not change those areas.

## Exact-head source checks

All six PR #444 checks passed:
- Full CI 44143476207.
- Account-session sync 44143476089.
- Kompas baseline 44143475852.
- Windows EXE 44143475922.
- Plan/REA schema 44143475909.
- Desktop-change skip gate 44143475922.

The PR remains DRAFT. Source checks do not establish actual iOS/Android behavior.

## Remaining phone acceptance

A real owner-consented device pass is still required for installed-PWA behavior, safe-area cutouts, address-bar and keyboard changes, portrait/landscape, long-answer scrolling and touch targets. No iOS/Android device or authenticated phone preview was available in this run.

PR #444's shared Plan & Vision copy still includes an older Gmail no-hard-cap interpretation. The 17 November owner correction keeps the four-account ceiling. Safe Merge Gate must reconcile the shared Plan/REA wording before #444 can merge.

## Live relevance acceptance

The live quality gate remains at least 50 consented, same-question Kompas/ChatGPT answer pairs from identical approved resume/JD/reference bundles, followed by independent human 0–4 scorecards. The private `KOMPAS_API_TOKEN` and approved source bundles were unavailable. No real paired responses or human scores were generated. Synthetic 50/54-fold tests and green CI are not substitutes.

## Production and voice-task boundaries

Canonical master is `66291f677cbcc2318229ef9a3164961e6d3cdb6a`. Canonical production alias `job-dashboard-fawn.vercel.app` remains READY at older SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. Latest master deployment `dpl_GMD7eF8vAw52sXyTopSuHqebEJq6` was CANCELED because the Ignored Build Step found no `[ship]` tag and exited 0. The Vercel project reports `live:false`; this does not identify a pause reason. Protected preview requires owner-controlled `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run.

The Kompas Continuous Voice Delivery automation is disabled in the accessible inventory. No voice, microphone, audio, caption or latency changes were duplicated. Native Windows, WhatsApp and mobile voice/session acceptance remain separate and unverified.

## Next steps

1. Let Safe Merge Gate reconcile the stale shared Plan/REA wording in #444.
2. Obtain legitimate protected preview and real iOS/Android acceptance.
3. Obtain the authorized API token and approved source bundles for 50 live same-question pairs and independent human review.
4. Keep all voice/caption changes with their separate workstream.
