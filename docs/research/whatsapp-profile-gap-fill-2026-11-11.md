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


## Regression-gate follow-up — 11 November 2026

The two new pending-part assertions initially failed when executed locally because the helper is evaluated in a separate Node VM realm; the returned object's prototype differs even though its fields match. This was a test-harness comparison issue, not a runtime failure. The assertions now normalize the VM result through JSON before strict structural comparison. Both new regression suites are added to the repository's build-time prebuild gate so the profile-part acceptance and role-isolation checks cannot remain unexecuted while CI reports a green build.

Local verification on the dependent branch: resume confirmation + profile gap-fill suites 31/31; Kompas baseline 92/92; TypeScript 0 errors; focused ESLint 0 errors; npm run build -- --webpack completed successfully, including prebuild and the 160-page production build. This is local sandbox evidence only. GitHub exact-head CI, protected preview, production release and authenticated WhatsApp delivery remain separate pending gates. No real model call, DOCX write, R2 mutation, Meta send or email occurred.


## 12 November 2026 — owner-approved confirmed-skill mapping implemented in PR #317

The 6 Nov 2026 9:55 AM CT owner clarification (journal `whatsapp-constructed-jd-finish-2026-11-06`, reaffirmed in PR #319 comment 6817645128) supersedes the earlier same-role-only interpretation: an explicit first-person confirmation of a JD skill is sufficient to map that skill naturally into relevant existing project bullets across roles, including earlier roles, even if the original bullet does not name the tool. Employer-source verification is not an extra prerequisite for that confirmed skill.

This exception supports the confirmed skill only. The JD itself, a formatting instruction or a target score is not confirmation. Do not create an employer, project, action, outcome, title, location, date, contact, metric or credential; do not force a skill into unrelated roles or mix another account's resume/profile. The historical source DOCX education/employment/tenure/credential conflicts remain quarantined.

PR #317 branch `fix/resume-role-evidence-restack-da1db145-20261112` now separates source terms from candidate-confirmed terms, permits only explicitly confirmed terms through the cross-role deterministic guard, counts a confirmed term for a role only when it is present in that role's edited bullets, and bumps tailor cache generation to 28. The new regression test retains confirmed Canton in an earlier project while restoring unconfirmed Splunk borrowed from another role. Exact-head CI/recovery/baseline for `a213f2d` are pending; the prior `f3182de` CI result is superseded. Protected preview still requires private `KOMPAS_VERCEL_API_TOKEN`; no merge or deployment occurred.

No live model call, DOCX generation, WhatsApp/email send, R2 write, production row mutation or handset test occurred.


## 12 November 2026 — exact-head owner-confirmed skill mapping and release gate

The owner’s 6 Nov 2026 9:55 AM CT correction is authoritative: an explicit first-person confirmation of a JD skill may be mapped naturally into relevant existing project bullets across roles, including earlier roles, even when that role’s original bullet does not name the tool. Employer-source verification is not an additional prerequisite for that confirmed skill. This supersedes the older same-role-only interpretation. A JD requirement, formatting instruction or target score alone is not confirmation. The confirmation supports the skill only; it does not create an employer, project, action, outcome, title, location, date, contact, metric or credential. The selected account/resume/JD boundary and the historical 17 Oct disputed source facts remain unchanged.

Current code is in PR #317 at exact head `4ef3cba838ef00dd3702fb6e955628d20ab77664`. The implementation separates baseline-supported and candidate-confirmed terms, allows only explicitly confirmed skills through the cross-role guard, retains the original project frame, and counts a confirmed term for a role only when it appears in that role's edited bullets. Tailor cache generation is 28 so pre-correction outputs are not reused.

Exact-head evidence:
- Full CI run `43180792088`: SUCCESS.
- Resume regression run `43180792058`: SUCCESS.
- Kompas baseline run `43180791965`: SUCCESS.
- Protected preview run `43180787874`: FAILURE. The job log shows `KOMPAS_VERCEL_API_TOKEN` is empty and the resolver exits with “must be configured privately.”

PR #317 therefore remains DRAFT, unmerged and undeployed. The required unblock is for the owner or authorized repository administrator to configure the private preview token and restore legitimate protected-preview access. Do not bypass preview protection, merge or deploy without that gate. No live model call, personal DOCX generation, WhatsApp/email send, R2 write, production mutation or device acceptance occurred. Green CI is not proof of a 98% live resume match and does not resolve the 17 Oct historical delivery.
