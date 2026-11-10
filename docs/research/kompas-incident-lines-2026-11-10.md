# Kompas relevance fold — incident lines, 10 November 2026

## Request
Owner, 9 Nov 2026, 6:18 PM America/Chicago: go full power on Kompas answer relevance. Get every offline pair under Jaccard 0.7, starting with the director pair at 0.710. No new same-answer, length, mode-gap, or ceiling failures. No live scores.

## Base
Design-pieces tree `5d6e3495`, which is pull request 253 restacked on pull request 252, rebased onto master `3e2d2359`. Fictional sample resume. 150 drafts. No model call. `KOMPAS_EVAL_TOKEN` was unset.

## Before
150 drafts: 4 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0.

Worst pair, director:

"In that design, audit evidence disagrees with live configuration. Walk through diagnosis, competing hypotheses, safe containment and rollback."

versus

"In that design, the attacker retains access through a service account after isolation. Walk through diagnosis, competing hypotheses, safe containment and rollback."

| Level | Jaccard | Words (left / right) |
|---|---:|---|
| engineer | 0.478 | 94 / 89 |
| director | 0.710 | 166 / 143 |
| architect | 0.625 | 254 / 223 |

Both director drafts used the same diagnosis, hypothesis, and containment sentences, plus resume lines that name audit or access without naming this incident.

## After
A named incident keeps a resume line only when that line names the incident. Each asked part is spoken with the incident: "For diagnosis, I stay on …". The first sentence carries "in this case, as I saw it" so the engineer floor still holds after the ladder trims a later sentence.

| Level | Jaccard | Words (left / right) |
|---|---:|---|
| engineer | 0.128 | 81 / 57 |
| director | 0.217 | 131 / 108 |
| architect | 0.239 | 198 / 164 |

The audit draft names audit evidence and does not name the service account. The other draft does the reverse.

150 drafts: 1 pair at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode length gaps under 0.50: 0. Answers over the ceiling: 0. The remaining pair is director 0.708, "Define NIST CSF risk assessments" against "Define OAuth audience validation", 54 and 58 words.

Relevance folds, dissection, and the desktop 10-fold: 38 pass, 0 fail. The wider focused set, including grounding, retrieval, guards, and logistics: 170 pass, 0 fail. `tsc --noEmit` clean.

## Limits
Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10. This is the offline stand-in, not a model answer. The NIST versus OAuth pair is the next fold.


## Superseding release record — 10 November 2026

The earlier instruction to open a separate PR after pull requests 252 and 253 is superseded. The incident-lines commit `f8a5288b67b006cd9de4cdaf8e672f7ac5449495` is an ancestor of master and the READY production alias at SHA `11efbbfe7781592bc2fad1216f67546882a1c3ed`, deployment `dpl_7uEfjq1XprC48DoTFfFuiBoShPne`. This confirms source inclusion and deployment metadata, not reachable HTTP behavior: the canonical endpoint smoke currently returns `402 DEPLOYMENT_DISABLED`. The later unmatched-definition fold `eb37c4566f6d9c1d4b4d988096a2a44066255636` reduces the final offline 150-draft set to zero pairs at Jaccard >= 0.7. Live scored folds remain 0/50 and native Windows answers 0/10.
