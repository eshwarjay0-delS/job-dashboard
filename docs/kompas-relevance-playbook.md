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
3. Pull the interviewer's own keywords. Phrases such as "residual risk" stay whole. Small words such as "what" and "your" do not count.
4. Build the ban list. A product or attack name that is not in the question, the resume, or the job description is banned. A deep question may keep a technique from the same family as a term the interviewer already said. It may not invent a product.
5. Pick the mode band. Technical HR + Engineer is shortest and measured. Director is the middle length and the most decisive. Architect + Developer is the longest and the most mechanical. The three length, depth, and confidence targets are at least 50 percent apart on every shape.
6. The first sentence has to use the interviewer's keyword, except for an introduction, a closing question, logistics, or a plain acknowledgement.
7. After the model speaks, `settleSpokenAnswer` drops a sentence that uses a banned term, cuts the answer at the mode ceiling, and refuses provider error text. A short answer is not padded. Padding was making every mode sound the same.

The desktop word targets in `src/lib/kompasDesktopResponse.ts` use the same ceilings. A practical question stays longer than a definition at the same mode. It is no longer forced to 180 words at every mode, which was one reason the three modes did not separate and answers ran long.

## What the route does with that

`src/lib/kompasAnswerService.ts` puts the master prompt and the dissection in front of the older instructions. The word ceiling on the plan is the mode target, so a long model answer is cut to that target. Provider text such as "openrouter 429" or "try again in 20ms" is not returned as the answer. The client gets a normal error status and `quiet: true`. `public/kompas/app.js` also refuses to paint that text, and it retries quietly.

`/api/answer` and `/api/kompas/answer` are the same route.

## The offline draft and the reference answers

`draftSpokenAnswer` is a code-level voice so tests can run with no model. It echoes the keyword, uses one line from the fictional resume in `tests/fixtures/kompas-sample-resume.md`, and fills the word band. On a long question the filler repeats. That is a test stand-in, not the live voice. Do not describe it as a ChatGPT answer.

The hand-written references are in `tests/fixtures/kompas-reference-answers.json`. They are the quality bar for four questions about the fictional resume. The test checks that each reference is inside the engineer band, uses the question's words, invents no tool, and still shares some wording with the draft. They are not the same text.

## Live eval

```bash
KOMPAS_EVAL_TOKEN='<supabase access token>' node scripts/kompas-live-eval.mjs
```

The token is read from the environment only. The script does not print it. If the variable is missing, the script exits 2 and does not call production. It posts four questions at all three modes to `/api/kompas/answer` and fails on a repeated answer, a mode gap under 50 percent, provider error text, a missing keyword, a length outside the band, or a banned term. There is no model judge. Depth and confidence are counted from the wording, so a live failure can mean the model did not separate, not that a person scored it.

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

## Bottlenecks

- The live model can still ignore the band. The trim enforces the ceiling. It cannot invent the missing words. A short answer stays short and the live eval fails it.
- The depth and confidence scores are word counts, not a person's judgment.
- The same answer for two questions is detected when most of the content words match. A paraphrased repeat can still get through.
- No signed-in resume was used. The sample resume is fictional on purpose.
- Open pull request #89 is a different WhatsApp path. Do not assume it uses this dissection until it is merged and checked.
