# Kompas relevance fold — design pieces, 6 November 2026

## Request
Next offline fold after the versus-side change. Reduce the remaining architect design overlap. No live scores. Do not merge. Do not deploy.

## Base
Versus-side tree `0fdba3da` (pull request 252). Fictional sample resume. 150 drafts. No model call. `KOMPAS_EVAL_TOKEN` was unset (length 0).

## Before
150 drafts: 16 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0.

Worst pair:

"Design Front Door, APIM and private backend trust boundaries. Explain trust boundaries, data flow, failure isolation, rollout and validation."

versus

"Design tenant isolation across API, cache and asynchronous workers. Explain trust boundaries, data flow, failure isolation, rollout and validation."

| Level | Jaccard | Words (left / right) |
|---|---:|---|
| engineer | 0.542 | 89 / 89 |
| director | 0.651 | 138 / 143 |
| architect | 0.771 | 212 / 226 |

The architect ceiling for that question is 281. Both drafts spoke the shared explain list (trust boundaries, data flow, failure isolation, rollout, validation) with the same template.

## After
A design answer speaks only the pieces named in the design sentence, each in one short line. The shared explain list is left off. Approach lines that do not add a new piece are left off. The honest line stays when the resume has no match.

| Level | Jaccard | Words (left / right) |
|---|---:|---|
| engineer | 0.556 | 59 / 67 |
| director | 0.533 | 91 / 101 |
| architect | 0.533 | 143 / 159 |

Engineer overlap rose from 0.542 to 0.556 and stays under 0.7. Architect words fell from 212 and 226 to 143 and 159, both under the 281 ceiling. The Front Door draft still names APIM. The tenant draft still names cache. Neither draft says "data flow".

150 drafts: 4 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the ceiling: 0. The highest remaining pair is 0.710, director, "In that design, audit evidence disagrees with live configuration" against "In that design, the attacker retains access through a service account".

The versus-side pair stayed at engineer 0.400, director 0.500, architect 0.500.

Offline sample: 15 answers, 0 failures, 16 depth and confidence warnings. Focused suites 67 pass, 0 fail. `tsc --noEmit` clean.

## Re-run after restack onto master `3e2d2359`, 10 November 2026

Same stand-in, 150 drafts, no model call. `KOMPAS_EVAL_TOKEN` was unset. This tree: 4 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode gaps under 0.50: 0. Answers over the ceiling: 0. Front Door versus tenant stayed engineer 0.556 (59 and 67), director 0.533 (91 and 101), architect 0.533 (143 and 159). Highest remaining pair stayed 0.710, director, audit evidence versus the service-account attacker. Offline sample: 15 answers, 0 failures, 16 warnings. Focused suites: 169 pass, 0 fail. `tsc --noEmit` clean.

## Limits
Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10. Not merged. Not deployed. Four pairs remain at Jaccard >= 0.7.
