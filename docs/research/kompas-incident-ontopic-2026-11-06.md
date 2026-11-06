# Kompas relevance fold — incident length, 6 November 2026

## Request
Next fold after the distinct-incident change. Cut repeated and off-topic length. No live scores. Do not merge. Do not deploy.

## Base
Rebased distinct-incident branch `92f2182c` on master `b2a328e5`. The numbers below are the stand-in on the fictional sample resume, 150 drafts, no model call. `KOMPAS_EVAL_TOKEN` was unset.

## Before this fold
Worker-ownership versus signed-updater:

| Level | Jaccard | Words |
|---|---:|---:|
| engineer | 0.455 | 52 / 55 |
| director | 0.667 | 92 / 95 |
| architect | 0.778 | 141 / 144 |

Pairs at Jaccard >= 0.7: 153. Same-answer failures: 0. Length failures: 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0.

The architect draft still ended on three shared lines that do not name the incident, including "The boundary I watch is the point where the evidence stops matching the plan."

## After
Those shared closing lines stay off for a named incident. Words the longer modes still need are the incident itself.

| Level | Jaccard | Words |
|---|---:|---:|
| engineer | 0.455 | 52 / 55 |
| director | 0.576 | 93 / 99 |
| architect | 0.650 | 149 / 164 |

Architect ceiling for that question is 281. Pairs at Jaccard >= 0.7: 113. Same-answer failures: 0. Length failures: 0. Mode length gaps under 0.50: 0. Answers over the ceiling: 0. Offline sample: 15 answers, 0 failures.

## Limits
Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10. This change is not merged and not deployed.
