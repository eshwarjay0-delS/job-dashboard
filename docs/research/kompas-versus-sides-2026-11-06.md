# Kompas relevance fold — versus sides, 6 November 2026

## Request
Next offline fold from current master. Reduce the remaining high-overlap pairs. No live scores. Do not merge. Do not deploy.

## Base
Master `9d2997ac`. Fictional sample resume. 150 drafts. No model call. `KOMPAS_EVAL_TOKEN` was unset (length 0).

## Before
150 drafts: 84 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0.

Worst pair, both settled drafts:

"Now explain the same incident to a director: rollback scope versus lateral movement risk. State decision owner, business exposure and measures you would track, without inventing achieved numbers."

versus

"Now explain the same incident to a director: restoration speed versus reinfection risk. State decision owner, business exposure and measures you would track, without inventing achieved numbers."

| Level | Jaccard | Words (left / right) |
|---|---:|---|
| engineer | 0.500 | 39 / 50 |
| director | 0.690 | 70 / 81 |
| architect | 0.811 | 114 / 126 |

Both architect drafts used the same checklist sentences for decision owner, business exposure, and measures, plus "My resume does not show this exact work".

"Define IDOR versus CSRF" versus "Define containment versus eradication": engineer 0.636 (29 / 29), director 0.810 (52 / 52), architect 0.793 (94 / 94).

## After
A comparison or definition that names two sides no longer takes that shared checklist, the shared honest line, or an approach line. Extra length uses the two side names and words that are not content tokens.

| Level | Jaccard | Words (left / right) |
|---|---:|---|
| engineer | 0.400 | 46 / 42 |
| director | 0.500 | 76 / 79 |
| architect | 0.500 | 120 / 119 |

Define IDOR versus CSRF against containment versus eradication: engineer 0.273 (34 / 34), director 0.500 (63 / 63), architect 0.467 (98 / 98).

150 drafts: 16 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the ceiling: 0. The highest remaining pair is an architect design pair at 0.771 (Front Door versus tenant isolation).

Offline sample: 15 answers, 0 failures, 16 depth and confidence warnings. Focused suites 67 pass, 0 fail. `tsc --noEmit` clean.

## Limits
The shared checklist is left off, so these versus answers do not restate "decision owner", "business exposure", or "measures" as their own sentences. Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10. Not merged. Not deployed.
