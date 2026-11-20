# PR #467 risks before any live test

Reviewed while the pull request was still open. Not merged.

- https://github.com/eshwarjay0-delS/job-dashboard/pull/467
- State: open, draft, `mergeable: CONFLICTING`, `merged_at: null`
- Head: `f5df791c35680aa1a734c4942c1359d8eebf3697` (`cursor/kompas-ready-to-ship-d579`)
- Base recorded on the PR: `5af72c125649b1306dd804704963edc40d1d3215`
- Diff read from that head, not from a merge commit. The 08:00 CT note in the PR body had not landed on master when this file was written.

Offline probes below used that head. They are not a listen-through. Houston fixture lines only (CI classes, CMDB, import sets). No new employers or numbers.

## 1. A question that ends in “right?” never becomes an answer

`lexicalTurn` in `public/kompas/vad-loader.mjs` returns `wait` when the line matches `/right?$/`. Smart-turn runs only when the lexical result is `unsure`, so it is never asked. `scheduleAuto` and `scheduleUnsure` in `public/kompas/app.js` return immediately on the same pattern.

Probe: `lexicalTurn("How do you keep the CMDB accurate?", 800)` → `fire`. `lexicalTurn("You kept the CI classes in the CMDB, right?", 900)` → `wait`. `lexicalTurn("Right?", 900)` → `wait`.

Cheap check: those three calls. Do not open a meeting.

## 2. Silero can hold Auto at quiet = 0

`maybeLoadSilero` sets `__kompasSileroLive` via `attachSilero`. `themQuietNow` then returns 0 until `__kompasVadEndedAt` is set in `onSpeechEnd`. The VAD is `MicVAD` pointed at the system stream (`getStream` returns that stream). If speech-end never fires, the 700 ms gate never elapses.

Cheap check: read `themQuietNow` and `attachSilero`. In a browser console later, with KOMPAS_VAD left on, confirm `__kompasVadEndedAt` moves after a played sentence. If it stays 0, Auto is stuck. `scripts/tests/kompas-turn-models.test.mjs` does not load the ONNX file.

## 3. The technical shape speaks a stub, then a label

`technicalThesis` is shown first for a long route (`streamAnswer` in `src/lib/kompasAnswerService.ts`). Probe: “Discovery is what this question is about.” and “How do you keep import sets accurate comes down to one point.” `shapeDisplayedAnswer` then adds `Example:` plus a resume line. That is the line he would read.

Cheap check: call `technicalThesis` on one “how does X work” question and one “how do you” question. Reject any first sentence that restates the question.

## 4. The JD-gap bridge is not sayable and asserts a transfer

`jdGapBridge` probe, tool Splunk, resume line starting “Configuration Management:”:

`I've had less direct hands-on with Splunk; my Configuration Management: setting up Configuration Management from scratch defining the CI classes and their relationships. transfers because it is the same kind of work.`

The bullet is pasted after “my”, and “the same kind of work” is not a reason. `shapeDisplayedAnswer` appends this on every non-short route that still has room.

Cheap check: one call with a tool that is not in the resume snippet. Read the sentence. Do not send it to a model.

## 5. Length ceilings and the candidate firewall both rewrite the card

Long story: `levelAwareBand("Tell me about a time you disagreed with the owner of a change.", "engineer", "long")` returned floor 150, aim 360, ceiling 360. That is above the 180-word long cap. `answerRoute` on the same kind of question returned floor 150, ceiling 180, so the two gates disagree. `extendFromResume` can still glue a word slice on to reach the floor.

Firewall: `dropCandidateOnly` on two sentences, one of them a tool the CI-class snippet does not contain, with the same words on a `You:` line, returned `""`. The card goes blank. A Them line that merely contains “I” is also treated as candidate speech (`candidateLines`).

Cheap check: the `levelAwareBand` call above, and one `dropCandidateOnly` call with a `You:` line that shares a 3-gram with an otherwise kept sentence. Expect a non-empty answer when the resume still supports the sentence.

## What not to do yet

Do not live-test this head. The existing clarifier file is 47/47 on this head (`node --experimental-strip-types scripts/run-clarifier-fixtures.mjs` in that tree). Those fixtures expect the template nouns. The new file `scripts/fixtures/clarifier-adversarial.json` is 11/20 on the same functions, with the rule that a clarifier comes from the live question or is absent. Both can be true. The 47 do not clear risk 1.
