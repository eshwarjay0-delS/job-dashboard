# Kompas Listening hold — current-master regression repair (22 November 2026)

## Owner approval and user-visible failure

Continue the approved Kompas AI Answer reliability work. The expected interaction is: after an answer has completed, a first press with silence or candidate-only speech must keep listening; a second press is the explicit Answer-anyway/re-ask gesture. The existing tests for this behavior must remain intact.

## Root cause

On the prior exact CI head, `livePressDecision` correctly returned `listening` for silence/candidate-only speech after a completed answer. The caller in `public/kompas/app.js` then invoked `manualAnswerTarget` over the recent transcript. That helper found the already-answered prior interviewer question and bypassed the Listening decision, so the first press regenerated an old answer.

The later exact CI run for PR #527 exposed nine failures: seven typed-followup-card tests lacked `answerCtl` and `detectedQueue`; two typed-question tests showed the first press replaying the old question.

## Implemented on latest master

- In `aiAnswer`, return immediately when `decision.listening` is true.
- Preserve `answerAnywayHeld` and the existing second-press Answer-anyway/re-ask path.
- Do not call `manualAnswerTarget` to search the old transcript after a Listening decision.
- Keep silence and candidate-speech assertions unchanged.
- Initialize `answerCtl: null` and `detectedQueue: []` in the one-press, typed-question, typed-followup-card and voice VM fixtures.

## Evidence and commits

- Latest master at restack: `2839db60061b62e8ad1a19db5f31a84e4f949396`.
- It is five commits ahead of `23acd80`; the intervening changed files are `kompasAnswerService.ts`, `kompasConsistency.ts`, `kompas-answer-shape.test.mjs` and Plan Journal, with no overlap in the Listening runtime/test files.
- Prior production alias evidence: READY deployment `dpl_GXYWcz9taCcYrFWNJ8xzM8qzFqSw`, SHA `23acd80`; recheck before release.
- PR #527 exact-head full CI `45040416022` failed nine tests after the first fixture correction: seven typed-followup-card VM cases lacked queue globals and two typed-question cases exposed the Listening-hold behavior bug.
- Current-master runtime copy: `c4279daa45412cd7187a491749355ab61f8e0657`.
- Fixture commits: `1e595687f53e2dafb43b612df0ad7c53c4e3d172`, `de3a2dbee546ed8d92d0d86024375b15c6866b45`, `98408669f1870c35f7f8507954bcd5ee7732b020`, `76a706c735dc3e25a6bc55afd6c9e9d6b4977fba`.
- Exact-head CI has not run yet. No local test/build ran because this runtime has no repository checkout and GitHub DNS resolution fails.

## Release and acceptance boundary

This is a web Kompas answer-turn fix, not a voice/caption capture change. The separate Kompas Continuous Voice Delivery automation is disabled; no duplicate audio/caption work was started. No production deployment, authenticated model call, native Windows/phone test or real interview-session test occurred.

## Next step

Open a draft PR and require exact-head full CI, Kompas baseline and Plan/REA success. Review the full diff and preserve all existing Listening/second-press assertions. Only then merge and deploy; verify the exact READY production SHA and active alias. Real user-device acceptance remains separate.


## Production recheck — 22 November 2026 15:57 UTC

Vercel metadata independently confirms the active production alias now points to READY deployment `dpl_8fFnYzBNDQKdmZ45tMzWvRoB9xP3`, exact Git SHA `2839db60061b62e8ad1a19db5f31a84e4f949396`, with `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app` assigned. This is the current master release, not the Listening-hold fix, which remains unmerged and unverified.
