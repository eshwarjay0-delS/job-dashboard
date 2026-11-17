# Final exported-DOCX Gemini ATS review — current-master restack (17 November 2026)

## Owner approval

The owner approved this loop in the 3 November 2026 conversation at 16:20:28 UTC. The required first Gemini instruction after each complete resume DOCX export is exactly:

> Give me an ATS score

The owner also required assistant-side evidence analysis of the returned score and remaining/weak terms, evidence-supported correction only, and a new export/recheck within a bounded retry budget. The source for this approval is recorded in the owner-authored discussion on [PR #395](https://github.com/eshwarjay0-delS/job-dashboard/pull/395). This is not a claim that every prior conversation is accessible.

## Contract and evidence boundaries

- Gemini reviews text extracted from the actual final DOCX buffer, the original JD, and the canonical JD target-term list.
- Gemini's score and missing/weak lists are diagnostic. They do not replace deterministic exported-byte coverage, ATS parseability, supported coverage, or factual evidence gates.
- The JD is target context, not candidate evidence. Corrections may use the selected source resume or an explicit candidate confirmation. The current confirmed-skill rule does not impose a first-person-only phrasing requirement.
- A confirmed skill may map across roles only when the existing project's context fits the skill family. It cannot create an employer, project, action, outcome, date, title, location, contact, metric, credential, or unrelated project detail.
- Unsupported JD terms remain disclosed as gaps; they are never asserted as candidate experience. A model score cannot make an unsupported term eligible.
- The loop is bounded to at most two evidence-only correction rounds. Every accepted correction is regenerated into a DOCX, re-extracted and reviewed again. Refinement requests are preserved rather than automatically rewritten.
- Missing Gemini credentials, invalid responses, unavailable DOCX text, incomplete/skills-only output, or exhausted time are recorded as skipped/unavailable, never a clean pass.
- The existing web/WhatsApp delivery thresholds are unchanged by this feature. The 6 Nov WhatsApp threshold is repository-recorded with a provenance limitation; this PR does not change it.

## Current implementation

The current-master confirmed-skill parent is [PR #431](https://github.com/eshwarjay0-delS/job-dashboard/pull/431), head `a74319cb87a3aff44e111987c59ce978d2f87c2a`. The dependent restack is branch `feat/final-docx-gemini-restack-confirmed-skills-20261117` and will be opened as a DRAFT PR after source/docs are complete.

The branch:
- Adds a strict Gemini-only final-DOCX reviewer and bounded parser.
- Extracts text from the actual exported DOCX buffer before review.
- Returns separate `gemini_ats_review` diagnostics.
- Reserves time for at most two supported-only correction/re-export/re-review rounds.
- Carries explicit candidate confirmations into role gap-fill and the existing project-context guard without changing the confirmed-skill policy.
- Removes the prior unstructured Gemini suggestion-only pass in favor of the structured review.
- Adds focused parser, loop, confirmed-skill and WhatsApp-contract tests plus a dedicated workflow running `npm run check`.

Key source commits:
- `c700d0e143d640dd9bbf4abf89c234a05e1c19be` — Gemini reviewer.
- `3e37cfa919f695a036b4db8f6d6276a67a34138a` — export the confirmed-skill project-context guard.
- `d3fc45c33ed385357b9d989d02aebdca4056ec2b` — bounded final-DOCX correction loop.
- `b85d855172218ea65722cdbc792e4d755c11b48c`, `91d58039ca2acd793d880947b2112e2efd244096`, `3514200948251892aa4d7411f061e62eee6362c9`, `7f55e2d2f5a0056d26688ec57e96779cf9eea2a8` — helper, tests and workflow.

## Validation and release

The branch is a source restack; exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA are still required. The prior PR #395 branch is not being merged or treated as current-master validation because it carried stale confirmed-skill wording and a brittle Plan assertion.

The protected preview requires an authorized administrator to configure the private `KOMPAS_VERCEL_API_TOKEN`. Do not bypass preview protection, change ignore rules, or use a different deployment target. The current production alias is older than master.

No owner-authorized personal resume/JD/confirmation bundle was available in this run. No personal DOCX was exported, no Gemini model call was made, no private resume content was copied, no production deployment occurred, and no live 95–100% result is claimed.

## Next steps

1. Finish the Plan & Vision journal and REA record for this exact restack.
2. Open the dependent DRAFT PR and verify full CI, WhatsApp recovery, Kompas baseline and Plan/REA on its exact head.
3. Obtain legitimate protected preview access and owner-authorized baseline/JD/confirmation fixtures.
4. Inspect the actual exported DOCX bytes, role-by-role evidence, Gemini diagnostic score, and each supported-only correction/re-export.
5. Keep production release and real WhatsApp/device acceptance separate from source CI.


## 17 November 2026 — exact PR #441 source status

PR [#441](https://github.com/eshwarjay0-delS/job-dashboard/pull/441) is DRAFT at exact head `1046415d1f440b3d01eeeea56543f62c9ae6f870`, based on confirmed-skill PR #431 head `a74319cb87a3aff44e111987c59ce978d2f87c2a` (18 commits ahead, 0 behind). Plan/REA schema run `44115781369` passed. Dedicated final-DOCX workflow `44115781348` is still in progress at dependency installation; no exact-head full CI, WhatsApp recovery or Kompas baseline result is visible yet. No local build/test, personal DOCX export, Gemini model call, protected preview or production release is claimed.


## Exact-head regression correction — 17 November 2026 15:38 UTC

PR #441 head \`f7bed0d646db35426289fbc1e43441fedb3dc163\` exposed two stale source-contract assertions after the approved confirmed-skill and final-DOCX correction work was combined:

1. \`scripts/tests/resume-confirmation-quality.test.mjs\` expected the old direct \`cur.required[i]\` call. The current implementation resolves \`requiredTerms\` from the active focus or the role's required terms, derives role-local \`sourceMissing\`, and adds only explicitly confirmed terms whose skill family fits an existing bullet. The global \`unseen\` list is sent to the profile/skills task, not appended to a role task. The regression now asserts those exact boundaries.
2. \`scripts/tests/whatsapp-resume-contract.test.mjs\` prohibited every \`stripUnsupportedSkills\` call after the initial skills floor. The bounded final-DOCX loop legitimately re-applies this guard to an evidence-filtered correction candidate. The regression now asserts both the pre-floor cleanup and the later final-review cleanup, plus the supported-gap filter, role-evidence restoration and invented-experience removal.

The test corrections are pushed to PR #441 in commits \`2f75a5e95979a855d55cb7ffdb43c45c221554e5\` and \`b09babc18ba2339c494cc873fea8f4d57dc21127\`; full-content restoration commits follow because the first API transfer was truncated and has been corrected below.

Local Node 22 focused verification after the correction: four suites, **73 passed / 0 failed** (\`resume-confirmation-quality\`, \`whatsapp-resume-contract\`, \`resume-final-ats-review\`, \`resume-final-ats-loop\`). \`npm run check\` exited 0 (typecheck, lint, autofill and application checks); lint emitted existing repository warnings. \`git diff --check\` passed. No runtime code changed in this correction.

The GitHub failures being repaired were exact-head runs \`44116037049\` (WhatsApp recovery contract suite) and \`44116037503\` (final-DOCX workflow); Plan/REA schema run \`44116037400\` had passed. The corrected files now require fresh branch workflows on the resulting PR head. The PR is stacked on confirmed-skill PR #431; full CI and Kompas baseline must be rerun after the parent is accepted and #441 is retargeted to master. Protected preview still requires the owner-controlled private \`KOMPAS_VERCEL_API_TOKEN\`, and live acceptance still requires an owner-authorized baseline resume, exact JD and explicit-confirmation bundle. No Gemini call, personal DOCX export, live 95–100% match, WhatsApp send, R2 write, production mutation or device acceptance occurred.

Shared Plan Journal, REA and Completion Watch files were intentionally not edited in this correction because the Safe Merge Gate is sequencing concurrent changes to those shared files across #433/#438 and other current-master branches. Carry this evidence into those shared records when that sequence is released; this research note and the PR review comment preserve the exact result meanwhile.
