# Confirmed-skill resume/JD alignment — current-master restack (23 November 2026)

## Approved behavior

A positive candidate confirmation may support the named skill and map it into relevant existing project bullets across roles, including earlier roles, even when the original bullet does not name the tool. Do not require extra same-role source verification for that confirmed skill. Confirmation supports only the skill, not a new project, employer, action, outcome, title, date, location, contact, metric, credential or unrelated project detail. Negative claims, questions, editing instructions, second-person wording and JD-only requirements are not confirmation. In a mixed positive/negative statement, only the positive portion before a clear exception may confirm; if the same skill is repeated on both sides of the exception, reject the whole statement and ask for clarification. Generic IAM/security context cannot support unrelated IAM; generic data/service context cannot establish Python without coding/automation/integration/ETL/database/tool context.

## Restack and scope

Current canonical master is `794e8cfdbd3103409552857806bab89851d5bfcb`. Code/test commit `bd74611ceb84a945bb66d86d5b53b26b9308a66e` cleanly restacks four source files and `scripts/tests/resume-confirmation-quality.test.mjs`. The overlapping `resume-guards` and WhatsApp acceptance tests/docs from #557 are excluded. Kompas VM fixture/lint changes from #550/#554 are excluded. The PR remains DRAFT.

## Focused workflow

Added `.github/workflows/resume-confirmation-quality.yml` to run `npm ci` and `node --experimental-strip-types --test scripts/tests/resume-confirmation-quality.test.mjs` on relevant PRs or manual dispatch. The test is also part of full CI. Exact-head results are pending.

## Evidence and blockers

Previous PR #552 head `d43be9128be3093031587b6b98755ebf1d5a19aa` passed resume regression `45145982653` and Kompas baseline `45145982492`; full CI `45145982598` failed at the unrelated master `src/lib/kompasConsistency.ts:1059` prefer-const lint. The clean current-master restack must run its own focused regression, full CI, baseline and Plan/REA. No local checkout/dependencies are available.

## Acceptance limits

No candidate resume/JD was processed; no live model generation, exported DOCX inspection, measured 95–100%/98% match, production deployment or real acceptance occurred. Keep the PR draft. Exact-head tests, independent review, protected preview and owner-authorized resume/JD plus exported-DOCX inspection are required before release. Synthetic test success is not live quality proof.



## 23 November 2026 — contradictory exception guard

Static review found a narrow false-positive edge case in the confirmation parser: a sentence such as “My experience includes AWS and GCP, but I have not used GCP” could be split at “but” and retain GCP from the positive prefix. That would contradict the user's negative statement.

The parser now tokenizes the positive and exception portions, ignores ordinary grammar/context words, and rejects the whole statement when the same skill token appears on both sides. A clean contrast such as “I used AWS, but not GCP” still preserves AWS and does not confirm GCP. The change does not make the JD evidence, broaden candidate history, or alter account isolation.

- Source correction: `1724f7422aa384dcb6967c00856ea42453f28755`
- Regression: `fd70d8c7603291c546f9b011b28cd6ddb27bdb92`
- Exact-head focused regression: `45193540706` SUCCESS
- Plan/REA schema: `45193540795` SUCCESS
- Kompas baseline: `45193540721` SUCCESS
- WhatsApp resume recovery: `45193540731` SUCCESS
- Full CI: `45193540861` FAILURE at the existing `prefer-const` lint error in `src/lib/kompasConsistency.ts:1059`; type-check/build skipped

PR #552 remains DRAFT. No local test/build, candidate resume/JD processing, model call, DOCX generation or exported-document inspection occurred. No 95–100% or 98% live match is claimed. The next gate is the shared Kompas lint/Listening-hold dependency and its independent-review requirement in PR #554, followed by exact-head full CI, protected preview and owner-authorized DOCX acceptance.


## Shared CI repair — 23 November 2026

The confirmed-skill branch now includes the behavior-neutral `let s` → `const s` lint correction and initializes `answerCtl`/`detectedQueue` in the four shared Kompas VM fixtures. This fixes the earlier CI lint/test harness blockers without changing resume evidence policy or runtime behavior. Exact current head `73341b24ae4432c2e281073855aecd2ab3be77c3`: full CI `45228044173`, focused confirmed-skill `45228044141`, and WhatsApp recovery `45228044178` are IN PROGRESS; Kompas baseline `45228044134` and Plan/REA `45228044137` SUCCESS. Local execution, real resume/JD, model and DOCX acceptance remain unavailable.


## Exact-head full CI result — 23 November

Current code/test head d077a743987e30067acb174c8b328bfbd3ba123f full CI 45228304791 failed only tests 50 and 54, which assert the shared Kompas Listening-hold behavior. Lint, type-check, build and all preceding test steps pass; the shared VM fixture and prefer-const blockers are resolved. Confirmed-skill 45228304811, WhatsApp recovery 45228304849, Kompas baseline 45228304724 and Plan/REA 45228304850 SUCCESS. PR #554 contains the Listening-hold fix with all five gates green but awaits independent review. No live resume/JD, model, DOCX or production acceptance.


## Completion Watch independent restack — 23 November 2026

This continuation copies the reviewed code/test slice from PR #567 exact head `bc9f09b271d658f305d87179dd37da4335af8864` onto canonical master `794e8cfdbd3103409552857806bab89851d5bfcb`, without depending on the Kompas PR #554. It changes only the four resume source files, the focused regression suite, its workflow and this research handoff. Prior #567 focused results (40/40 and WhatsApp recovery 4/4) are historical for that head; they are not reused as exact-head CI. This branch has no local execution evidence because the environment lacks a canonical checkout/dependencies. Full CI and baseline/Plan-REA gates must run on this master-based PR before review/merge. No resume/JD was processed, no model call or DOCX export occurred, no production deployment or 95–100% live match is claimed.


## 24 November 2026 — shared Kompas CI dependency

24 November 2026: PR #570 head 96a8b909f68421e35e0f642a9b9c0c090838435b has confirmed-skill regression 41/41, WhatsApp recovery 52/52, Kompas baseline 92/92 and Plan/REA schema SUCCESS. The behavior-neutral let s to const s lint fix is committed in that branch. Full CI now passes lint but fails ten shared Kompas question/voice VM cases with answerCtl is not defined (tests 45-54 and 71). PR #554 owns the approved fixture initialization and first-press Listening hold; its exact head 4fafd56663bb5ddce064dcebea8802d758bb8259 has full CI 45123770495, cross-device 45123770446, Plan/REA 45123770546, Kompas baseline 45123770380 and Windows executable 45123770398 all SUCCESS. It is still awaiting a second authorized reviewer; the only review is the owner-authored comment. Do not copy #554 runtime/fixture changes into #570. PR #570 remains DRAFT; protected preview and owner-authorized resume/JD/explicit confirmation/exported-DOCX acceptance remain missing. No real resume/JD/model/DOCX or live 95–100%/98% match was produced. Canonical master and production alias remain 794e8cfdbd3103409552857806bab89851d5bfcb, READY deployment dpl_2tyBPso5SnCgHCPFCqXewExCJEYp.

The branch-only lint correction passed the resume-specific and WhatsApp regression gates, but full CI exposed ten question/voice VM fixture errors (answerCtl undefined). PR #554 contains the shared fix; do not duplicate its runtime behavior.


## Documentation commit provenance — 24 November

Plan & Vision, the completion-watch ledger, and the journal were updated in commit c7ebd468953d5b9f7d82b7888e3efd77d19380e1 to record the exact lint correction and the newly exposed shared Kompas VM fixture dependency. Code/test evidence is from head 96a8b909f68421e35e0f642a9b9c0c090838435b; these results do not transfer to this documentation head. Exact-head reruns are required.


## 24 November 2026 — mixed negative contractions

Static review of the exact PR #570 branch exposed a false-positive boundary: the exception regex recognized words such as `not`, `no`, `but` and `lack`, but not negative contractions. A phrase like `I used AWS and don't know GCP` was retained in full, which could let the keyword extractor treat GCP as confirmed. The branch now recognizes `don't`, `doesn't`, `didn't`, `haven't`, `hasn't`, `can't`, `cannot`, `won't`, and common negative contractions. Regression cases require mixed statements to retain AWS only and reject a repeated AWS on both sides of the boundary.


Code commit: `9e49a49b9d46fb65f25dd6d6591cb325944dd044`; test commit: `4c3f45f7130189382f0172b3726cbf1f14ca0115`. The local reduced reproduction passed five cases, but the exact focused GitHub workflow did not run on this new head (connector commits do not trigger Actions; no dispatch action is available). No local repository clone or full test/build was available because the container could not resolve GitHub. Keep the PR draft and require exact-head validation before merge/deploy.
