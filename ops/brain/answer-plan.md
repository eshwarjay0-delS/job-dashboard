# Answer plan — next folds

Read on 20 Nov 2026. Live tree is master. PR #467 (`f5df791c`, still open) is the incoming answer path and is called out where it already moves a fold. Baseline is Parakeet: about 7 seconds, and it misfires by speaking claims the candidate just said. Kompas is about 1 second. Keep that speed.

Target for Length = Long: 120–180 spoken words, first person, a stake and a bit of curiosity, a story that lands, and an honest gap ("I've had less hands-on with X; my Y transfers because..."). No new employer, tool, story, or number. Houston resume only (`eshwarjay05`).

## What the prompt does now

The card is one system string built in `answerForVerifiedUser` (`src/lib/kompasAnswerService.ts`). It stacks `masterPromptBlock` (`src/lib/kompasMasterPrompt.ts`), `dissectionPrompt`, the `SYSTEM` constant in the same service file, `QUESTION_FIRST_POLICY`, evidence, audience, `PERSONAL_EXPERIENCE_POLICY` or `TECHNICAL_ANSWER_BOUNDARY`, and `RESPONSE_CRAFT_POLICY` (`src/lib/kompasAnswer.ts`). The model is told to sound like a person, then buried under competing rules.

Length is three different numbers:

- `visibleLengthBand` (`src/lib/kompasDissection.ts`): a story is floor 90, aim 120, ceiling 180. A how-to is floor 70, aim 100, ceiling 160.
- The same file's `QUESTION_LENGTH` star row for engineer is aim 180, ceiling 280, and `bandFor` sets the prompt target to the ceiling.
- `answerForVerifiedUser` then, when Length is long, sets `plan.words` to `min(300, plan.words * 1.5)`.

`NARRATIVE_LINE` in `src/lib/kompasConsistency.ts` asks for "what he did" and "one number already in the resume." The "he" fights first person. The number rule pushes a metric the bullet often does not have.

#467 adds `levelAwareBand` (long non-story floor 120, long story floor 150 and ceiling up to 360), `answerRoute` (technical floor 120, story floor 150), `technicalThesis`, `jdGapBridge`, `shapeDisplayedAnswer`, and `extendFromModel` (a second call to `openai/gpt-oss-20b` when the floor is missed). Those are the folds below that #467 started and did not finish.

## Ranked folds

Score is impact divided by cost. Impact is how much it moves relevance, realism, the 120–180 band, or human tone. Cost is how much code and how much regression. Highest first.

1. **Score 5. One Long band, 120–180.** `levelAwareBand` and `visibleLengthBand` in `src/lib/kompasDissection.ts`, `answerRoute` in `src/lib/kompasConsistency.ts`, and the `plan.words` assignment in `answerForVerifiedUser`. Long floor 120, ceiling 180, aim near 150, for every question type the user marked Long. Delete the `* 1.5` cap at 300 and the story ceiling of 360. Short and balanced stay on `visibleLengthBand`.
2. **Score 5. Do not speak the canned thesis.** `technicalThesis` in `src/lib/kompasConsistency.ts` and the `show(thesis)` call in `streamAnswer` (`src/lib/kompasAnswerService.ts`). "Splunk is what this question is about" and "…comes down to one point" are not the answer, and they are streamed first, so he starts talking before the real sentence exists. Sentence one should be the model's first spoken sentence after the guards, still first person.
3. **Score 4. Stay on one model call.** `finishSpoken` and `extendFromModel` in `src/lib/kompasAnswerService.ts` and `src/lib/kompasConsistency.ts`. A second call spends the 1-second advantage against Parakeet. Set `maxTokens` from the 180 ceiling in the first call. If the draft is still short, stop. Do not pad.
4. **Score 4. First person, including the instruction.** `NARRATIVE_LINE` in `src/lib/kompasConsistency.ts`, and the line in `shapeDisplayedAnswer` that writes ``I did ${resumeLine}``. Change "what he did" to "what I did." Do not prefix "I did" onto a raw bullet ("Tracking of Incidents…", "Hands-on experience…"). That is the same defect `speakableLines` / `asFact` was meant to stop on the side panel.
5. **Score 3. Interviewer "I" is not the candidate.** `candidateLines` in `src/lib/kompasConsistency.ts`. Today any `Them:` line that contains "I" is treated as candidate speech, so "what I want to hear is…" strips answer sentences. Only `You:` lines are candidate speech.
6. **Score 2.5. A gap bridge that can be said.** `jdGapBridge` in `src/lib/kompasConsistency.ts` and `dropUnknownToolSentences` in `src/lib/kompasGuards.ts`. The bridge is currently `I've had less direct hands-on with ${tool}; my ${entire bullet} transfers because it is the same kind of work.` Name the closest resume tool in a short noun phrase, not the whole bullet. Then let that one sentence name the missing tool. `dropUnknownToolSentences` currently deletes any sentence that names a tool the resume lacks, which deletes the honest bridge. Allow the bridge sentence. Keep dropping a sentence that uses the missing tool as if he ran it.
7. **Score 2.5. The model never sees his own claims.** The transcript block in `answerForVerifiedUser` (`src/lib/kompasAnswerService.ts`). Parakeet's miss is lifting what the candidate just said. `dropCandidateOnly` runs after generation. Strip `You:` lines before they enter `userText`. A claim that is only in the transcript and not on the resume never reaches the model.
8. **Score 2. Clarifier words come from the live question.** `templateFor`, `scopeLine`, `overloadedLine`, `numberLine`, `multiLine`, `hypotheticalLine` in `src/lib/kompasConsistency.ts`. Failover, "SLA monitoring" / "compliance dashboards", "P1", and "false-positive" are hardcoded. If the choice cannot be phrased with words from the live question, return no clarifier. The 20 adversarial cases are the check. Do not widen the bank.
9. **Score 2. Do not paste resume bullets to hit the floor.** `extendFromResume` in `src/lib/kompasConsistency.ts`. It appends raw bullets, then slices a bullet mid-phrase to fill the remaining words. That misses first person and lands past 180. Removing it follows from fold 3.
10. **Score 2. Curiosity only when the resume has the verb.** The `SYSTEM` constant in `src/lib/kompasAnswerService.ts`. One clause of curiosity ("what I wanted to check was…") only when the resume line already says he reviewed, investigated, or assessed. Otherwise it invents a feeling. Do not add "right?" or "you know". The delivery rules already ban those fillers.
11. **Score 2. A human-tone paragraph for Long only.** The `SYSTEM` constant in `src/lib/kompasAnswerService.ts`, gated by `cardControls.length === "long"`. Four lines: contractions, one stake taken from a noun already in the chosen resume line (the SLA, the approval, the CI class), then the action, then the result the line actually states. No new emotion word that the resume does not support.
12. **Score 1.7. Tag every spoken sentence.** `whereFrom` in `src/lib/kompasSourceRetrieval.ts`, called from `gateDisplayedAnswer` in `src/lib/kompasConsistency.ts`. A sentence with no resume or JD span is dropped, except the single bridge sentence from fold 6, which is tagged `bridge`. This is the grounding fold in `ops/brain/research.md`.
13. **Score 1.5. Story shape in the prompt, not a second builder.** `shapeDisplayedAnswer` in `src/lib/kompasConsistency.ts` rebuilds a technical answer as thesis + how + `Example:` + gap + "I did …". `repairStoryShape` in `src/lib/kompasGuards.ts` only reorders. Put the shape in `NARRATIVE_LINE`: what was going on, what I did, what changed, using one resume line. Stop the rebuild. `Example:` is a label he would not say.
14. **Score 1.5. Split the 180 across the asks.** `requestedParts` in `src/lib/kompasAnswer.ts` and the LENGTH line in `answerForVerifiedUser`. When the question has two or three parts, say so in the length line ("cover each part inside 180 words") instead of answering part one at the full ceiling.
15. **Score 1.5. Stake from the bullet, not a mood word.** A helper next to `NARRATIVE_LINE`, used by the Long branch of the LENGTH line. The stake is the noun the resume line already carries. Do not add "excited", "passionate", or a feeling the bullet does not state.
16. **Score 1. Shorter system string, later.** The `system` field in `answerForVerifiedUser`. Collapsing master + SYSTEM + craft + evidence into one spoken card would help tone, and it would also risk every guard that depends on a block. Do it after folds 1–7, not before.

## What not to do

Do not add a tone model, a second live call, or a story the resume does not contain. Do not borrow the Saint Louis profile. Do not turn the gap bridge into "I have used X."
