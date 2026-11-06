# Kompas relevance fold — design answers, 6 November 2026

## Request
Next fold after the comparison resume-line change. Reduce repeated and too-long design answers. No live scores. Do not merge. Do not deploy.

## Base
Pair-resume tree `c4ea56de`, stacked on the comparison branch, rebased onto master `1b116ce4`. Fictional sample resume. 150 drafts. No model call. `KOMPAS_EVAL_TOKEN` was unset (length 0).

## Before
150 drafts: 106 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0.

Worst remaining pair, both drafts of:

"Design Front Door, APIM and private backend trust boundaries. Explain trust boundaries, data flow, failure isolation, rollout and validation."

versus

"Design tenant isolation across API, cache and asynchronous workers. Explain trust boundaries, data flow, failure isolation, rollout and validation."

| Level | Jaccard | Words (left / right) | Shared closer |
|---|---:|---|---|
| engineer | 0.406 | 89 / 93 | no |
| director | 0.683 | 165 / 167 | no |
| architect | 0.882 | 277 / 281 | yes, "The boundary I watch" |

The architect ceiling for that question is 281. Both architect drafts then shared the closing catalog and approach lines that do not name the design.

## After
A question that starts with "Design" and has a lead of at least three words no longer takes those shared closing lines, or an approach line that does not name the design. Extra length uses the design words.

| Level | Jaccard | Words (left / right) | Shared closer |
|---|---:|---|---|
| engineer | 0.542 | 89 / 89 | no |
| director | 0.651 | 138 / 143 | no |
| architect | 0.771 | 212 / 226 | no |

Engineer overlap rose from 0.406 to 0.542 because the lines removed were shared, so the remaining set is a larger fraction of the same words. It stays under 0.7. Architect words fell from 277 and 281 to 212 and 226, both under the 281 ceiling.

150 drafts: 84 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the ceiling: 0. The highest remaining pair is 0.811. The director-incident pair from the previous fold stayed at engineer 0.214, director 0.474, architect 0.543.

Offline sample set: 15 answers, 0 failures, 16 depth and confidence warnings. Focused suites 57 pass, 0 fail. `tsc --noEmit` clean.

## Limits
Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10. Not merged. Not deployed. The architect design pair is still above 0.7.
