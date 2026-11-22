# Kompas AI Answer Listening hold regression — 22 November 2026

## Evidence

PR #518 exact-head full CI run 45020071649 failed nine tests. Seven typed-followup-card VM tests lacked answerCtl and detectedQueue. Two tests in kompas-typed-question.test.mjs failed because silence and candidate-only speech after a completed answer caused an immediate replay instead of a Listening hold.

## Source diagnosis

livePressDecision returned listening. The caller then invoked manualAnswerTarget using the full recent transcript. That helper found the already-answered prior interviewer question, so the code treated it as a target and answered again on the first press. The listening decision was being undone by the fallback target lookup.

## Repair

- Return immediately when the decision is listening, preserving the explicit second-press Answer-anyway / re-ask state.
- Keep the existing silence and candidate-speech assertions; do not relax them.
- Supply answerCtl: null and detectedQueue: [] in the typedfollowup VM fixture, matching the production queue state used by other extracted-function tests.

## Commits

- Runtime: 5fcbc31d832b1465f97f75a60336fd596e378d07
- Test fixture: 05bc9a5420e1ecd628445f128fb49abc5aa08fe4

## Validation boundary

The PR #518 initial full CI failed; its Plan/REA and Kompas baseline checks passed. New exact-head CI is pending after this repair. No local checkout or Node test execution was available in this automation environment. No production deployment, authenticated model call, Windows test, phone test, WhatsApp send, or historical 17 Oct delivery is claimed.
