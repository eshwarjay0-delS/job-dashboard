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
