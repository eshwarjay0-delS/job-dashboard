# WhatsApp two-line JD parser restack — 23 November 2026

## Owner approval and scope

Continue the approved named-resume selection fix. A WhatsApp message containing a one-line job description followed by `use the SOC resume` must be split into the JD and hint; a short two-line chat must not be treated as a job post. This is parser-only routing. Do not guess the account, bypass resume identity checks, send a real WhatsApp message, or replay the 17 October incident.

## Production baseline

- Canonical master at audit: `7ea4414f3fdad5b30eb03473f02d9c4cf260e720`.
- Vercel production deployment: `dpl_6AuYp2LqG6PVE6nHDDcJHhDwcyjR`, READY.
- Canonical alias `job-dashboard-fawn.vercel.app` independently resolves to that exact deployment/SHA.
- Current source `src/lib/role-match.ts` still rejects a two-line message because `splitTailInstruction` requires three lines. This is a verified source defect, not proof that it caused the historical 17 Oct send.

## Restack

Branch: `fix/whatsapp-two-line-jd-restack-round14-20261123`, based on the deployed master SHA.

- Parser: accept exactly two lines only when line 1 matches the existing JD signature; preserve the existing final-line resume-hint parser and 70-character limit.
- Tests: positive one-line JD + named resume; negative short chat.
- CI wiring: run `scripts/tests/role-match.test.mjs` in `prebuild`.
- CI fixture repair: add `answerCtl: null` to four VM test contexts in `kompas-one-press.test.mjs`, `kompas-typed-followup-card.test.mjs`, `kompas-typed-question.test.mjs`, and `kompas-voice.test.mjs`. These repairs are test-only; no Kompas runtime code changed.

## Evidence

The earlier PR #547 head `18e694e0ba287950cd60f299021d2404f9dee872` had full CI run [45067598157](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/45067598157) fail 24 tests; all 24 errors were `ReferenceError: answerCtl is not defined` from the four VM test harnesses. The Kompas baseline run [45067598169](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/45067598169) passed. This restack corrects those harnesses, but full CI on this exact branch is still required.

Commit sequence (branch):
- `22287ac5881dfdd744ba21dd7b951d5272beb811` parser
- `7233fbea8567c335f04d1feb54700d5fc5ceebfa` parser test
- `d250f99d06b72f2f19fea8b1e61022880fdadb0f` prebuild registration
- `a299b794ff39230fbdce9c53c916ac344dffef81` newline test correction
- `79e6257aceb104b1f63eafbbe2d2a1656047c2a8`, `e26d551aba04f41b7c3f6fbeafe92ca90cfc70f2`, `063d048ad6d6966645cfa20bf7810c0158cff292`, `27d95800858e1d6f9b6efbf9817b5761e78a68c8` test-fixture controller initialization

## Blockers and acceptance

- No local clone/build/test: container cannot resolve `github.com`. GitHub source and Actions are reachable through the connected integration, so remote CI is the execution gate.
- No exact-head full CI, WhatsApp recovery, Plan/REA schema or deployment result for this branch yet.
- PR #495 contains a WhatsApp-library integration test on an older base and remains separate; do not duplicate or merge it blindly.
- PR #493's durable explicit-selection/hard-hold route wiring is separate and blocked by the installed Next.js 16.3.8 route guide plus runnable environment. Keep it draft.
- The 17 Oct 17:28 Chicago historical delivery remains **unverified**. Exact generated DOCX, per-run R2 object/version, webhook correlation, Meta outbound ID and signed delivery/read receipt are missing. No replay/resend.

## Next

Run all exact-head gates on this branch. If green, review and merge via the normal gate, deploy one approved merged SHA, verify the live alias and parser/API behavior, then separately require a consented two-step named-resume/account-confirmation flow without an outbound WhatsApp send.

## Exact-head lint follow-up

Full CI run [45091214598](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/45091214598) failed at Lint with one error in `src/lib/kompasConsistency.ts:1059`: `s` was never reassigned (`prefer-const`). The remaining 267 lint findings were warnings. This is unrelated to the WhatsApp parser and was corrected by changing only `let s = sentence` to `const s = sentence`, commit `23cd3d3253ab62166e79bb87c49a32c6bac6ef10`. No answer-shaping behavior changed. Full CI and all exact-head checks must rerun after this commit.


## Listening-hold CI blocker

On exact PR #550 head `f45e134752559bcd09d5b709c7d29330faffb23c`, full CI [45091575895](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/45091575895) failed in the Kompas question-framing/one-press/typed-input/voice test step. Two Listening-hold assertions (tests 50 and 54) expected zero generated answers but observed one. Lint/typecheck/build passed; Kompas baseline and Plan/REA schema passed. Do not change these Kompas behaviors in the parser PR; coordinate with existing Kompas work. PR #540 full CI also failed on a separate S5 fixture (run 45060694833), and PR #518 currently has no check runs, so no clean Kompas gate is established. The parser fix remains unmerged and unreleased.
