# Kompas rounds 36–55

Rounds 1–35 are the earlier loop (judge scores, then the rubric and insider phases). This table continues that Round N record on master `01ceb1dc` (the answer-order release) plus the eight defensibility patches and the context panel from pull request 348. Scores here are local and deterministic. No model call. No production URL.

The before column is one measurement of that stacked tree. The after column is the same measurement on the final tree. A row names the metric that round was aimed at.

| Round | Change | Before | After | Gates | Decision |
|---|---|---|---|---|---|
| 36 | Mode stance. Engineer, director, and architect add a different sentence, and a bare definition is no longer the same sentence in every mode. | 77/150 mode pairs under a 0.50 content gap; 8 pairs at Jaccard >= 0.7; max 1.000 | 14/150 under 0.50; 0 pairs at Jaccard >= 0.7; max 0.592 | fifty-fold, relevance folds, question-length pass | kept |
| 37 | Relevance is not keyword presence. A line that only repeats the question scores 1, not 4. | 3/3 keyword-only fixtures scored 4 | 0/3 scored 4 | fifty-fold still >= 3 on real drafts | kept |
| 38 | An architect design draft labels an optional tangent and leaves it out of scope. | 0/20 design drafts | 20/20 | design checkpoint test pass | kept |
| 39 | A director draft owns one tradeoff in a single sentence when the ceiling allows it. | 10/50 director drafts | 41/50 | length ceilings hold; 0 over ceiling | kept |
| 40 | A STAR answer may offer to keep going. The prompt says so. The stand-in could not fit the extra sentence under the ceiling. | 0/10 engineer drafts contain "keep going" | 0/10 | ceilings unchanged | kept as prompt only; the measured line did not land |
| 41 | Technical HR gets a plain definition instead of "I mean X when I say X". | jargon hits 4; median 81 words; engineer and director were identical on two definitions | jargon hits 2; median still 81 | the identical pair is gone (see round 36 max Jaccard) | kept; two jargon hits and the median remain |
| 42 | A yes/no or "have you worked with" stand-in stays a short answer. | 33 words | 16 words | under the 28-word cap and the mode ceiling | kept |
| 43 | Complex cards stay Claim, Context, Action, with a pause. A short definition stays one block. | Claim>Context>Action; simple definition has no headings | same | parakeet card tests pass | kept |
| 44 | A figure still has to be in the resume or the question. The presentation drop is unchanged. | invented figures removed | same path | number guard test pass | kept |
| 45 | Teacher order stays Claim, then First, Then, The result. No new random order. | fixed section order | same | order tests pass | kept |
| 46 | A partial question stem is the question before the speaker finishes the sentence. | a stem without punctuation was not returned as the ask | `captureEarly("how would you design the")` is `how would you design the?`, and the long setup is not pulled in | long-context test pass | kept |
| 47 | A kept mic or computer-audio segment includes the last 2 seconds, not only the AI Answer flush. | `includeTail` defaulted off | `keep` turns the tail on for both sources | audio-tail test pass; the two pre-existing voice cases still fail as on master | kept |
| 48 | A 10k-word transcript still resolves to the latest ask. | 1.14 ms, correct question | 1.17 ms, correct question | under 1 second | kept |
| 49 | Parakeet rows stay one tagged line each. This round did not retune the card. | card tests already on master | same | parakeet card test pass | kept, no new card behavior |
| 50 | Clarifying boosters repeat a word the interviewer just said, so a generic "Yeah, that's true" is not the whole set. | aside relevance 14/18; mode 6/6; brief 18/18; natural 18/18 | relevance 16/18; mode, brief, and natural still 6/6, 18/18, 18/18 | aside tests pass | kept; 2 lines still miss |
| 51 | Session claims. "I'm available in the Pittsburgh area, on site" blocks a later "only work remote". | no ledger | rewritten to the earlier claim; private facts he did not say are dropped | brain test pass | kept |
| 52 | Trace. Each suggestion can carry the transcript span that triggered it, as hover text, not as spoken text, and not in localStorage. | no trace | title on the lead; storage still has only the open/closed bit | brain UI test is in CI with jsdom | kept |
| 53 | History. Previous and Next browse earlier suggestions in memory. The newest stays Live. | no history | two accepts, Previous shows the earlier one, Next returns to Live | not written to localStorage | kept |
| 54 | Kompas brain. One pure action per transcript line: summarize, booster, clarify, short-answer, prewarm, flag-contradiction, or hold. Weak lines are dropped. No poll and no extra model call. | no replay | labeled accuracy 1.0 (8/8); padded replay max 0.515 ms; contradiction rate 0 | brain test pass | kept |
| 55 | Desktop shell. The panel and the brain have to ride the window that already uses setContentProtection. | the exe loads the live page; the new files were not on that page yet | `loadURL("kompas://app" + "/kompas/index.html")` fetches `https://job-dashboard-fawn.vercel.app` with `cache: "no-store"`. The panel is not a second window. Preload still toggles `kd-private`. | desktop-brain test pass | kept; no new exe; no desktop release |

## Still failing

- 14 of 150 mode pairs are still under a 0.50 content gap. They were not padded.
- STAR "keep going" is still 0/10. The ceiling ate the extra sentence.
- Technical HR median is still 81 words, and 2 jargon hits remain.
- Aside relevance is 16/18. Two booster lines still do not share a word with the passage.
- The two `kompas-voice` cases still fail the same way as master `313c90a4` (web share prompt order, repeated AI Answer).
- Not a live Windows session. The installed exe changes only when this web page is on production, because the shell loads that page. A native change would need a new exe. This batch does not publish one.
