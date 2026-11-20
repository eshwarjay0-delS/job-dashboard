# Kompas tab-audio Auto change — approval audit, 20 November 2026

## What shipped

PR [#465](https://github.com/eshwarjay0-delS/job-dashboard/pull/465), “Let tab audio arm Auto and keep candidate lines out of the question”, merged at 2026-11-20 02:59:48 UTC as master commit `5af72c125649b1306dd804704963edc40d1d3215`.

The PR changes `public/kompas/app.js`, `scripts/tests/kompas-live-audio.test.mjs`, `scripts/tests/kompas-source-gate-v2.test.mjs`, and the Plan Journal. The visible/runtime changes include:

- select the live interviewer track for Auto after a re-share;
- classify some first-person-shaped tab-track lines as candidate speech;
- count only pending interviewer lines that look like completed questions;
- prefer the saved session role in the persona chip;
- label non-empty heard questions with `Question:`.

The PR body said “No [ship] on this commit”, but the merge commit message begins `[ship]`. GitHub records the PR as merged by `cursor[bot]`, not the owner. There were no PR review or conversation comments.

## Approval provenance

A targeted accessible prior-context search on 20 November found no direct owner-authored request or approval for the specific tab-audio Auto, candidate-line classifier, pending-badge counting, session-role chip or Question-label behavior. The 2 November owner message “Fix it” followed caption/question-selection regressions, but it does not specify these particular implementation choices. Do not infer direct approval from the assistant/agent PR body or the bot merge.

**Status:** implementation is merged and deployed, but these specific behavior choices remain proposed/unapproved pending an explicit owner decision. The separately approved requirement that Windows Live Captions feed the question/answer path does not automatically approve every heuristic used to classify or suppress lines.

## Deployment and tests

- Current canonical master: `5af72c125649b1306dd804704963edc40d1d3215`.
- Vercel deployment `dpl_FusdJPpFqFu6ZwMGTgg3pLomCAH9`: READY, production, exact SHA `5af72c125649b1306dd804704963edc40d1d3215`.
- Independent alias lookup maps `job-dashboard-fawn.vercel.app` to this deployment; the deployment also lists `marketfit-app.vercel.app`.
- Plan/REA schema `44664644178`: SUCCESS.
- Kompas baseline `44664644232`: SUCCESS.
- Windows one-click Caption Capture build `44664644041`: SUCCESS.
- Full CI `44664644365`: IN_PROGRESS at the last check; do not call it passed.
- No installed Windows, mobile or authenticated live listening test was performed.

## Safe next step

Do not extend or further promote these heuristics. Do not automatically revert them either: no direct owner rejection was found. Obtain an explicit owner decision to accept or reject the exact behaviors. If rejected, prepare a narrow rollback of only PR #465's changes, preserving the approved live-question, session, skip-login, answer-quality and Caption Capture paths. Keep native Windows/mobile acceptance separate from source tests and deployment status.
