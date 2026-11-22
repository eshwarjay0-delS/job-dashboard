# Kompas Listening hold — current-master regression repair (22 November 2026)

## Owner approval and user-visible failure

Continue the approved Kompas AI Answer reliability work. The expected interaction is: after an answer has completed, a first press with silence or candidate-only speech must keep listening; a second press is the explicit Answer-anyway/re-ask gesture. The existing tests for this behavior must remain intact.

## Root cause

On the prior exact CI head, `livePressDecision` correctly returned `listening` for silence/candidate-only speech after a completed answer. The caller in `public/kompas/app.js` then invoked `manualAnswerTarget` over the recent transcript. That helper found the already-answered prior interviewer question and bypassed the Listening decision, so the first press regenerated an old answer.

A later exact CI run also exposed missing VM fixture globals: seven typed-followup-card tests lacked `answerCtl` and `detectedQueue`; these are read by production `pumpDetectedQueue`. Two typed-question tests showed the first press replaying the old question.

## Implemented on current master

- In `aiAnswer`, return immediately when `decision.listening` is true.
- Preserve `answerAnywayHeld` and the existing second-press Answer-anyway/re-ask path.
- Do not call `manualAnswerTarget` to search the old transcript after a Listening decision.
- Keep silence and candidate-speech assertions unchanged.
- Initialize `answerCtl: null` and `detectedQueue: []` in the one-press, typed-question, typed-followup-card and voice VM fixtures.

## Evidence and commits

- Base master: `23acd80ed645edb3d51a1fda876548eb8367ecbd`.
- Production alias at branch creation: READY deployment `dpl_GXYWcz9taCcYrFWNJ8xzM8qzFqSw`, exact SHA `23acd80`.
- PR #527 exact-head full CI `45040416022` failed 9 tests after the initial three-fixture patch: seven typed-followup-card VM cases lacked queue globals and two typed-question cases exposed the Listening-hold behavior bug.
- Runtime fix: `ee21a0e17dded43366c36fb73e660250e0debe53`.
- Fixture commits: `6aa98eed82b09c5a95a23cd55d91985e8171ed96`, `e4cbad8247c6a901372bbbb345e8f496c98ebc4f`, `7bd3a5c20422be181457cd8df301fc97455f9f01`, `6f8e3ef90e912e8417d6c360fd4d145afb627a5b`.
- The branch is a current-master restack of the approved PR #518 repair. Its exact-head CI has not run yet.
- No local test/build ran because this runtime has no repository checkout and GitHub DNS resolution fails.

## Release and acceptance boundary

This is a web Kompas answer-turn fix, not a voice/caption capture change. The separate Kompas Continuous Voice Delivery automation is disabled; no duplicate audio/caption work was started. No production deployment, authenticated model call, native Windows/phone test or real interview-session test occurred.

## Next step

Open a draft PR and require exact-head full CI, Kompas baseline and Plan/REA success. Review the full diff and preserve all existing Listening/second-press assertions. Only then merge and deploy; verify the exact READY production SHA and active alias. Real user-device acceptance remains separate.
