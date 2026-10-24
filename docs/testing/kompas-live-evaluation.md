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
