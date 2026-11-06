# Kompas relevance fold — comparisons, 6 November 2026

## Request
Next fold on the open incident stack. Reduce repeated and off-topic length for definitions and comparisons. No live scores. Do not merge. Do not deploy.

## Base
Incident-ontopic tree rebased onto master `23783183`. Fictional sample resume. 150 drafts. No model call. `KOMPAS_EVAL_TOKEN` was unset.

## Before
150 drafts: 113 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0.

"Define IDOR versus CSRF. Keep it suitable for technical HR." versus "Define containment versus eradication. Keep it suitable for technical HR.":

| Level | Jaccard | Words | Shared closer |
|---|---:|---:|---|
| engineer | 0.636 | 29 | no |
| director | 0.867 | 62 | no |
| architect | 0.905 | 105 | yes, "The boundary I watch" |

## After
A comparison or definition does not take the shared closing lines, or an approach line that does not name the pair. Extra length uses the two names.

| Level | Jaccard | Words | Shared closer |
|---|---:|---:|---|
| engineer | 0.636 | 29 | no |
| director | 0.810 | 52 | no |
| architect | 0.793 | 94 | no |

150 drafts: 103 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the ceiling: 0. Offline sample: 15 answers, 0 failures.

## Limits
Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10. Not merged. Not deployed.
