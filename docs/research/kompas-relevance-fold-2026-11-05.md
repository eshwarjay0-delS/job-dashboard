# Kompas answer-relevance fold — 5 November 2026

## Request
Continue the answer-quality folds on master. Target 50 live scored folds and a desktop 10-fold (resume, job description, spoken and pasted questions). Do not invent scores. Do not show provider errors as answers. Logistics (address, visa, location, relocation) stay out unless the resume states them.

## Method
Source and artifact analysis, plus the offline stand-in in `scripts/kompas-live-eval.mjs` and `draftSpokenAnswer`. No model call. `KOMPAS_EVAL_TOKEN` was unset, so this is not live answer quality.

## Sources
- Production alias `https://job-dashboard-fawn.vercel.app`
- Deployment `dpl_kns4gHRz7cSaX4SuexLZtJuCp9PJ`, commit `c33fd90fe01436445822cf9aeaa83d4ad775c28b`, state READY, target production
- `src/lib/kompasDissection.ts`, `src/lib/kompasLogistics.ts`, `src/lib/kompasLogisticsPhrases.ts`, `src/lib/kompasRelevance.ts`
- Fixture `tests/fixtures/kompas-sample-resume.md` (fictional) and `scripts/fixtures/kompas-evaluation/interview-50.json`

## Observed before the change
- `GET /api/health` returned 200 `{ ok: true, app: "MarketFit" }`.
- `POST /api/answer` returned 401 `{ error: "Sign in again to use this.", quiet: true }`.
- `POST /api/kompas/answer` returned 401 `{ error: "Sign in again to use this." }`.
- A residual-risk answer that also said "I need an H-1B and I live in Austin", "I am open to relocation", and "My home address is 10 King Street" was returned unchanged by `settleSpokenAnswer`. "I relocated the Vault servers" was kept, which is correct.
- "I live in Dallas, is that a problem?" was not stripped. "Where are you based?" was already stripped.
- Five gateway sentences were not classified as provider errors: "Something went wrong. Please try again.", "The AI service is unavailable.", "Sorry, the model failed to respond.", "We couldn't generate a response. Please retry.", "Anthropic is experiencing high demand." A sentence about rate limiting a scanner was not classified as an error.
- 50 fixture questions times 3 modes = 150 offline drafts. Length gaps under 0.50: 0. Same-answer pairs at Jaccard >= 0.7: 505. Word counts: engineer min 28 / median 71 / max 94; director min 52 / median 128 / max 168; architect min 86 / median 205 / max 281. The 505 pairs are shared approach lines in the stand-in, not live answers.
- Offline sample set (`KOMPAS_EVAL_OFFLINE=1`, 5 questions, 15 answers): 3 failures, all "code question without a fenced block first" for the Python question at engineer, director, and architect. 15 warnings. That fence gap was already in the stand-in. This fold did not change it.

## Change
Settle drops an ungrounded visa, home address, "I live in …", or personal-relocation sentence. A mechanism sentence stays when the question asked for it ("How does work authorization work?"). Personal status ("I need an H-1B") still drops when the resume does not state it. A system move ("I relocated the Vault servers") stays. "I live in …" and "my address is …" are skipped as questions on the server and on the page. A sentence that copies one of the last three answers is dropped when another sentence in the same answer is new. The five gateway lines are refused only when they are the whole utterance.

## Desktop 10-fold (offline stand-in, not Windows)
Fictional resume plus the JD line "Security analyst. Assess residual risk, policy exceptions, access reviews, and business impact." Five pasted, five spoken. Two skipped. Eight answered. Highest same-answer ratio in the set: 0.561 (architect, story vs process).

| Fold | Engineer words | Director words | Architect words | Director/engineer gap | Architect/director gap |
|---|---:|---:|---:|---:|---:|
| pasted definition | 30 | 51 | 86 | 0.70 | 0.69 |
| spoken story | 72 | 149 | 246 | 1.07 | 0.65 |
| pasted comparison | 31 | 62 | 104 | 1.00 | 0.68 |
| spoken process | 67 | 129 | 207 | 0.93 | 0.60 |
| pasted location | skipped | skipped | skipped |  |  |
| spoken address | skipped | skipped | skipped |  |  |
| pasted code | 15 | 28 | 42 | 0.87 | 0.50 |
| spoken fact | 35 | 57 | 94 | 0.63 | 0.65 |
| pasted explain | 29 | 51 | 86 | 0.76 | 0.69 |
| spoken close | 15 | 34 | 51 | 1.27 | 0.50 |

Separate from this set, the director stand-in for "how do you assess business impact and residual risk" and "Walk me through how a finding moves from open to closed" still scores Jaccard 0.72. Those two share approach lines. The 10-fold uses a different eighth question so the set itself stays under 0.70.

## Limits
No live model answer, no semantic score, no Windows desktop session. The 505-pair stand-in count is not a production quality score. Deployment of this fold is not claimed here.
