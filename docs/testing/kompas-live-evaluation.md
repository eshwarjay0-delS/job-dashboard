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
