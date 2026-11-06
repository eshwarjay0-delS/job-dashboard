# Kompas answer-relevance fold — 6 November 2026

## Request
Continue from master `986ecef`, which already contains merged PR 226. Fix the stand-in Python fence gap and spoken answers that run past the mode ceiling. Live scored folds stay at 0 while `KOMPAS_EVAL_TOKEN` is unset.

## Method
Source and artifact analysis, plus `KOMPAS_EVAL_OFFLINE=1 KOMPAS_EVAL_SET=sample`. No model call.

## Production at the start
READY `dpl_BdCvdFcfTKPzLAV4dutnkZGFfNc8`, commit `986ecef7c318bb23fd7e338db3fc63f8843dc3be`, target production.

## Before
Offline sample: 15 answers, 3 failures. Every failure was `code question without a fenced block first` for "Write a Python function that returns the findings still open after 30 days." at engineer, director, and architect.

## After
Offline sample: 15 answers, 0 failures, 15 warnings, 0 length warnings. Warnings are depth and confidence word-count gaps. They are not length failures.

A 180-word residual-risk answer, settled with a 400-word plan, came back at 36 words. The engineer ceiling for that question is 40.

Python stand-in prose after the fence, against the mode ceiling:

| Level | Prose words | Ceiling |
|---|---:|---:|
| engineer | 15 | 18 |
| director | 28 | 28 |
| architect | 42 | 42 |

Each of those three drafts starts with a python fence. A SQL question starts with a sql fence. "What does residual risk mean?" has no fence.

An answer that opened on the owner and only later said "residual risk" now opens on "Residual risk is what remains".

The desktop 10-fold harness still passes. It counts spoken words after the fence. It is not a Windows session and not 10 live desktop answers.

## Limits
No live model answer. Live scored folds remain 0 of 50. The 5 November count of 505 same-answer pairs in the 50-question stand-in was not re-run as a live score and is not claimed as changed.
