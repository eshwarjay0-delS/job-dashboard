# Parakeet session 3 — Long, auto, technical

Source: owner comment on draft PR #473, 20 Nov 2026, https://github.com/eshwarjay0-delS/job-dashboard/pull/473#issuecomment-7041919600.

Same public mock-interview video as session 2. Length was Long. The question type was Technical knowledge. Auto Answer was on. The YouTube window sat behind Parakeet, so the video clock froze while the video kept playing. Times below are the owner's estimates. This is not the 10-question Fortinet gate. The export and screenshots he names are not in this checkout. Resume lines below are his annotations and were not re-checked.

## What was logged

| Ask | Heard | Words | Fire | Owner label |
|---|---|---|---|---|
| Check Point experience | Clean enough to answer | ~115 | Auto, twice, near-duplicate | Right question. Hedge: hands-on is FortiGate, not Check Point. Then unsupported "various security platforms and cloud native firewalls." |
| Ad | HVAC / Upwork audio | ~35 | Auto, "Can you hear me" | Misfire on the ad. The answer even says an ad was playing. |
| Check Point components | Clean | ~150 | Auto. First text to full text about 0.9 s | Right question. Generic product facts. Title line. Generated before the candidate said the three parts, so not a lift. |
| Manual Ctrl+Enter | Candidate agreeing with those components | ~85 | About 1.0 s to first word, 1.4 s full | Wrong. Answered the candidate. Opened with "I completely agree." |
| Stealth rule | Heard as "sales rule" | ~190 | Auto. Stream about 1.0 s | Wrong topic. Rewrote "sales rule" into implicit rules. FortiManager stretch: "implicit baseline policies" is not how the owner reads the resume. |
| Typed follow-up | "shorter version with an example from my resume" | ~75 | About 1.2 s first, 1.5 s full | Names AT&T. Owner says that program is on the resume. Also carried the earlier "I agree." |

Streaming of a long answer was about 1 s. Press-to-first-word on the manual button was about 1.0 s. That is the fast path. It is not a clean end-of-question measurement, because several polls could not separate the question end from the first word.

## What this adds

Session 1 invented experience on a typed Fortinet screen. Session 2 missed or truncated the spoken question. Session 3 is the mix:

- A missing tool can be hedged. The Check Point answer said the hands-on work is FortiGate. That is the bridge shape. The extra sentence about "various platforms" is still a claim the owner does not see on the resume, so it is a hard fail under `ops/brain/parity-gate-v1.md`.
- Auto fired twice on one question, fired on an ad, and the manual key answered the candidate.
- A mis-hear must stay a mis-hear. "Sales rule" was rewritten into a different Check Point topic. The answer was confident and about 190 words, over the Long ceiling.
- A follow-up kept the previous wrong stance ("I agree") and then attached a resume employer. One bad turn contaminated the next.
- Long was 115, 150, and 190. Only the components answer sat inside 120–180. The gate needs 9 of 10 inside that band.
- Clarify chips and Regenerate were absent. Speaker labels were wrong. Tab audio, live transcript, auto, the manual button, typed follow-up, history, pause/resume, and export did work. Mute was not isolated.

## Where Chief looks

No code in this note.

- Do not answer an ad or the candidate: `soundsLikeCandidate` and the auto path in `public/kompas/app.js`. The manual press is `aiAnswer`.
- Do not rewrite a mis-heard noun into a neighboring topic. Question intake, before `technicalThesis` in `src/lib/kompasConsistency.ts`.
- Do not let one bad turn set the next. Session memory on the follow-up path in `src/lib/kompasAnswerService.ts`.
- Hedge a tool the resume does not name, and then stop. `jdGapBridge` in `src/lib/kompasConsistency.ts`. No "various platforms."
- Hold Long at 120–180. `levelAwareBand` in `src/lib/kompasDissection.ts`.
