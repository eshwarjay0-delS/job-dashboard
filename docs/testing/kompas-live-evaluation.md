# Kompas generated-answer evaluation

Owner correction, 23 October: repeated unit tests are insufficient. Evaluate 40–50 actual answers per iteration, deep recursive follow-ups and all available job families; compare responses and improve only against observed defects. Target 30 rounds, extend to 50 if justified.

The 50-case fixture contains ten five-turn chains derived from available requirements, not every original JD. Each chain progresses from technical-HR concept through architect design, failure diagnosis, recursive mitigation failure and director decision. Resume facts and full JD must be attached per chain before a grounded personal-experience evaluation. Do not substitute a different candidate or inferred achievements.

Run protocol: preserve question order within each chain; send actual earlier answers as history and carry the returned ledger. Set the live audience each turn. Save source/model/prompt/code versions, request ID, provider, raw answer, latency and failure status. A fallback or HTTP error is a failure, not a scored answer. Never record credentials. Use a private artifact store for actual candidate responses.

Score each answer separately for direct relevance, requested depth, unnecessary detail, factual grounding, technical correctness, continuity, audience, readability and length. Use criteria in the fixture plus an independent reviewer; keywords and word counts cannot prove correctness. Grade 0–4 per dimension with cited answer spans and explicit reasons. Contradictions, fabricated personal metrics and unsafe designs are hard failures. Reference answers are review rubrics, not verbatim text to imitate.

Round 1 is the baseline. Freeze a holdout of two chains before inspecting outputs; tune on the remaining eight. Each subsequent round records a defect hypothesis, minimal code/prompt change, same-case before/after comparison and holdout regression. Reject changes that trade relevance or truth for longer answers. Report ties and regressions; do not force improvement or claim 30 fixes. Thirty rounds require at least 1,500 generated answers; fifty require 2,500, excluding judge calls and retries.

Status: fixture prepared, zero live rounds executed. Environment contains no configured OPENROUTER_API_KEY, OPENAI_API_KEY or KOMPAS_EVAL_TOKEN; the actual answer route requires authenticatedUser. Unblock with an authenticated test execution environment and candidate-approved source bundles; preserve auth and quota controls. Unit regressions remain separate evidence. No guarantee of zero defects or live meeting accuracy.

## Execution runner and verified access wall

`scripts/kompas-live-evaluate.mjs` executes one real 50-answer round, requires complete per-chain approved resume/JD bundles, preflights the authenticated API, preserves actual history/ledger within each chain, captures actual model metadata and raw answers to private files, and leaves quality review explicitly pending. Exclusive output creation prevents overwriting past rounds. It stops on errors instead of manufacturing pass scores. Subsequent rounds must follow reviewed changes, not an unattended loop of identical calls.

Access rechecked: KOMPAS_API_TOKEN is absent. Vercel deployment access returned HTTP 403 at read_protection_bypass. The connector requires project/team authorization; no mapped CLI fallback is available. Syntax check passed; missing-token execution fails before reading source files or making model calls. Live generations remain zero. No token should be pasted into chat; configure it in the authorized execution environment.

Runner verification: a subprocess test substitutes a synthetic provider, exercises all 50 captures, asserts history and ledger continuity within chains and isolation between chains, verifies quality reviews remain pending, and rejects overwriting a prior round. Passed. This is runner plumbing verification, not real model evaluation. PR #62 preview status succeeded; no Vercel CLI is installed in this environment and no team-authorization tool is exposed.

Failure-evidence improvement: rejected preflight previously left an empty array. It now saves an explicit failed preflight record before stopping. Two subprocess tests pass, including HTTP 401 with no subsequent generation. PR #63 merged as b4d1f222736416be16c7a43a794d426631915f75; this additional preflight fix is locally committed, publication pending. Actual model rounds remain zero.

## Parallel audit findings

Owner requested 100 simultaneous agents; environment supports six workers plus coordinator. Separate read-only audits assigned runner, coverage, policy, follow-up, release and scoring ownership. Policy reviewers reproduced that all ten recursive stage-4 questions receive general/90-word policy and all ten director stage-5 tradeoff questions receive comparison/110-word policy. These are routing defects, not measured live answer failures. Next implementation must fix explicit practice intent precedence without expanding ordinary definitions. Runner audit additionally found non-atomic checkpoints and absent immutable provenance. Positive-integer round and nonempty-string source validation implemented locally; existing runner tests still pass. Atomic persistence, new validation regression tests and routing fixes remain pending.

Depth-routing repair: 48 new boundary/fixture checks reproduced 25 failures, including every stage-4 recursive failure question and stage-5 director incident question. Explicit practical requests now outrank incidental comparison/definition words. Brief heard-of definitions and natural what-did-you-do experience questions are distinguished. Focused suite 84/84 passes; full suite pending at commit preparation. These remain policy checks, not generated-answer quality scores.


## Ledger cycle repair

Both new regressions failed before repair. After twelve unique angles, the old selector repeatedly returned the first angle. Recording now moves each valid angle to the end of a bounded recency list, including re-asks and turns without a project. A drilldown retains its project only while that project exists in current sources. Two focused tests pass, including sixty sequential selections; full suite 935/935, TypeScript pass. This establishes routing behavior only, not generated-answer variety.

PR #64 merged as bd6fd241fbd2541c989c216cf57d696d3970b22e. GitHub reports production Vercel success: https://vercel.com/qu4ntum-s-projects/job-dashboard/GY6H3AGTQLxGX4my3DHFuHRijwun . It includes preflight failure evidence, input validation and depth routing. Live generated-answer rounds remain zero; authorized API access and approved source bundles remain missing.


## Atomic evidence checkpoints

Evaluation updates now write a private, same-directory temporary file, sync and close it, then rename over the prior checkpoint. Failure before rename preserves prior evidence. Cleanup errors do not mask the original write failure. Seven focused checks pass: partial-write, sync, rename and cleanup failures, an actual SIGKILL before rename, and two runner subprocess scenarios. Temporary files left by interruption are not round files. This is process-interruption protection, not certified host/power-loss durability. Explicit completion manifests, source/code hashes, resumability and actual answer review remain pending.

Ledger repair PR #65 merged as bcac120d114ef72f842e6119a9d3789965d4718f after preview success. Production confirmation is separate. Zero live model rounds have executed.

Final checkpoint validation: full hardening 940/940; TypeScript and diff checks pass. PR #65 production status succeeded: https://vercel.com/qu4ntum-s-projects/job-dashboard/GjdaTLMm8xQMfq8tRqGsSTb8Ug1Y . Native Windows and live answer acceptance remain pending.

## Fixture coverage audit, 25 October 2026

Computed directly from interview-50.json: 50 cases, 41 unique question texts. All ten fourth turns share the same recursive follow-up wording; their prior-answer context differs, so this is not ten independent unique prompts. Kind counts are ten each for definition, design, followup, recursive-followup and business-followup. There are no dedicated introduction cases. This fixture cannot establish the reported career-introduction repair or isolate audience calibration because question type and audience change together.

Keep this fixture immutable once paired rounds begin. Before running the requested baseline, version an additional acceptance set covering career introductions and re-asks, bare abbreviations, compound requests, topic switches, same-topic drilldowns, unsupported experience and the same question across all three audiences. Preserve original source bundles and prompt versions. Report both case count and unique prompt count; never describe repeated harness checks as generated-answer evaluation. This audit made zero model calls and changed no runtime behavior.

Supplemental intent-acceptance-v1.json adds 36 cases: 12 identical prompts crossed over engineer (technical HR/engineer), architect and director. This is a review fixture, not wired into the existing live runner yet. Supply approved sources and explicit reviewed history for dependent cases; isolate all other cases. No outputs or scores are included.

Release record: PR #74 preview passed and merged on 25 October 2026 as 1819a87d9332f9c6fc2d0fc7dc9e0f5ead869cfa. The 36 supplemental cases have validated JSON, unique IDs and three levels per prompt. This is fixture preparation only; no generated answers or scores. Next: integrate an explicit fixture selector and source/history validation in the runner; retain original 50-case default.

Runner integration: optional fourth argument selects interview-50 (default) or intent-acceptance-v1. Supplemental source bundles are keyed by case ID; intro-repeat and drilldown require reviewed q/a history. Other supplemental cases start isolated. Source/history validation precedes all requests. No live model runs performed.

Validation on 25 October: full suite 981/982, one mail-overview.test.mjs source assertion fails on StandingSection position relative to Filter inbox. The failing mail page and test have no diff against origin/master; do not weaken that check or claim a green suite. TypeScript and three fixture-selector tests pass. Reconciled with be41815: Overview detail intentionally moved behind one tap. Updated obsolete source assertion to require accessible expanded state, toggle and conditionally rendered account-scoped detail. Focused revalidation passes 34/34 across fixture selection, mocked evaluation runner, checkpoint failures and Gmail overview; TypeScript and diff checks pass. Full suite completed: 1016/1016 pass; TypeScript passes. PR #76 preview passed and merged on 25 October 2026 as c28c1424bdbf463cf25d2df4b7f63eaf866a91b6. Full regression 1016/1016 and TypeScript pass. Production rollout pending. No live model comparison executed; authenticated application access and approved private source/history bundles remain required. These are code/harness checks, not live model quality.

PR #76 preview passed and merged on 25 October 2026 as c28c1424bdbf463cf25d2df4b7f63eaf866a91b6. Full regression 1016/1016 and TypeScript pass. Production rollout pending. No live model comparison executed; authenticated application access and approved private source/history bundles remain required.
