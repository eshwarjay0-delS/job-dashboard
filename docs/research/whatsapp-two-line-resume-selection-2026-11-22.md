# WhatsApp two-line JD + named Files resume parser — 22 November 2026

## Scope and approval

The owner-approved narrow parser prerequisite is to preserve a named same-account resume when a one-line job post is followed by a second-line selection instruction. This is not approval to guess accounts, auto-select a resume, send an unchanged file without explicit current-request Files selection, weaken quality/identity gates, or claim unsupported JD terms. The exact fallback label remains **Original resume — NOT TAILORED**.

## Root cause

The current `src/lib/role-match.ts` `splitTailInstruction` returns unsplit input when fewer than three lines are present. A one-line JD plus `use the SOC resume` is therefore treated as the full job input. The short `parseInstruction` limit (120 characters) is not the parser that needs relaxing.

## Restack contents

PR #527 is restacked on canonical master `d3a50dfa32a0d8634bb83d6d78501036324a1942`:

- Accept exactly two lines only if line 1 contains an existing JD-signature match and line 2 satisfies the existing named-resume instruction grammar.
- Reconstruct the signature RegExp without its global flag so repeated calls do not share mutable `lastIndex`.
- Parser regression: positive JD+resume, repeated call, short-chat negative and title-only negative.
- Synthetic WhatsApp library regression: keep SOC hint while asking which account email, no account guessing, and after reply `1` select the exact SOC resume path.
- Recovery-contract regression verifies parser behavior; dedicated WhatsApp workflow runs role-match/library tests.
- Test-only Kompas VM fixture correction: add `answerCtl: null` and `detectedQueue: []` to three harnesses after current-master full CI failed with `ReferenceError: answerCtl is not defined`. No Kompas runtime behavior is changed.

## Evidence

- Canonical master SHA: `d3a50dfa32a0d8634bb83d6d78501036324a1942`.
- Vercel production deployment: `dpl_2nb9gWxH2fTDBs2QFxoo5LnUnaDH`, READY, exact SHA and canonical `job-dashboard-fawn.vercel.app` alias.
- Current master full CI run `45050988852` failed at the Kompas question/voice VM suite: 24 of 72 failures, all reported `answerCtl is not defined` in the excerpted failure; lint, type-check and earlier suites passed. The three fixtures are corrected in the restack.
- PR #527 old head `e843cbb7da053f8788b1a4b54f15dd144a5e3b5c` was based on stale master `23acd80`. Its predecessor results are not reused. Exact-head checks on the restacked branch are pending.
- No local Node test/build ran: this scheduled container has no checkout and `git ls-remote` failed DNS.

## Still separate / blocked

PR #493's durable explicit-selection provenance and unsupported-JD hard hold remain unimplemented. The route edit requires the canonical runnable environment and installed Next.js 16.3.8 route-handler guide specified in AGENTS.md; the Vercel sandbox previously returned HTTP 402 until 1 December 2026. Safe Merge Gate is disabled. The historical 17 Oct 17:28 Chicago delivery lacks the generated DOCX, per-run R2 object/version, webhook correlation, Meta message ID and signed delivered/read receipt. No real send/replay, model call, DOCX generation, R2 write, personal browser/device test or account mutation occurred.

## Next

Run exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA. Require legitimate protected-preview evidence and Safe Merge review before merge/deploy. Then test authenticated two-step resume selection without sending a real WhatsApp message. Keep the historical 17 Oct delivery unverified until its actual artifacts/receipt are found.


## Restack event

Git Data restack commit: `58a975195a54b95bcb18a4efa4132a0cd4163545` (first parent current master `d3a50dfa32a0d8634bb83d6d78501036324a1942`, second parent preserved prior PR head `e843cbb7da053f8788b1a4b54f15dd144a5e3b5c`). This ref update did not create Actions runs at first inspection. The following Contents-API documentation commit is used to request a PR synchronize event; exact workflows will be verified rather than assumed.


## Exact-head CI result (22 November 2026)

- Tested head `e6799c091f0f62ee9cec881f6b005bc2459668e`: full CI `45055713456` FAILED (9/72), WhatsApp recovery `45055713482`, Kompas baseline `45055713445`, Plan/REA `45055713528` SUCCESS.
- Seven failures were `answerCtl is not defined` in `kompas-typed-followup-card.test.mjs`; two were behavior assertions in `kompas-typed-question.test.mjs` because the current master re-answers when the approved Listening hold should pause.
- Existing PR #540 owns both the Listening-hold behavior and fixture correction. It is draft/stale and has no exact-head workflow runs. Do not copy its runtime changes into this parser PR.
- The current docs-only follow-up head is not covered by the predecessor CI run. Git Data/Contents commits did not trigger new Actions for that final head; normal push/workflow-dispatch capability is required.
