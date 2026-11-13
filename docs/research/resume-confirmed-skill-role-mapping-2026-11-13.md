# Confirmed-skill mapping across resume roles — 13 November 2026

## Owner decision

The owner-approved correction from 6 November 2026 at 9:55 AM CT was reiterated in the owner-authored GitHub comment [6817645128](https://github.com/eshwarjay0-delS/job-dashboard/issues/317#issuecomment-6817645128) on 12 November: an explicit first-person candidate-confirmed skill may be mapped naturally into relevant existing project bullets across roles, including earlier roles, without same-role source wording.

The confirmation supports the named skill only. It does not authorize a new employer, project, action, outcome, date, title, location, contact detail, metric, credential or unsupported project fact. JD wording, target scores and editing instructions are not candidate evidence. Separate account libraries stay separate. Conflicting source-resume chronology, education and credential claims remain quarantined until reconciled by the owner.

## Implementation carried forward from PR #317 / #345

- candidateEvidenceInput separates candidate confirmations from JD requirements and editing requests.
- confirmedCandidateStatements accepts only explicit positive first-person assertions, rejecting questions, negations and imperative editing language.
- roleScopedMissingTerms and missingRoleEvidenceTerms keep unconfirmed gaps scoped to the role whose source bullets support them.
- Explicitly confirmed skills may be mapped into relevant existing project bullets across roles, including earlier roles, without requiring the same role's original bullet to name the skill.
- restoreUnsupportedRoleEdits restores a bullet when the writer introduces an unconfirmed term unsupported by that employer role.
- Tailor cache generation advances to 28; diagnostics can report bullets_reverted_for_role_evidence.
- The new resume-confirmation-quality test suite covers editing-instruction rejection, explicit confirmations, cross-role mapping, identity-fact boundaries and unsupported-claim rollback.

## Current-master extraction

The code was extracted from PR #345 onto current master 4c01951 in branch:

- fix/resume-confirmed-skill-role-mapping-restack-4c01951-20261113
- Implementation commits: 66df191e652cdde26bcf76399cfaaf3d009de2e6, b28846643c6a2e8913cab51f67db3d04297c9eb8, 28e1af2ee8515637d79df492d0d08e6dc905363d and 79df24a6c9678b469118fbad01e675bb8d0b9a10
- The extraction contains only resume-evidence.ts, claude.ts, tailor.ts and resume-confirmation-quality.test.mjs. It does not carry the WhatsApp storage/CAS changes from PR #344 and does not change package.json or the Kompas deploy-build test.
- The quality test is already included in the canonical full-CI resume test step. Fresh exact-head checks on this independent branch are pending.

The source PR #345 exact head 3390272c63e81c7879375625b172f1ac0c254402 passed full CI 43351228992, Kompas baseline 43351228991, cross-device 43351229135, WhatsApp recovery 43351229088, Windows packaging 43351229003 and Plan/REA schema 43351229002. Those checks validate the stacked source head, not this new independent branch. The source branch's protected preview was not established; the original source preview failed closed because the private KOMPAS_VERCEL_API_TOKEN was unavailable. Do not bypass protection or claim deployment.

## Acceptance still required

A synthetic test suite is not a live resume/JD match. After exact-head checks and protected preview, perform an owner-authorized baseline + JD + explicit-confirmation run; inspect the exported DOCX for preserved structure and unsupported facts; record raw and weighted keyword coverage without rounding; and separately complete the approved final-DOCX Gemini ATS-score review. No 95–100% live match or 98% result is claimed.


## Prompt-label regression

A source review found that candidateEvidenceInput(opts.jd, ...) labeled the JD string as “ORIGINAL SUBMITTED TEXT”, even though the value is the job description. That label could blur the boundary between target requirements and candidate evidence. The prompt now labels it “JOB DESCRIPTION (target requirements, not candidate evidence)”. The resume-confirmation-quality test asserts the new label and rejects the former label. Commits: 08065f4bcfc2cc2b7ca3b6436c9b6b715f562a7d and d31b599cf7d2121878e7a0f78275cf0e2fcdfd7c.


## Role-relevance review correction — 13 November 2026

A review found that the initial deterministic final guard allowed every explicitly confirmed JD term in every employer role. That was broader than the owner's approval. The approved exception is cross-role, but only into a relevant existing project bullet.

The guard now checks the original bullet's project context:
- Known skill families (security/endpoint, identity/access, cloud/infrastructure, blockchain/ledger, data/analytics, CRM/ITSM, software/automation, and governance/compliance) require a matching context marker in that original bullet.
- Unknown skill names are not transferred across roles unless the source bullet itself supports the term.
- The confirmed skill still does not create a new employer, project, action, outcome, date, title, location, contact, metric or credential.
- This does not reintroduce the old same-role source-wording requirement: an earlier endpoint project can receive a confirmed CyberArk EPM skill even when the original bullet does not name CyberArk, and an earlier ledger project can receive a confirmed Canton skill.

Regression coverage includes both positive relevant earlier-role cases and negative unrelated Salesforce-marketing and unknown-skill cases. Implementation commit 054372d8; test commit 35684402. Exact-head full CI, baseline, WhatsApp recovery and Plan/REA checks must rerun; the previous PR #352 green checks predate this correction. Protected preview and actual owner-authorized DOCX acceptance remain pending.


## Current-master restack — 13 November 2026, run 11

The source PR #352 branch is based on older master `4c01951` and is merge-conflicting. Its reviewed resume-only changes have been extracted onto current canonical master `026c72968e45314ff0a99f701942c966e79f0a1e` in branch `fix/resume-confirmed-skill-role-mapping-master-026c729-run11-20261113`.

Copied runtime/test scope:
- `src/lib/resume-evidence.ts`: explicit first-person confirmation parser, JD-as-target label, role-scoped evidence and relevance-family checks for confirmed skills.
- `src/lib/claude.ts`: writer prompt permits confirmed skills in relevant existing project context across roles without requiring same-role source wording.
- `src/lib/tailor.ts`: cache generation 28, role-scoped gap repair, cross-role confirmed-skill placement, deterministic restoration of unsupported JD terms, and a diagnostic count of reverted role-unsupported bullets.
- `scripts/tests/resume-confirmation-quality.test.mjs` and `scripts/tests/resume-guards.test.mjs`: positive relevant earlier-role cases, negative unrelated-project/unknown-skill cases, prompt-label and identity-fact boundaries.

The restack also carries `docs/resume.md` and the Oct 17 evidence audit, but does not copy stale WhatsApp code or profile-gap PR #353. Implementation commits: `e34a1215f535e153f041bfd1ae86b4db3b33044d`, `788a7ca0e75885c2f36888006f2fe86b5d3a745a`, `e6d72488ad26afc666f8471c75429fe9a8794580`, `e9e27573e82c520a03c3e81d9226f9189b961fa6`, and `4a72102e6dc0b5cc1b0a1ed219b2e64181ee048c`.

The exact-head GitHub Actions checks are pending. Local `npm ci` and tests could not run because the Vercel sandbox API returned HTTP 400 and the container could not resolve GitHub; no local execution is claimed. The legitimate protected Vercel preview still requires the private `KOMPAS_VERCEL_API_TOKEN`; no bypass was attempted.

The actual 17 Oct source/JD case remains separate: prior private review recorded the source DOCX and matching JD recovery, but current execution did not rematerialize the source bytes; the generated output DOCX, per-run R2 object/version, webhook correlation, Meta message ID and signed delivery/read receipt remain unavailable. Conflicting source education/employment/tenure/credential facts remain quarantined. No model call, DOCX export, historical replay, R2 write, real send or handset acceptance occurred. No 95–100% or 98% live-match claim is supported by these source tests.


## Context-specificity regression — 13 November 2026

A source review of the confirmed-skill family map found that CyberArk shared a broad security-tool context containing generic terms such as administrator, access, audit and compliance. That could let an explicit CyberArk EPM confirmation qualify in a generic Salesforce Administrator or compliance-audit bullet, even though the owner-approved exception requires a relevant existing project context.

CyberArk now has its own context family: endpoint, local administrator, privilege, elevation, application control, least privilege, software restriction, application allowlist/greylist and Windows hardening. The broader security context remains available to the other security tools. Regression coverage rejects generic CRM-administration and audit/compliance bullets while retaining the endpoint/local-administrator positive case.

This narrows relevance only. It does not restore the superseded same-role source-wording requirement, and it does not create an employer, project, action, outcome, date, title, location, contact, metric or credential. No model call, DOCX export, live match score or user-library write occurred.

Implementation commit: 185d0252c19c3eb3c2ef49fbe5e2c760fe3fc88b. Regression commit: f92c007f6407101fcf5a36f105c2a8fb90abbc21. Exact-head CI and the protected preview must still pass before this remains eligible for release.
