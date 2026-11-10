# Kompas relevance fold — unmatched definitions, 10 November 2026

## Request
Owner, 9 Nov 2026, 6:18 PM America/Chicago: get every offline pair under Jaccard 0.7. This fold is the pair that remained after the incident-line change. No new same-answer, length, mode-gap, or ceiling failures. No live scores.

## Base
Incident-line commit `480ad30e`. Fictional sample resume. 150 drafts. No model call. `KOMPAS_EVAL_TOKEN` was unset.

## Before
150 drafts: 1 pair at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0.

"Define NIST CSF risk assessments. Keep it suitable for technical HR."

versus

"Define OAuth audience validation. Keep it suitable for technical HR."

| Level | Jaccard | Words (left / right) |
|---|---:|---|
| engineer | 0.429 | 36 / 34 |
| director | 0.708 | 54 / 58 |
| architect | 0.690 | 86 / 90 |

Both drafts opened with the same business sentence and the same honest line. Neither resume line named the term.

## After
A definition with no matching resume line opens on the term: "I mean … when I say …". The shared honest line stays off.

| Level | Jaccard | Words (left / right) |
|---|---:|---|
| engineer | 0.000 | 33 / 28 |
| director | 0.632 | 50 / 46 |
| architect | 0.591 | 83 / 81 |

150 drafts: 0 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the ceiling: 0. The audit-versus-service-account pair stayed at director 0.217.

No draft in the 150 named a visa, an address, relocation, Houston, or Saint Louis. Focused suites: 171 pass, 0 fail. `tsc --noEmit` clean.

## Limits
Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10. This is the offline stand-in, not a model answer.


## Superseding release record — 10 November 2026

The definition-term commit `eb37c4566f6d9c1d4b4d988096a2a44066255636` is an ancestor of master and the READY production alias at SHA `11efbbfe7781592bc2fad1216f67546882a1c3ed`, deployment `dpl_7uEfjq1XprC48DoTFfFuiBoShPne`. This supersedes the earlier pending merge step. The sequential offline 150-draft set now has zero pairs at Jaccard >= 0.7, with zero same-answer, length, mode-gap-under-0.50 or ceiling failures. No live model result is implied: 50 paired Kompas/ChatGPT responses and human grading remain 0/50; Windows native answers remain 0/10. The canonical endpoint currently returns `402 DEPLOYMENT_DISABLED`, so reachable production acceptance remains pending.
