# PR #467 risks before any live test

Reviewed 20 Nov 2026. **Not merged.** PR #467 is still an open draft. Head `f5df791c` ("Lead technical answers with the thesis and drop candidate-only claims."). Base is `5af72c12`. GitHub reports `mergeable: CONFLICTING` and `mergeStateStatus: DIRTY`. Master on this machine is already past that base (`2da44026`, including #464 and #469). This note is the open diff, not a merged one.

The parent clarifier suite on that head is **47/47** offline (`node --experimental-strip-types scripts/run-clarifier-fixtures.mjs`). That green run does not cover the five risks below. No live listen. No model call.

## 1. The streamed thesis is not an answer

`technicalThesis` in `src/lib/kompasConsistency.ts` returns "Splunk is what this question is about." for "How does Splunk work?". `streamAnswer` in `src/lib/kompasAnswerService.ts` shows that sentence before the model speaks. He would start reading a label.

Cheap check, already run on `f5df791c`: import `technicalThesis("How does Splunk work?")`. Expect a real first sentence, not a restatement of the question. Same call for a non-tool question returns "…comes down to one point."

## 2. The gap bridge breaks, then the tool filter deletes the honest sentence and a real resume sentence

`jdGapBridge` produced: "I've had less direct hands-on with Splunk; my Maintained the integration of database and CMDB through the MID Server. transfers because it is the same kind of work." The bullet is pasted in whole, so the sentence is not speakable.

`dropUnknownToolSentences` in `src/lib/kompasGuards.ts` then keeps only "transfers because it is the same kind of work." The Splunk sentence is dropped because Splunk is not on the resume, which is the sentence that was supposed to survive. A period is part of the tool regex (`[A-Za-z0-9+.#-]`), so "I maintained the CMDB." is also dropped: the token is `cmdb.` and the resume has `cmdb` without the period.

Cheap check: call `jdGapBridge` and `dropUnknownToolSentences` on those two strings with a CMDB resume line. No model. Pass means the bridge names Splunk once, stays grammatical, and a sentence that ends with a resume tool is kept.

## 3. Clarifiers still come from a hardcoded bank, not from the live question

`scopeLine` returns "Do you mean the overall SD-WAN design, or a specific piece like failover?" for "Did you design it alone, right?" when an earlier turn mentioned SD-WAN. Failover is not in the question. The 47 passing cases expect that bank, so they cannot catch this.

The new file `scripts/fixtures/clarifier-adversarial.json` scores the rule "every clarifier comes from the live question, or there is none." On this head: **13 pass, 7 fail.** Failures: "How large was the CMDB?" becomes "The CI classes, or the record count?"; four multi-part asks get no clarifier or drop the third part; "Did you design it alone, right?" brings in SD-WAN and failover. Counts are in `ops/brain/clarifier-adversarial-results.json`.

Cheap check: `REPO` pointed at `f5df791c`, `node --experimental-strip-types scripts/run-clarifier-adversarial.mjs`. Do not edit the clarifier to make it pass.

## 4. Long has two ceilings, and one of them is 360

For "Tell me about a time you disagreed with a stakeholder." at engineer / long, `levelAwareBand` in `src/lib/kompasDissection.ts` returns floor 150, aim 360, ceiling 360. `answerRoute` in `src/lib/kompasConsistency.ts` returns floor 150, ceiling 180 for that story shape's visible band. The prompt uses the first. The display gate uses the second. The user target is 120–180. `extendFromModel` can add a second model call (`openai/gpt-oss-20b`) when the floor is missed. That was not called here.

Cheap check: print both objects for one story question and one "How does Splunk work?" question. Technical `answerRoute` on that tool question is floor 120, ceiling 180. `shapeDisplayedAnswer` on a two-sentence draft came back at 94 words and still glued on the thesis, an `Example:` label, and the broken bridge. No model call.

## 5. Silero on the loopback, and a trailing "right?" never fires

`maybeLoadSilero(themStream)` in `public/kompas/app.js` attaches MicVAD to the system-audio stream, not the mic. When `__kompasSileroLive` is set, `themQuietNow` ignores the existing RMS timer and waits on `__kompasVadEndedAt`. Weights load from jsDelivr (`@ricky0123/vad-web@0.0.31`, `onnxruntime-web@1.22.0`) and Hugging Face (`smart-turn-v3.2-cpu.onnx`). A failed fetch stays silent. Default is on unless `KOMPAS_VAD` or `KOMPAS_SMART_TURN` is `"off"`.

`lexicalTurn` returns `wait` for any line ending in `right?`, including "You configured the KYC workflow, right?" after a 900 ms pause. `scheduleAuto` returns on the same pattern, so Auto does not answer it.

Cheap check: `lexicalTurn(text, 900)` in `public/kompas/vad-loader.mjs` for a finished question, a "right?" tag, and a four-word fragment. Then confirm `maybeLoadSilero` is only reached from `startSys`. Do not open a live call to test the ONNX file.
