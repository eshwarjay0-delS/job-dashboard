# Kompas relevance playbook

This is the handoff for the person who owns whether a Kompas answer actually answers the question. The runtime spec is `docs/kompas/MASTER_PROMPT_v1.md` and `src/lib/kompasMasterPrompt.ts`. If you change the spec, add the next version file and keep the old one. Do not edit v1 in place.

## What was already live before this fold

On 29 October 2026, master `4f70b9694aaadcb2aaf8eaf922b1a34c7d5e496f` and production were the same commit.

- Production deployment `dpl_BeCwCn5npGE1rXmJ1Hvi2SvVDJ68` was READY.
- Alias `job-dashboard-fawn.vercel.app` pointed at that deployment.
- Pull requests 111, 112, and 113 were already merged into that commit:
  - #111 `ca193314203d2e910f4d1b46dd146751870e13ee` holds personal answers until the source check finishes.
  - #112 `010a8b2c9a7a450ac2f127104958b5afa70dfb78` makes the production build use Webpack.
  - #113 `ed9a5e7f358df8f0e0e7db4b75f21beb5315d519` is the chief relevance pass: question intent, the 50-question set, and the 54-question kernel.
- Later chief commits such as `ef82692` and `ed9a5e7` are ancestors of that same production commit. They are live.
- Open work that is not in production: pull request #89 (WhatsApp Kompas shared adapter), #32 (WhatsApp email choice), and #23 (a documentation record). None of those is the chief answer algorithm.

A direct `POST /api/answer` on that production build returned 404. The page itself rewrites `/api/answer` to `/api/kompas/answer` in the browser, and that route returned 401 when no one was signed in. The 404 is real for any caller that does not run the page rewrite. This fold adds `/api/answer` on the server so both paths hit the same engine.

## How a question is dissected

`src/lib/kompasDissection.ts` does this without a model.

1. Take the current ask, not the setup in front of it. The older kernel in `src/lib/kompasIntentKernel.ts` still does that cut. Dissection runs on the ask the route is about to answer.
2. Classify the shape: introduction, personal experience, comparison, scenario, technical deep dive, logistics, follow-up, closing, definition, acknowledgement, value, or a direct answer.
3. Pull the interviewer's own keywords from the topic of the ask (`topicOfAsk`). Phrases such as "residual risk" stay whole. Small words such as "what" and "your" do not count. Audience and format words do not count either: in "Keep it suitable for technical HR", "keep", "suitable", "technical" and "HR" are not the topic. Trailing dots are stripped.
4. Build the ban list. A product or attack name that is not in the question, the resume, or the job description is banned. A deep question may keep a technique from the same family as a term the interviewer already said. It may not invent a product.
5. Pick the mode band. A question that lists several parts ("trust boundaries, data flow, failure isolation, rollout and validation") gets a larger band, at most 1.3 times (`partsScale`). "Go deeper" or "walk through" makes a follow-up a technical deep dive, so it is not given a short direct answer. Technical HR + Engineer is shortest and measured. Director is the middle length and the most decisive. Architect + Developer is the longest and the most mechanical. The three length, depth, and confidence targets are at least 50 percent apart on every shape.
6. The first sentence has to use the interviewer's keyword, except for an introduction, a closing question, logistics, or a plain acknowledgement.
7. Each band has an aim (engineer 75%, director 90%, architect 95% of the ceiling) and a floor at 40%. The prompt says "aim for about X words, never more than the ceiling, stop as soon as the question is answered."
8. A code question (`asksForCode`) is told to put one fenced, runnable block first at every level. The words after the block are the only part measured.
9. After the model speaks, `settleSpokenAnswer` drops a sentence that uses a banned term, cuts the answer at the mode ceiling, and refuses provider error text. A fenced block is kept exactly as written. A sentence the question asked for is pinned and survives the cut: "Hypothesis N", a rejected alternative, an owner, a measure, an exit criterion, or a code such as 800-53 (`requiredSentence`). A short answer is not padded. Padding was making every mode sound the same.

The desktop word targets in `src/lib/kompasDesktopResponse.ts` use the same ceilings. A practical question stays longer than a definition at the same mode. It is no longer forced to 180 words at every mode, which was one reason the three modes did not separate and answers ran long.

## What the route does with that

`src/lib/kompasAnswerService.ts` puts the master prompt and the dissection in front of the older instructions. The word ceiling on the plan is the mode target, so a long model answer is cut to that target. Provider text such as "openrouter 429" or "try again in 20ms" is not returned as the answer. The client gets a normal error status and `quiet: true`. `public/kompas/app.js` also refuses to paint that text, and it retries quietly.

`/api/answer` and `/api/kompas/answer` are the same route.

### Number guard

`src/lib/kompasGuards.ts` only guards sentences that claim a result. Structural numbers pass: ordinals, tiers, steps, hypothesis labels, times such as 02:00, ids, control codes such as NIST 800-53 and AC-2, and three-part versions such as 5.4.6. The interviewer's own figures pass too (`questionFigures`), except straight after "by", where repeating the question's number would make it a claimed result. "reduced audit gaps by 40%" becomes "reduced audit gaps noticeably", not "by noticeably".

### Repair loop

`repairStructure` checks the answer for what the question asked and the answer left out: structure items and named terms are the core; asked parts and unasked tangents are advisory. It makes at most two rewrites. The second rewrites the best answer so far with only what is still missing. A rewrite is kept when it fixes at least one core item and breaks none.

The old prompt said "Do not shorten it" while the tangent rule said "delete that jargon" and the mode ceiling then cut the longer rewrite. That is how a repair that landed could vanish (hitachi-grc Q2 and Q3, rounds 11 to 14). The prompt now says to make room by tightening or by dropping an unasked point, never by dropping the missing element, and states the word ceiling.

Every answer now carries a `repair` object in the stream `done` event and in the JSON response: `status` (`not-needed`, `no-key`, `landed`, `partial`, `discarded`, `failed`), `attempts`, `missing`, `stillMissing`, `survived` and `lostAfterSettle`. `survived: false` means the repair landed and a later step (voice repair, fact-check or the ceiling cut) removed it. Each repaired answer also logs one `[kompas repair]` line.

## The offline draft and the reference answers

`draftSpokenAnswer` is a code-level voice so tests can run with no model. It is a test stand-in, not the live voice. Do not describe it as a model answer or as live quality.

It opens on the interviewer's own phrase (`leadPhrase`). It then uses lines from the "Experience" section of the fictional resume in `tests/fixtures/kompas-sample-resume.md`, ranked by the words they share with the question. It never uses the header, contact or education lines. Engineer uses one line (two for a story or a deep dive), director up to three, and architect up to five. If no resume line matches, it says "My resume does not show this exact work" instead of reusing unrelated lines. That reuse is how different questions got the same answer. A multi-part question gets one short sentence per asked part. It never pads.

The hand-written references are in `tests/fixtures/kompas-reference-answers.json`. They are the quality bar for four questions about the fictional resume. The test checks that each reference is inside the engineer band, uses the question's words, invents no tool, and still shares some wording with the draft. They are not the same text.

## Live eval

```bash
KOMPAS_EVAL_TOKEN='<supabase access token>' node scripts/kompas-live-eval.mjs
```

The token is read from the environment only. The script does not print it. If the variable is missing, the script exits 2 and does not call production. `KOMPAS_EVAL_SET` is `sample`, `hitachi` or `all` (the default).

- **sample:** four sample-resume questions and one code question.
- **hitachi:** the hitachi-grc chain from `scripts/fixtures/kompas-evaluation/interview-50.json`, asked in order with the earlier turns as history.

Each set runs at all three modes.

It fails on any of these:

- the same answer for different questions at the same level
- a length gap under 50 percent
- provider error text
- a missing keyword in the first sentence
- a length outside the band
- a banned term
- a code answer without a fenced block first
- a piece the question names that the answer leaves out (`src/lib/kompasEvalCriteria.ts`): 800-53, a rejected alternative, Hypothesis 1 and 2, rollback, an exit criterion, a falsifiable test, a decision owner, measures, or an achieved number the question said not to invent

Depth and confidence gaps are printed as warnings, because they are word counts. Logistics and acknowledgement length gaps are also warnings. Each answer's repair outcome is printed, so a discarded or cut repair is visible.

**Labelling.** A green node test run is code-level only. Say "code-level tests pass". Never call it live answer quality. Live quality is the output of this script with a real token, quoted as it came back.

This session did not have `KOMPAS_EVAL_TOKEN`. No live answer was measured.

## Checklist for the next fold

1. `git fetch origin master` and branch from it.
2. Change one behavior. Add a regression that fails before the change.
3. Run the dissection test, the reference test, the live-eval missing-token test, and the grounding route test.
4. If you change the spec, copy `MASTER_PROMPT_v1.md` to the next version and point `kompasMasterPrompt.ts` at it. Leave v1 in the tree.
5. Commit. Open a pull request. Wait until GitHub CI is green.
6. Merge. Confirm the production deployment is READY and the alias commit matches the merge. Say "deploy pending" if Vercel does not accept the build. Do not call it live before that.
7. Without a token, the live check is `POST /api/answer` and `POST /api/kompas/answer` returning 401, not 404, and `/api/health` returning ok. With a token, run `scripts/kompas-live-eval.mjs` and paste the failure list. Do not invent scores.
8. Add a dated note to the top of `TODO.md` with what was tested and what was not.

## Fold log, 10 November 2026, an unmatched definition speaks its own term

On the incident-line tree, one pair remained at Jaccard >= 0.7: director 0.708, NIST CSF risk assessments versus OAuth audience validation. Both drafts used the same business opener and the same honest line.

A definition with no matching resume line now opens on the term. After: 0 pairs at Jaccard >= 0.7. Same-answer failures 0. Length failures 0. Mode gaps under 0.50: 0. Answers over the ceiling: 0. That pair: engineer 0.000 (33 and 28 words), director 0.632 (50 and 46), architect 0.591 (83 and 81). Live scored folds remain 0 of 50.

## Fold log, 10 November 2026, an incident answer names that incident

On the design-pieces tree, 150 drafts had 4 pairs at Jaccard >= 0.7. The worst was director 0.710: audit evidence disagrees with live configuration, against the attacker retaining access through a service account. Both drafts used the same part templates and resume lines that did not name the incident.

A named incident now keeps a resume line only when the line names that incident, and each asked part is said with the incident. After: 1 pair. Same-answer failures 0. Length failures 0. Mode gaps under 0.50: 0. Answers over the ceiling: 0. That pair: engineer 0.128 (81 and 57 words), director 0.217 (131 and 108), architect 0.239 (198 and 164). The remaining pair is director 0.708, NIST CSF risk assessments versus OAuth audience validation. Live scored folds remain 0 of 50.

## Fold log, 6 November 2026, a design answer speaks its own pieces

On the versus-side tree, 150 drafts had 16 pairs at Jaccard >= 0.7. The worst pair was Front Door, APIM and a private backend against tenant isolation across API, cache and workers. Architect Jaccard was 0.771 at 212 and 226 words, under a 281 ceiling. Both drafts then spoke the same explain list: trust boundaries, data flow, failure isolation, rollout, and validation.

A design answer now speaks only the pieces in the design sentence. The shared explain list stays off. After: engineer 0.556 (59 and 67 words), director 0.533 (91 and 101), architect 0.533 (143 and 159). Engineer overlap rose from 0.542 and stays under 0.7. The Front Door draft still names APIM. Neither draft says "data flow".

Across 150 drafts, pairs at Jaccard >= 0.7 went from 16 to 4. Same-answer failures stayed 0. Length failures stayed 0. Mode length gaps under 0.50 stayed 0. Answers over the ceiling stayed 0. The highest remaining pair is 0.710. Offline sample stayed 15 answers, 0 failures, 16 warnings. Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10.

Re-run on 10 November 2026 after restack onto master `3e2d2359`: still 4 pairs and the same four zeros. Front Door versus tenant stayed engineer 0.556, director 0.533, architect 0.533. The 0.710 director pair stayed. Focused suites 169 pass, 0 fail. `tsc --noEmit` clean.

## Fold log, 6 November 2026, a versus answer stays on the two sides

On master `9d2997ac`, 150 drafts had 84 pairs at Jaccard >= 0.7. The worst pair was two "explain the same incident to a director" questions: rollback scope versus lateral movement risk, and restoration speed versus reinfection risk. Architect Jaccard was 0.811 at 114 and 126 words. Both drafts used the same checklist for decision owner, business exposure, and measures.

A comparison or definition that names two sides no longer takes that checklist, the shared honest line, or an approach line. Extra length uses the two side names. After, that pair is engineer 0.400 (46 and 42 words), director 0.500 (76 and 79), architect 0.500 (120 and 119). Define IDOR versus CSRF against containment versus eradication fell from director 0.810 and architect 0.793 to director 0.500 and architect 0.467.

Across 150 drafts, pairs at Jaccard >= 0.7 went from 84 to 16. Same-answer failures stayed 0. Length failures stayed 0. Mode length gaps under 0.50 stayed 0. Answers over the ceiling stayed 0. The highest remaining pair is an architect design pair at 0.771. Offline sample stayed 15 answers, 0 failures, 16 warnings. These versus answers do not restate the shared checklist. Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10.

Re-run on 10 November 2026 after rebase onto master `3e2d2359`: master still 84 pairs and this tree still 16, with the same four zeros. The two named pairs kept the ratios above. Focused suites 169 pass, 0 fail. `tsc --noEmit` clean.

## Fold log, 6 November 2026, a design answer leaves the shared close

On the pair-resume tree, the worst pair was two Design questions that share the same explain list: Front Door, APIM and a private backend, versus tenant isolation across API, cache and workers. Architect Jaccard was 0.882 at 277 and 281 words, on a 281-word ceiling. Both drafts ended on "The boundary I watch" and on approach lines that do not name the design.

A question that starts with "Design" and whose lead is at least three words no longer takes those lines. Extra length uses the design words. After: engineer 0.542 (89 and 89 words), director 0.651 (138 and 143), architect 0.771 (212 and 226). The engineer ratio rose from 0.406 because the removed lines were shared. It stays under 0.7. The closer is gone.

Across 150 drafts, pairs at Jaccard >= 0.7 went from 106 to 84. Same-answer failures stayed 0. Length failures stayed 0. Mode length gaps under 0.50 stayed 0. Answers over the ceiling stayed 0. The highest remaining pair is 0.811. Offline sample stayed 15 answers, 0 failures, 16 warnings. Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10.

## Fold log, 6 November 2026, a comparison cites only a resume line that names a side

On the comparison tree rebased onto master `1b116ce4`, the worst pair was two "explain the same incident to a director" questions: risk acceptance versus remediation, and containment versus customer access. Architect Jaccard was 0.907 at 126 words each. Both drafts reused the same five resume sentences, including "worked on site" and the weekly risk summary. Those lines match the shared word "risk". They do not name containment.

A comparison or definition now keeps a resume line only when the line names one side of the pair. After that, the same pair is engineer 0.214 (51 and 48 words), director 0.474 (82 and 79), architect 0.543 (125 and 122). The containment draft no longer includes "worked on site" or "weekly risk summary". The remediation draft still uses the resume line that names remediation.

Across 150 drafts, pairs at Jaccard >= 0.7 went from 103 to 106. Same-answer failures stayed 0. Length failures stayed 0. Mode length gaps under 0.50 stayed 0. Answers over the ceiling stayed 0. The three new pairs are comparisons whose resume lines had been the only difference. Offline sample stayed 15 answers, 0 failures, 16 depth and confidence warnings. Live scored folds remain 0 of 50. Live Windows desktop answers remain 0 of 10.

## Fold log, 6 November 2026, comparisons stay on the two names

A definition or comparison no longer takes the shared closing catalog. Length that is still required uses the two named things.

On the incident-ontopic tree, 150 drafts had 113 pairs at Jaccard >= 0.7. After: 103. Same-answer failures stayed 0. Length failures stayed 0. Mode length gaps under 0.50 stayed 0. Answers over the ceiling stayed 0.

"Define IDOR versus CSRF" versus "Define containment versus eradication": architect 0.905 (105 words, included "The boundary I watch") to 0.793 (94 words, that line gone). Director 0.867 (62 words) to 0.810 (52 words). Engineer stayed 0.636 at 29 words. Offline sample stayed 15 answers, 0 failures.

## Fold log, 6 November 2026, incident length without the shared close

On the rebased distinct-incident tree, the worker and updater architect drafts still overlapped at 0.778 because the shared closing lines were filled back in to meet the longer mode. Those lines do not name the incident. They stay off for a named incident. The length that the longer modes still need is said with the incident itself.

Worker versus updater after that change: engineer 0.455, director 0.576, architect 0.650. Architect words 149 and 164, both under the 281 ceiling. Across 150 drafts, pairs at Jaccard >= 0.7 went from 153 to 113. Same-answer failures stayed 0. Length failures stayed 0. Mode length gaps under 0.50 stayed 0. Answers over the ceiling stayed 0.

## Fold log, 6 November 2026, distinct incidents

Code-level only. `KOMPAS_EVAL_TOKEN` was unset. Live scored folds remain 0. Desktop 10-fold harness stays an offline stand-in, not a Windows session.

On master `21ba302`, 150 offline drafts of the 50-question fixture had 505 pairs at Jaccard >= 0.7. Ten of those questions start with "In that design," and then name a different incident. The stand-in lead stopped at "in that design", so engineer, director, and architect each returned the same answer for a worker-ownership incident and a signed-updater incident. Ratio 1.000 at every level.

After the lead keeps the incident, and a named incident no longer refills from the shared approach catalog: that pair is engineer 0.455, director 0.667, architect 0.778. Each answer names its own incident and not the other. The 150-draft gate reports 0 same-answer failures. Raw pairs still at Jaccard >= 0.7: 153, and each of those names its own ask. Length failures: 0. Mode length gaps under 0.50: 0. Answers over the mode ceiling: 0. Offline sample remains 15 answers, 0 failures.

TODO.md and the plan journal were not edited. Pull request 234 already changes both and does not merge cleanly.

## Fold log, 6 November 2026

Code-level only. `KOMPAS_EVAL_TOKEN` was unset. Live scored folds remain 0. Production at the start of the run was READY `dpl_BdCvdFcfTKPzLAV4dutnkZGFfNc8` on `986ecef7c318bb23fd7e338db3fc63f8843dc3be`.

Offline sample set before this fold: 15 answers, 3 failures, all "code question without a fenced block first" for the Python question. After: 15 answers, 0 failures, 15 warnings, 0 length warnings. The stand-in now opens a code question with one fenced block. Spoken length still ignores that block.

A 180-word residual-risk answer passed with a 400-word plan settled to 36 words. The engineer ceiling for that question is 40. An answer that opened on the owner and buried "residual risk" now opens on residual risk.

## Fold log, 5 November 2026

Code-level only. `KOMPAS_EVAL_TOKEN` was not set in this run, so no live answer was scored. Production at the start of the run was READY `dpl_kns4gHRz7cSaX4SuexLZtJuCp9PJ` on `c33fd90fe01436445822cf9aeaa83d4ad775c28b`. Unauthenticated `POST /api/answer` and `POST /api/kompas/answer` both returned 401. `GET /api/health` returned ok.

Measured before the fix, on the fictional sample resume:

- Settled text kept "I need an H-1B and I live in Austin", "I am open to relocation", and "My home address is 10 King Street" inside a residual-risk answer.
- "I live in Dallas, is that a problem?" was not skipped.
- These whole-utterance gateway lines were not treated as provider errors: "Something went wrong. Please try again.", "The AI service is unavailable.", "Sorry, the model failed to respond.", "We couldn't generate a response. Please retry.", "Anthropic is experiencing high demand."
- Across the 50-question fixture, 150 offline drafts, 0 length gaps under 50 percent, and 505 same-answer pairs at Jaccard >= 0.7. That pair count is the stand-in sharing approach lines across chains. It is not a live score.

What changed: settle drops visa, home address, where the speaker lives, and personal relocation unless the question asked and the resume states it. Moving a system stays. A question that is only "I live in …" or "my address is …" is skipped. A paraphrased sentence from one of the last three answers is dropped when the new answer also has a new point. The five gateway lines above are refused.

Desktop 10-fold (fictional resume plus a short JD, five pasted and five spoken, offline stand-in): 2 logistics asks skipped, 8 answered. Highest same-answer ratio in that set was 0.561. Lowest mode length gap was 0.50 (code, director 28 words, architect 42). Not a Windows session.

## Fold log, 29 October 2026 (box session, branch `cursor/kompas-relevance-dissection-2f7c`)

All results below are code-level. No live answer was measured.

1. Baseline loader. `scripts/kompas-baseline.mjs` could not load a `.ts` file that imports another `.ts` file, which broke prebuild. It now loads them recursively. The baseline reports 15 checks hold.
2. Keywords. `topicOfAsk` drops audience and format words. Trailing dots are stripped.
3. Bands. Multi-part asks get up to 1.3 times the band. "Go deeper" is a deep dive. Hitachi Q4 architect went from 99 to 238 words. Q2 and Q3 architect are 281.
4. The service uses the scaled band from the dissection, not the flat one.
5. The trim pins asked-for sentences, so a repaired element is not cut.
6. Settling keeps a fenced code block first and verbatim.
7. Offline draft rewrite: experience lines, no header, no padding.
8. Evaluator: same-answer compares the same level only (Jaccard at least 0.7). Depth and confidence are warnings. Logistics length gap is a warning.
9. Aim words for real mode separation.
10. The draft caps lines per mode, says so when the resume has nothing matching, and adds asked-part sentences. The VOICE instructions are rewritten in plain words.
11. Number guard: three-part versions pass, the question's own figures pass, and "by noticeably" is fixed.
12. Repair: no contradicting prompt, ceiling stated, second attempt builds on the best rewrite, outcome visible as `repair` in the done event and JSON, `survived` checked after settle.
13. Code-first: the dissection prompt says block first at every level, and the evaluator fails a code answer without one.
14. Live eval: hitachi chain, criteria checks, warnings, and repair outcomes printed. New code-level test file `scripts/tests/kompas-relevance-folds.test.mjs` (16 tests) and the existing `kompas-guards.test.mjs` added to CI.

## Bottlenecks

- The live model can still ignore the band. The trim enforces the ceiling. It cannot invent the missing words. A short answer stays short and the live eval fails it.
- The depth and confidence scores are word counts, not a person's judgment.
- The same answer for two questions is detected when most of the content words match. A sentence that copies one of the last three answers is dropped when the new answer also has a new point. A full paraphrase with no new point still stands, so the repair loop can rewrite it.
- The repair loop is still one model call per attempt. `repair.status` shows whether it landed. It cannot show whether the rewrite reads well.
- The criteria checks are word patterns. "Rejected alternative" passes on "instead of", even if the alternative is weak.
- On the 50-question fixture, the offline draft still repeats itself for chains whose questions share a whole second sentence. The fictional resume has no cloud work, so the draft only has the asked-part sentences. This is a draft limitation. The live model has a real resume.
- No signed-in resume was used. The sample resume is fictional on purpose.
- Open pull request #89 is a different WhatsApp path. Do not assume it uses this dissection until it is merged and checked.
