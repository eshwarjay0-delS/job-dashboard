# WhatsApp role-rewrite gate investigation — 11 November 2026

## Scope

Investigate why a recent WhatsApp resume request was rejected despite the runtime reporting complete literal and supported keyword coverage. This is a source and runtime-log analysis only. It does not change the 6 November channel policy, the evidence boundary, identity checks or external-send eligibility.

## Sanitized production signal

At 2026-11-11 22:19:52 UTC, a production `/api/whatsapp/webhook` event recorded:

- 100% instrumented literal/supported coverage.
- Five roles and `partial=true`.
- `unverifiedCount=0`, `placedFromJd=0`, `bulletsReverted=0`.
- Blockers: `draft_parts_missing`, `quality_incomplete`, `quality_not_deliverable`, `roles_unrewritten`.
- No `role_evidence_gaps` blocker.

These are runtime diagnostics about a rejected draft. They are not a measurement of a completed, downloaded or independently reviewed DOCX, and they do not establish a 98% live resume match.

## Source trace

1. `src/lib/tailor.ts` calculates `experienceComplete` from `experienceCoverageComplete(...)` and separately calculates `lackingRoleCount` from the number of bullets rewritten per counted role.
2. `src/lib/tailor-ship-on-rollback.ts` emits `roles_unrewritten` whenever `lackingRoleCount > 0`, independently of whether `experienceComplete` is true. It emits `role_evidence_gaps` only when `experienceComplete` is false.
3. `src/lib/tailorLanes.ts` documents that a wide model lane may return an empty edit when an older role honestly needs no change; narrow lanes retry empty responses because they may indicate model failure.
4. The runtime event's lack of `role_evidence_gaps` therefore indicates that the configured role-evidence completeness predicate passed, while the independent 30% rewrite-count gate failed.

## What is not established

- The event does not identify `pendingRoles` or `pendingProfile`; `partial=true` remains unattributed.
- No exact generated DOCX, per-run R2 key, webhook/request correlation, Meta message ID or signed delivery/read receipt was available.
- The original 17 October source DOCX and matching JD remain separate from this 11 November event; their conflicting education, employment and credential claims remain quarantined pending owner reconciliation.
- No live model call, DOCX write, R2 mutation, WhatsApp send or handset acceptance occurred.
- The production project's `AUTH_DISABLED` and `NEXT_PUBLIC_AUTH_DISABLED` flags were independently checked as `false`; no authentication bypass is active.

## Decision

No code or delivery policy was changed. The 30% rewrite requirement may be intentional. Although the source comments reveal a possible tension between “an old role may honestly need no change” and the independent rewrite-count blocker, removing or changing that blocker requires an explicit owner decision. Do not weaken the configured role-evidence threshold, the 6 November WhatsApp policy, same-account identity validation, or incomplete-draft fallback.

## Proposed regression matrix if the owner approves a policy change

- A role already passing the configured evidence-completeness predicate may be accepted without unnecessary paraphrasing.
- A role below the evidence-completeness predicate remains blocked even if 30% or more of its bullets were rewritten.
- A writer part that is actually pending or failed remains incomplete; role evidence completeness must not erase `partial`.
- Unsupported JD-only claims, certifications, employers, dates and metrics remain excluded.
- Web's 95% raw-overlap floor and the 6 November WhatsApp 70% shortfall / 95% supported-coverage clean-pass rules remain unchanged.

## Exact blockers and next action

- Owner decision is missing on whether an evidence-complete role can pass without 30% bullet rewrites.
- PR #304's profile-part repair has exact-head full CI, WhatsApp recovery and baseline green, but its protected preview failed while Vercel project metadata reports `live=false`; it is not deployed.
- PR #303's exact-head full CI, WhatsApp recovery and baseline workflows remain queued; it is draft and not deployed.
- The 17 October replay still needs the generated DOCX, per-run R2/webhook/Meta evidence, signed delivery/read receipt and owner fact reconciliation.

Continue: keep all existing gates unchanged; monitor the exact-head PR #303 checks and protected-preview availability for PR #304, and do not call this rejection resolved until an authenticated completed DOCX and production acceptance are available.
