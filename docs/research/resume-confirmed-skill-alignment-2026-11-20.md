# Confirmed-skill resume/JD alignment — 20 November 2026

## Approved scope and sources

Accessible owner-authored context on 17 October 2026 confirms that a user may supply JD/baseline keywords and explicitly confirmed experience. The candidate's confirmations can support relevant existing projects across the selected resume, including earlier roles; the JD itself is target context, not biography. Preserve existing facts and do not invent employers, projects, dates, titles, actions, outcomes, metrics, credentials, contacts or locations.

- Owner approval references carried in PR #466: PR #319 comment 6817645128 and PR #423 comment 6902823074.
- Original review/continuation: PR #466, which remains preserved as a draft on a stacked base.
- Current-master restack: draft PR #472, branch fix/resume-confirmed-skill-current-master-restack-20261120-1142z, base master 2da44026c0ab58ab2966b9371992efaf93427de4; code/test tree commit 58cb83ef7822b74a50ab6f1a76d847da806d21a5. The original PR #466 remains preserved.

## Corrections carried into the restack

- Negative candidate statements such as “My background lacks AWS,” “My skills don't include Splunk,” and “My experience includes no Okta” are not confirmations.
- A positive contrast such as “My experience includes AWS, but not GCP” retains only the positive portion.
- Broad words alone are not enough to map an explicitly confirmed skill into an unrelated project: IAM requires identity/access/authentication context, and Python requires code/script/automation/integration/ETL/database/tooling context rather than generic user, security, service or data.
- The existing project frame and candidate facts remain unchanged; the confirmed skill is the only cross-role addition.

## Reviewable source/test scope

The restack carries the source/test files from #466 and adds synthetic regression assertions for the review finding:

- src/lib/resume-evidence.ts: reject negative confirmation forms and narrow IAM/Python context families.
- scripts/tests/resume-confirmation-quality.test.mjs: negative forms, positive contrast, generic-context negatives, and relevant-context positives.
- src/lib/claude.ts, src/lib/resume-quality.ts, src/lib/tailor.ts, and the related tests: retain the approved confirmation-to-role mapping while preserving fact boundaries.

The current master-to-#466-base comparison showed only documentation and Kompas changes after the #466 base, so these resume source/test files were disjoint. The restack uses current master rather than changing the original #466 branch.

## Validation and limits

- Local clone/test execution was not possible: the sandbox cannot resolve GitHub (git clone DNS failure). Source and test changes are committed through the connected GitHub interface, not locally run.
- Exact-head GitHub Actions (full CI, WhatsApp recovery, Kompas baseline and Plan/REA) must pass on the final restacked head. No test result from an earlier head is reused.
- No authorized baseline resume, full JD, live model generation, exported DOCX inspection, 98% match or production acceptance was performed in this session.
- The 17 Oct 17:28 Chicago WhatsApp incident remains unresolved as a historical delivery event: exact output DOCX, per-run R2 object/version, webhook correlation, Meta message ID and signed delivered/read receipt are still missing. No replay, resend, real WhatsApp message, email or production mutation was performed.

## Next

Continue: verify all exact-head workflows for the current-master restack, repair any failures without inventing candidate facts, and let the MFit Safe Merge Gate review before merge. Keep it draft until protected preview and separate owner-authenticated resume/JD/DOCX acceptance are available.

## 20 November 2026 — missing-skill parser review follow-up

Static review of the #472 restack found that the confirmation parser accepted three negative forms as positive candidate evidence: `My skills are missing AWS`, `My experience is missing Splunk`, and `My background is missing Okta`. The existing guard recognized `lack/lacking` and `is not/are not`, but not `is/are missing`.

The source correction now rejects those forms (and bare `missing` after the confirmation prefix). It also treats `missing` as an exception boundary in mixed lists, so `Confirmed skills: AWS, missing GCP` yields only the positive AWS prefix. Existing positive-contrast behavior such as `My experience includes AWS, but not GCP` remains intact.

- Source: `src/lib/resume-evidence.ts`, commit `3c2411762e49512ca00d881e4abaefffbe640e42`.
- Regression: `scripts/tests/resume-confirmation-quality.test.mjs`, commit `6aae62afc97d5d674c45fadbdfb9cf5baf514610`.
- Source-derived JS regex sanity checks passed for the six reviewed cases. No repository-local Node test/build was run; the sandbox has no checkout/Next.js dependency tree and cannot clone GitHub. Exact-head remote CI is pending.
- PR: [#472](https://github.com/eshwarjay0-delS/job-dashboard/pull/472). No owner resume/JD, live generation, DOCX export, WhatsApp send, protected preview or production deployment occurred.
