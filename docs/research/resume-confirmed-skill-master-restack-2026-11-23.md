# Confirmed-skill resume/JD alignment — current-master restack (23 November 2026)

## Approved behavior

A positive candidate confirmation may support the named skill and map it into relevant existing project bullets across roles, including earlier roles, even when the original bullet does not name the tool. Do not require extra same-role source verification for that confirmed skill. Confirmation supports only the skill, not a new project, employer, action, outcome, title, date, location, contact, metric, credential or unrelated project detail. Negative claims, questions, editing instructions, second-person wording, exceptions and JD-only requirements are not confirmation. Generic IAM/security context cannot support unrelated IAM; generic data/service context cannot establish Python without coding/automation/integration/ETL/database/tool context.

## Restack and scope

Current canonical master is `794e8cfdbd3103409552857806bab89851d5bfcb`. Code/test commit `bd74611ceb84a945bb66d86d5b53b26b9308a66e` cleanly restacks four source files and `scripts/tests/resume-confirmation-quality.test.mjs`. The overlapping `resume-guards` and WhatsApp acceptance tests/docs from #557 are excluded. Kompas VM fixture/lint changes from #550/#554 are excluded. The PR remains DRAFT.

## Focused workflow

Added `.github/workflows/resume-confirmation-quality.yml` to run `npm ci` and `node --experimental-strip-types --test scripts/tests/resume-confirmation-quality.test.mjs` on relevant PRs or manual dispatch. The test is also part of full CI. Exact-head results are pending.

## Evidence and blockers

Previous PR #552 head `d43be9128be3093031587b6b98755ebf1d5a19aa` passed resume regression `45145982653` and Kompas baseline `45145982492`; full CI `45145982598` failed at the unrelated master `src/lib/kompasConsistency.ts:1059` prefer-const lint. The clean current-master restack must run its own focused regression, full CI, baseline and Plan/REA. No local checkout/dependencies are available.

## Acceptance limits

No candidate resume/JD was processed; no live model generation, exported DOCX inspection, measured 95–100%/98% match, production deployment or real acceptance occurred. Keep the PR draft. Exact-head tests, independent review, protected preview and owner-authorized resume/JD plus exported-DOCX inspection are required before release. Synthetic test success is not live quality proof.

