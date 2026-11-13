# Confirmed-skill mapping across resume roles — 13 November 2026

## Owner decision

Owner-authored GitHub comment [6817645128](https://github.com/eshwarjay0-delS/job-dashboard/issues/317#issuecomment-6817645128) records the 6 November correction: an explicit first-person candidate-confirmed skill may be mapped naturally into relevant existing project bullets across roles, including earlier roles, without same-role source proof.

The confirmation supports the named skill only. It does not authorize a new employer, project, action, outcome, date, title, location, contact detail, metric, credential or unsupported project fact. Job-description wording, target scores and editing instructions are not candidate evidence. Keep separate account libraries separate. Conflicting source-resume chronology, education and credential claims remain quarantined until the owner reconciles them.

## Implementation carried forward from PR #317

- `candidateEvidenceInput` distinguishes candidate statements from JD requirements and editing requests.
- `confirmedCandidateStatements` accepts only explicit positive first-person assertions, rejecting questions, negations and imperative editing language.
- `roleScopedMissingTerms` and `missingRoleEvidenceTerms` keep unconfirmed gaps scoped to the role whose source bullets support them.
- Explicitly confirmed skills may be mapped across relevant existing roles, including earlier roles, without requiring the same role's original bullet to name the skill.
- `restoreUnsupportedRoleEdits` restores a bullet when the writer introduces an unconfirmed term unsupported by that employer role.
- Tailor cache generation advances to 28; diagnostics can report `bullets_reverted_for_role_evidence`.
- The new `scripts/tests/resume-confirmation-quality.test.mjs` covers editing-instruction rejection, explicit confirmations, cross-role mapping, identity-fact boundaries and unsupported-claim rollback.

## Evidence and restack

Source PR #317 exact head `79816427c6b08c2c46e82d4c8662995960a2a8ae` passed full CI `43308813566`, Kompas baseline `43308813534` and WhatsApp recovery `43308813554`. Its protected preview `43308809499` failed closed because the private `KOMPAS_VERCEL_API_TOKEN` was unavailable; protected HTTP checks were skipped.

The source branch is seven commits behind current master and its `package.json` / deploy-build test changes overlap later master edits. The current-master restack therefore preserves the newer prebuild/deploy-test files and adds the new quality suite to the existing prebuild command, with the matching exact assertion updated. The new branch is `fix/resume-confirmed-skill-role-evidence-current-master-20261113`, stacked on WhatsApp PR #344 head `1eb5e6c490179518fd7ae79748bc1cde31dd7d18`. Fresh exact-head CI, baseline, WhatsApp recovery and protected preview remain required. It is not deployed.

## Acceptance still required

A synthetic test suite is not a live resume/JD match. After protected preview and normal release gates, run an owner-authorized real baseline + JD + explicit-confirmation case; inspect the exported DOCX for preserved structure and unsupported facts; record raw and weighted keyword coverage without rounding; and separately review the approved final-DOCX ATS diagnostic. No 98% live match is claimed here.
