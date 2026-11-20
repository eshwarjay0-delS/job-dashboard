# Kompas consistency pass — 20 November 2026

Owner request: every answer relevant, the right length, and a right panel that helps. Question capture is treated as about 60–70 percent and was not this slice. Skip-login stays on. The only off switch remains the exact value `off-confirmed-by-eshwar`. Admin routes stay locked. `fix/google-only-login-production-auth-20261113` was not merged or revived.

## What was checked

Live production recorded in the audit was `1c6c1622`. `origin/master` at the start of this work was `a6f6867e`. `git diff 1c6c1622 origin/master` on the Kompas engine files was empty. The audit's causes matched the source:

- `bookMatch` served a stored answer at keyword overlap 0.75, with an intro shortcut and no epoch or session check.
- `paintFromAnchors` and `showCachedLevel` could show stored prose with `meta` cached.
- `restoreLive` put the previous run back on screen, and a press with nothing new re-asked that card.
- `confirmSurface: true` was hardcoded, so a mid-confidence experience story returned "I would want to confirm that".
- `judgeRewrite` discarded a rewrite that introduced any new note, including a grounded one.
- `presentSpokenAnswer` capped the sentences band at two sentences. Floors existed as `aim * 0.25` and were not applied at display.
- The aside panel filled from canned lines such as "What part of this do you want first?" and the 52-seed clarify bank.

## Narrative quality is the main path

The owner ranked the regular question-and-answer path above the right panel. A good answer opens with the direct answer, then what he did and why, then the result with a number that is already in the resume. It should sound like a person who was there. It is not a First/Next/Finally template and it is not a made-up career.

`judgeNarrative` in `src/lib/kompasConsistency.ts` scores that shape. `scripts/tests/kompas-narrative-quality.test.mjs` runs seven fixtures 20 times each: two grounded stories pass; the confirm stub, the template closer, the invented QA persona, the one-sentence ransomware line, and the second-person L1 line fail. The answer prompt includes that narrative instruction for story and walk-through questions.

The "Senior QA Automation Engineer" persona is not a sample fixture and not the other profile. With no resume, `/api/kompas/prep` still asked a model to write a biography from the job title, and the model invented one. Prep now returns an empty identity when the device has no resume. A dossier is not treated as a resume.

## What changed

Caches serve only when the question, the epoch, and the session are the same. A stored anchor is not painted over a new question. A restored card is not re-asked when nothing new was heard. Mid-confidence stories generate. If the shown text is the stub, empty, or an unsupported product, the card says the resume does not cover it. A grounded rewrite that fixes a gap is kept. Display length uses a visible band: openers aim 120 (90–150), follow-ups aim 70 (50–95), comparisons aim 100 (75–125), short definitions aim 35 (22–50), definitions with application aim 98 (85–110), have-you-done aims 85 (70–120). The sentences band is no longer sliced to two sentences. The left answer drops connector prefixes, generic third person, dictionary lines, headings, and repeated sentences. The right panel is "Say this": a first-person resume line, or one clarifying question taken from the ask. Two asks in one turn are answered in order. A provider cooldown is spoken in seconds.

## Verification

`scripts/tests/kompas-consistency-20fold.test.mjs` ran each pattern 20 times. The text was identical on every fold. SOC word counts from that local run:

| Question | Band | Words | Floor | Aim | Ceiling |
|---|---|---:|---:|---:|---:|
| Led the response to a critical security incident | story | 127 | 90 | 120 | 180 |
| Investigate a phishing email | design-first | 90 | 70 | 100 | 160 |
| EDR versus SIEM | comparison | 108 | 75 | 100 | 125 |
| Contain ransomware across 200 endpoints | design-later | 102 | 70 | 100 | 160 |
| Prioritize a Qualys scan | howto | 101 | 70 | 100 | 160 |

This is a deterministic local gate. It is not a live model call, not an installed Windows session, and not a production check. The pull request has no ship marker. Production stays on the previous build until a later reviewed ship.

## Live audio from the 19 Nov production session

The box Chrome session on live `1c6c1622` (YouTube SOC mock, tab audio, no resume on that device) showed five more failures. `scripts/tests/kompas-live-audio.test.mjs` covers them.

1. **Dropped digits.** The display sanitizer is `withoutInventedNumbers` in `src/lib/kompasAnswerPresentation.ts`, and the same replace in `presentAnswer` in `public/kompas/app.js`. It deleted every digit that was not already in the resume, including the digit inside a label. "L1/L2/L3" became "L" and "layer-3" became "layer-". A digit glued to a letter or a hyphen is now kept. A loose metric that is not in the resume is still removed. The figure guard in `kompasGuards.ts` rewrites unsupported result numbers to words such as "several"; it does not delete the digit out of "L1", because a digit glued to a letter is not a separate figure.

2. **Auto firing on fragments.** Tab audio labels every speaker INTERVIEWER, so the candidate's answers were tagged "Question detected" and Auto opened a card for each fragment: 28 cards in about 5 minutes, including "Okay are okay Yeah yeah." Auto now requires a real interrogative or imperative ask. Filler and a candidate's own story are not asks. A line from the user (You) is never auto-answered, and neither is a paraphrase of what the user just said. A near-identical ask that is already on a card is not answered again.

3. **Level.** Choosing Interview type Technical was writing the answering level back to Technical HR + Engineer. Architect + Developer and Director now stay selected. The live Level box still opens on the level saved with the session.

4. **Stop.** The Start/Stop button was calling `wrapSession`, which left the live view and returned to the session list. Stop now only stops listening. The exit control still leaves the session.

5. **Empty right-panel chips.** Claim, Context, Touch points, and "No booster for this line" are not drawn when there is nothing to say. The panel shows "Say this" when it has a line, and nothing when it does not.

## Live baseline with a resume (run 2, still production 1c6c1622)

The session had a resume attached. Role was Senior SOC Analyst at First National Bank. Level was Architect + Developer, which matched the session. Length was Long. `scripts/tests/kompas-run2-baseline.test.mjs` covers the questions from that run. This is still a local gate, not a live model call.

1. **Length=Long never left the session.** `readLiveAnswerControls` always sent balanced, so the wizard's Long choice did not reach the answer request or the auto introduction. The live request now sends the session length. When that length is long, the prompt asks for the visible band and will not treat one sentence as finished. The prep introduction for a long session asks for about 120 words and must not open with "Having". A stored identity shorter than 90 words is not installed as that long introduction.

2. **A late replace shrank a good stream.** The reports answer grew, then a settle replaced it with a shorter ServiceNow sentence. `keepLongerAnswer` keeps the longer streamed text when the shorter settle is under three quarters of it, unless the shorter one is the one that actually fits the question. The confirm stub is never the text that replace sends.

3. **Resume bias.** SOC questions were closed with ServiceNow and ITIL even though the role is a SOC analyst. A platform sentence is kept when the question is about that platform, or the role line is that platform. Otherwise those sentences are dropped. If nothing on-topic remains, the card says the resume does not cover it instead of filling with the other platform.

4. **Right panel placeholder.** Typed questions were left on "Context shows up with the next answer" because the answer stream never sends an aside payload. That string is gone. A new question paints Say this from the resume, or leaves the panel empty.

5. **Incident stub at 0.28s.** "I would want to confirm that" is not served from the book, not shown by the card, and not returned by the confirm fast path. The fast path now returns the honest line. The route table still generates a mid-confidence incident story.
