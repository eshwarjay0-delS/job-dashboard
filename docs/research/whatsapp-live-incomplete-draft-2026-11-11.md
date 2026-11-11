# WhatsApp incomplete-draft recurrence — 11 November 2026

**Method:** Source and production-log analysis. No model generation, real WhatsApp send, replay, R2 write, or private document inspection was performed in this run.

## Original request and boundary

Continue the unresolved 17 October 2026 17:28 Chicago WhatsApp resume incident, and improve resume/JD/confirmed-experience alignment without inventing employers, dates, credentials, metrics, or experience. Keep the selected account, resume and JD bound together. The 6 November channel-specific policy supersedes the earlier 98% hard hold: an incomplete or identity-mismatched rewrite must not be presented as a completed tailored file.

## Current production observation

- Canonical master: `7a7362766fa793af6b3eb8ed19b3235e302645dd`.
- Vercel deployment: `dpl_Hca18aPST4C7fmaTH3V1V3yWzWu1`, READY/production; alias metadata assigns `job-dashboard-fawn.vercel.app` to it.
- Vercel project metadata still reports `live:false`; public HTTP/version and authenticated user-flow checks could not be completed from this runtime.
- At `2026-11-11T15:42:10.931Z`, `POST /api/whatsapp/webhook` logged a rejected draft:
  - coverage 100; supported coverage 100
  - `partial=true`; quality status `needs_review`; `incomplete=true`
  - blockers: `draft_parts_missing`, `quality_incomplete`, `quality_not_deliverable`, `role_evidence_gaps`
  - five roles; zero unverified additions; zero JD terms placed; zero reverted bullets; `cached=false`

These fields do not establish factual 100% experience coverage, a complete DOCX, or delivery. A score can be 100 while the role writer remains incomplete.

## Source-path findings

- `src/lib/whatsapp-resume-acceptance.ts` rejects partial/incomplete output.
- `src/app/api/whatsapp/webhook/route.ts` attempts to send the already-selected same-account source resume only if `chosenResumeMatchesProfile` passes. The available runtime log does not prove that this fallback was accepted by Meta.
- `src/lib/tailor.ts` on current master still contains the older global JD-to-role prompt and final weave. PR #287 proposes role-scoped evidence enforcement, but has only non-approving owner reviews and is not mergeable. That change may address cross-role evidence leakage; it does not by itself explain or fix `draft_parts_missing`.
- The Vercel trace lookup returned `not_found`. The one-hour runtime-log query exceeded Hobby retention; the later request-filtered 30-minute query began after the event. No signed Meta delivery/read receipt was available.

## Historical 17 October incident

The exact generated output DOCX, per-run R2 key, webhook/request correlation, Meta message ID and signed delivered/read receipt remain unavailable. The source DOCX and matching JD were recovered in earlier read-only work, but education, employment chronology, tenure and credential claims conflict with owner-confirmed facts and remain quarantined. Search results do not prove no other copy exists. The exact historical output cannot be recreated from a screenshot or recruiter email.

## Release and test evidence

- Master full CI run `43047316079` failed at the WhatsApp Kompas channel harness because its VM loader omitted the new `@/lib/appOrigin` mock. The failure is in the test loader, not evidence of a live WhatsApp Kompas routing failure.
- PR #299 contains a test-only mock and absolute shared-session URL assertion. Its previous exact head passed full CI `43039038461`, Plan/REA schema `43039038409`, and Kompas baseline `43039038063`. The branch is behind/diverged from current master; the new documentation commits still need exact-head checks. Its protected preview requires the private `KOMPAS_VERCEL_API_TOKEN`, which is unavailable. Keep the PR Draft and unmerged.
- Runtime logs also recorded Supabase `exceed_egress_quota` HTTP 402 on Gmail notify-rule export. No billing change, project unpause, secret retrieval, or protection bypass was attempted.

## Exact blockers and next action

1. Recover the exact generated output DOCX, per-run R2 key, webhook/request correlation, Meta message ID and signed delivery/read receipt for 17 October.
2. Have the owner reconcile the conflicting source education/employment/tenure/credential facts before using them as evidence or fixtures.
3. Obtain formal owner approval and a protected exact-head preview for PR #287; then separately test the role-scoped writer and missing-part timeout behavior against an authenticated exported DOCX.
4. Restore Supabase/Vercel access through the authorized owner/provider path. Do not change billing or bypass the protected preview.
5. Do not send a real WhatsApp test, replay the historical message, or claim fallback delivery without a provider receipt.

**Status:** Historical incident blocked; current production incomplete-draft recurrence observed; no runtime fix implemented or deployed by this research pass; actual Meta delivery remains unverified.
