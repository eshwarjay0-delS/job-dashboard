# WhatsApp profile gap-fill acceptance mismatch — 11 November 2026

## Production evidence

At the time of the four logged errors, the canonical production alias `job-dashboard-fawn.vercel.app` resolved to READY deployment `dpl_F6JaLHAps4vNcwMHSdHjrPBXW2Fz`, exact master SHA `65bdf2f8cf1dd7299b8623885641400efe57bbfe`. After the verified 0.8.8 manifest environment update, the alias moved to READY same-SHA deployment `dpl_5ipmErFiEhTsp5tEupta39o8EA1K`.

The aggregated 24-hour runtime-error view reported seven WhatsApp tailoring quality-gate rejections across seven users, with the latest at 2026-11-11 19:50:37 UTC. A 30-minute log read returned four concrete failures at 19:37:46, 19:43:25, 19:49:49 and 19:53:54 UTC, all on that production deployment. Their common shape was:

- literal coverage 100 and supported coverage 100
- `partial: true`, quality status `needs_review`, `incomplete: true`
- blockers `draft_parts_missing`, `quality_incomplete`, `quality_not_deliverable`
- five roles, zero unverified additions, zero floor-placed terms, zero reverted bullets
- one event also included `role_evidence_gaps`

These logs contain counts and blocker codes only. They do not expose the actual DOCX, JD, missing part index or `pendingProfile` flag.

## Source-level diagnosis

In `src/lib/tailor.ts`, the first split-draft profile part accepts a reply when any requested profile field has content: skills, summary or headline. The later gap-fill and extra generate-then-tailor paths used a narrower predicate that accepted a profile reply only when `e.skills` was non-empty. A valid summary-only or headline-only repair could therefore be discarded as an empty response.

The first repair callback clears `pendingProfile` only when a profile part is accepted. The extra generate-then-tailor callback previously copied the old `partial` state without resolving the accepted part. Together, these mismatches can leave `draft_parts_missing` set even after a usable profile repair. The live logs do not identify the missing part, so this is a source-supported failure mode and a plausible explanation for the current pattern, not proof that it caused every logged request.

## Change prepared in PR #304

- Add one shared `hasProfilePartContent` predicate and use it for the initial profile draft and both repair paths.
- Add `resolvePendingDraftPart` so an accepted profile repair clears only the profile flag and an accepted experience repair clears only that role's pending state.
- Add regressions for summary-only, headline-only, skills-only, empty/disabled output, profile-versus-role state isolation, and wiring of all three acceptance paths.
- No coverage threshold, evidence rule, identity guard, WhatsApp send policy, or external-send behavior is relaxed.

## Verification boundary

No live model call, resume-library write, DOCX generation, email, WhatsApp send, or production data mutation was performed. The code branch remains a draft and must pass exact-head full CI, WhatsApp recovery regression, Kompas baseline and the protected preview gate before any merge. The Plan/REA entry and schema check are tracked in PR #296. The Vercel project currently reports `live:false` and the protected preview is blocked; do not bypass that access control.

The separate 17 October 17:28 Chicago incident remains an unresolved historical-delivery case. Its generated output DOCX, per-run R2 object key, webhook/request correlation ID, Meta message ID and signed delivered/read receipt are still unavailable. The original source pair remains quarantined pending owner reconciliation of conflicting factual claims. This code fix does not retroactively prove or replay that delivery.
