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
- No coverage threshold, identity guard, WhatsApp send policy, or external-send behavior is relaxed. The evidence boundary remains fail-closed for JD-only and unconfirmed terms; explicit first-person skill confirmations are a separate owner-approved evidence source and may be mapped into relevant existing project bullets across roles.

## Verification boundary

No live model call, resume-library write, DOCX generation, email, WhatsApp send, or production data mutation was performed. The code branch remains a draft and must pass exact-head full CI, WhatsApp recovery regression, Kompas baseline and the protected preview gate before any merge. The Plan/REA entry and schema check are tracked in PR #296. The Vercel project currently reports `live:false` and the protected preview is blocked; do not bypass that access control.

The separate 17 October 17:28 Chicago incident remains an unresolved historical-delivery case. Its generated output DOCX, per-run R2 object key, webhook/request correlation ID, Meta message ID and signed delivered/read receipt are still unavailable. The original source pair remains quarantined pending owner reconciliation of conflicting factual claims. This code fix does not retroactively prove or replay that delivery.

## 11 November 2026 — 22:16 UTC production recheck

The later 24-hour runtime-error query now reports 11 WhatsApp tailoring quality-gate rejections across 10 users; the latest event is 2026-11-11 22:16:15 UTC on production deployment dpl_5ipmErFiEhTsp5tEupta39o8EA1K (master 65bdf2f8cf1dd7299b8623885641400efe57bbfe). The latest 30-minute query contains one detailed event. Its counts remain literal coverage 100 and supported coverage 100, but partial=true, status=needs_review and incomplete=true. Blockers are draft_parts_missing, quality_incomplete, quality_not_deliverable and roles_unrewritten. It has five roles, zero unverified additions, zero floor-placed terms, zero reverted bullets and cached=false.

This new roles_unrewritten blocker is important: the PR #304 profile-part acceptance fix may address one source-supported failure mode, but the newest event shows that role rewriting can also remain incomplete. The logs still do not reveal the missing draft part, actual resume/JD or pendingProfile value. Do not call PR #304 a complete fix based on the source tests.

PR #304 exact head 6a15dad591a956e2b7cae6ec30f2ecd4d53909a3 now has full CI 43094812633 SUCCESS, WhatsApp recovery 43094812579 SUCCESS and Kompas baseline 43094812748 SUCCESS. The protected voice-preview gate 43094807518 FAILED; its job-log read timed out, so the narrower cause is not known. The branch remains DRAFT and is not deployed. The live alias still points to master 65bdf, not PR #304.

The separate 17 October 17:28 Chicago historical case remains blocked: the 27,724-byte original DOCX and matching full JD are recovered read-only, but the generated output DOCX, R2 object key, webhook/request correlation ID, Meta message ID and signed delivery/read receipt remain unavailable. The source DOCX conflicts with owner-confirmed education/employment/credential facts, so those claims remain quarantined pending owner reconciliation. iZap has no connected WhatsApp number and no matching history. No model call, DOCX write, R2 mutation, WhatsApp message or handset test was performed.

 
## 12 November 2026 — exact-head and production recheck (04:13 UTC)

The latest 24-hour production aggregation reports 11 WhatsApp tailoring quality-gate rejections across 10 users, latest `2026-11-11T22:16:15Z`. The last 30-minute error-log query returned no WhatsApp failures. This does not prove that the profile-gap mismatch is resolved or that any DOCX was delivered.

PR #304 exact head `667c9ab3be3d58dac8ef00962b71b9158ce8456e` has full CI `43139954490`, Kompas baseline `43139954651` and WhatsApp recovery `43139954504` SUCCESS. It remains DRAFT because the protected preview workflow `43139950971` cannot access the private `KOMPAS_VERCEL_API_TOKEN`. The owner or authorized repository administrator must configure that secret privately; no preview bypass was attempted.

The change fixes a source-supported mismatch between profile-part acceptance and pending-draft state resolution; the production logs do not expose the missing part index or `pendingProfile`, so the exact runtime root cause is not proven for every rejection. The 17 Oct historical delivery remains a separate unresolved case. No live model call, DOCX generation, resume-library write, R2 mutation, Meta send or authenticated handset test occurred.


## 12 November 2026 — owner correction to confirmed-skill attribution

The 6 Nov 2026 9:55 AM CT owner clarification, recorded in journal entry `whatsapp-constructed-jd-finish-2026-11-06` and reaffirmed in PR #319 comment 6817645128, supersedes the earlier same-role-only interpretation: when the candidate explicitly confirms a JD skill, that confirmation is sufficient to map the skill naturally into relevant existing project bullets across roles, including earlier roles, even if the original bullet does not name the tool. Employer-source verification is not an extra prerequisite for that confirmed skill.

This is not permission to infer a skill from the JD. The confirmation must be an explicit first-person candidate statement (or the owner's narrow blanket confirmation of all listed requirements). A confirmed skill may be used in an existing project context; it does not create a new project, employer, action, outcome, title, location, date, contact, metric or credential. Do not force a skill into unrelated roles, and do not mix the selected account's resume with another account's library. The historical source DOCX's education/employment/tenure/credential conflicts remain quarantined.

The current-master restack PR #317 was updated on branch `fix/resume-role-evidence-restack-da1db145-20261112` through commits `dfcd2b4`, `14ac764`, `216581d` and `2851eaa`. The writer prompt now allows confirmed skills in relevant existing project bullets; the final deterministic guard permits only those confirmed terms across roles while still restoring unconfirmed cross-role terms; per-role alignment counts a confirmed term only when it is actually present in that role's edited bullets. Exact-head CI/recovery/baseline for `2851eaa` are pending. The protected preview remains blocked by the missing private `KOMPAS_VERCEL_API_TOKEN`; no merge or deployment occurred.

No live model call, DOCX generation, library write, R2 mutation, Meta send or handset test occurred. The profile-part acceptance fix remains a source-supported failure mode, not proof that it caused every production rejection.
