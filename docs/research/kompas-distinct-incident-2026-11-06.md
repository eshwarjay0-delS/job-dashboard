# Kompas answer-relevance fold — distinct incidents, 6 November 2026

## Request
One fold on master `21ba302`. Repeated answers across different questions. No live scores. Do not merge. Do not deploy. Do not edit the files pull request 234 already changes (`TODO.md`, the plan journal, `public/kompas/app.js`, question-window and WhatsApp channel files).

## Method
Offline stand-in only. `draftSpokenAnswer` and `evaluateLiveAnswers` on `scripts/fixtures/kompas-evaluation/interview-50.json` and `tests/fixtures/kompas-sample-resume.md`. No model call. `KOMPAS_EVAL_TOKEN` was unset.

## Before
150 drafts (50 questions, 3 modes).

- Pairs at Jaccard >= 0.7: 505
- Same-answer failures: 505
- Length failures: 0
- Answers over the mode ceiling: 0

"In that design, a worker processes an object after its ownership changes…" and "In that design, a signed updater launches an unsigned child…" were the same text at every mode. Ratio 1.000. The lead was `in that design`.

## After
The lead is the incident. A question that already names the incident and three or more parts is not filled from the shared approach catalog. A Jaccard of 0.7 or more is a same-answer failure only when the answer does not say the words that make its question different.

| | Before | After |
|---|---:|---:|
| Pairs at Jaccard >= 0.7 | 505 | 153 |
| Same-answer failures | 505 | 0 |
| Length failures | 0 | 0 |
| Mode length gaps under 0.50 | 0 | 0 |
| Answers over the mode ceiling | 0 | 0 |

The worker and updater pair:

| Level | Ratio before | Ratio after |
|---|---:|---:|
| engineer | 1.000 | 0.455 |
| director | 1.000 | 0.667 |
| architect | 1.000 | 0.778 |

The worker draft contains "worker" and not "updater". The updater draft contains "updater" and not "worker".

Offline sample: 15 answers, 0 failures. Focused suites: 113 pass, 0 fail. `tsc --noEmit` clean.

## Limits
Live scored folds remain 0 of 50. The desktop 10-fold harness was not a Windows session; live desktop answers remain 0 of 10. The 153 pairs that still share 70 percent of their content words each name their own ask, so they are not counted as the same answer.
