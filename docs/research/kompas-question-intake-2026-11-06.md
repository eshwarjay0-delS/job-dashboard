# Kompas question intake, 6 Nov 2026

Offline slice. Not a live microphone session and not a production deploy.

## Request

Live interview use: find the start and end of a question in speech, caption, and dictation chunks; join fragments of the same question into the whole ask; do not glue the last few different messages; strip filler and the candidate's own reply; repair dictation; if no formal question arrived, form one, including from a single keyword such as "intro". The answer engine receives that whole question. Logistics questions stay on the existing skip path after they are formed. Do not merge. Do not deploy.

## What was already there

PR #125 (`0e2d627b`) made an offline replay of 50 sequences and 66 asks report missed 21, merged 20, misheard 11, then 0, 0, 0. That replay flushes on silence and then calls `answerableQuestions`. It does not hear a microphone.

`localDeriveFallback` joined the last four transcript lines and kept the last 600 characters. A press that had not yet been split sent those lines through as one heard blob. A keyword with no question syntax was left as the keyword, or dropped when `deriveByCode` decided there was no question.

## What changed

`src/lib/kompasQuestionIntake.ts` groups chunks. A later chunk joins the open question when the clause is still open, the chunk continues the sentence, or the earlier lines are setup for the ask. A finished question followed by a different ask stays separate. "Yeah" between two questions does not glue them. Greetings, sign-offs, "X is when..." definitions, and the candidate's own "I..." reply are not turned into a second question.

If the text is not already a question, ten stems become questions: intro, strengths, weaknesses, why this role or company, experience with X, walk me through, tell me about a time, questions for us, how would you / scenario, and conflict or failure. Anything else with real words becomes a best-effort question. "intro" becomes "Tell me about yourself." Salary, visa, address, relocation, and notice are formed as those questions so the existing logistics gate can still skip them.

The desktop page uses the same rules before AI Answer. Different questions become separate pinned cards. One question spoken in pieces is pinned as the whole ask. A single formal line still uses the existing derive cut. `localDeriveFallback` returns the latest whole question, not the last four lines and not only the tail.

Dictation repairs gained kube cuddle, koo ber netties, pee key eye, leased privilege, least priviledge, zero thrust, roll based access, grafanna, promethius, infra structure, see eye see dee, active die rectory, sale point, and azure service principle name. `PHRASE_FIXES` in `public/kompas/app.js` matches `REPAIRS` in `src/lib/kompasDictation.ts`.

## Offline measure

Focused set, 11 sequences. The old behavior is the last four lines joined, then the last 600 characters. That is the fallback this slice replaced. It is not a live microphone.

- Before: 4 sequences put two different named topics in one string (Kubernetes with Terraform, PKI with STAR, CyberArk with least privilege, and Kubernetes with Terraform again around "Yeah"). Two keyword pairs were also one raw string ("intro strengths", "questions for us why this role") even though those strings did not yet contain the formed phrases. 1 long question lost its opening: "certificate authority" was not in the last 600 characters.
- After: 0 of those different-topic sequences share a card. 0 whole questions miss the opening. The long question keeps "certificate authority" and "Venafi".

The existing 50-sequence / 66-ask replay still reports missed 0, merged 0, misheard 0. That replay was already 0 on master. This slice does not claim those 50 sequences were re-measured on a microphone.

## Tests

`scripts/tests/kompas-question-intake-slice.test.mjs`: 13 pass, 0 fail. Desktop and server intake match on the same chunks.

With the replay, spelling parity, dictation accuracy, stress rounds, whole-question, and voice-gap suites: 81 pass, 0 fail.

A wider question, speech, dictation, and voice run: 294 tests, 289 pass, 5 fail. The same 5 fail on master without this change: the 2-line question-box CSS assertion, the stream-meta source assertion, and three voice tests (`failed request does not block`, `permanent failure is visible`, `stalled answers stop spinning`).

`tsc --noEmit` is clean. `scripts/kompas-baseline.mjs`: 15 checks hold.

## Not done

No Windows session, no live microphone, and no caption box on a call. Merge and the production alias are left to others. WhatsApp resume tailoring and System 3 retrieval were not edited.
