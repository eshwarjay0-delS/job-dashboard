# Kompas relevance fold — comparison resume lines, 6 November 2026

## Request
Next fold on the open comparison stack. Reduce repeated answers, off-topic technical answers, and answers that stay long by repeating resume lines that do not name the asked pair. No live scores. Do not merge. Do not deploy.

## Base
Comparison-ontopic tree rebased onto master `1b116ce4` as `9f482ebb`. Fictional sample resume. 150 drafts. No model call. `KOMPAS_EVAL_TOKEN` was unset (length 0).

## Before
150 drafts: 103 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0.

Worst remaining pair, both architect:

"Now explain the same incident to a director: risk acceptance versus remediation. State decision owner, business exposure and measures you would track, without inventing achieved numbers."

versus

"Now explain the same incident to a director: containment versus customer access. State decision owner, business exposure and measures you would track, without inventing achieved numbers."

| Level | Jaccard | Words (left / right) | Shared off-topic line |
|---|---:|---:|---|
| engineer | 0.619 | 49 / 49 | no |
| director | 0.676 | 76 / 79 | no |
| architect | 0.907 | 126 / 126 | yes, "I worked on site with the control owners three days a week" |

Both architect drafts also shared the weekly risk summary, residual-risk tracking, findings-to-owner, and remediation-plan review sentences. Those lines match the shared word "risk". They do not name containment or customer access.

## After
A comparison or definition keeps a resume line only when that line names one side of the pair. Shared words such as risk, incident, owner, finding, control, business, and access do not count as a side.

| Level | Jaccard | Words (left / right) | Shared off-topic line |
|---|---:|---:|---|
| engineer | 0.214 | 51 / 48 | no |
| director | 0.474 | 82 / 79 | no |
| architect | 0.543 | 125 / 122 | no |

The remediation answer still uses the resume line that names remediation. The containment answer does not include "worked on site" or "weekly risk summary".

150 drafts: 106 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the ceiling: 0. The pair count rose by 3 because some comparisons lost resume lines that had been their only difference. The worst pair fell from 0.907 to 0.543. The next worst printed pair is an architect design pair at 0.882.

Offline sample set: 15 answers (5 questions, 3 modes), 0 failures, 16 warnings. The warnings are depth and confidence word-count gaps, which the harness already treats as warnings.

"Define IDOR versus CSRF" versus "Define containment versus eradication" stayed at architect Jaccard 0.793.

## Limits
Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10. Not merged. Not deployed.
