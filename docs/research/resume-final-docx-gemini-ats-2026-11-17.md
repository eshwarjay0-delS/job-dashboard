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
