# Parakeet session 4 — later in the same video

Source: owner comment on draft PR #473, 20 Nov 2026, https://github.com/eshwarjay0-delS/job-dashboard/pull/473#issuecomment-7042182584.

Same public video, from about the 20-minute mark. Length Long. Technical knowledge. Auto on. The YouTube window was hidden whenever Parakeet was clicked, and the on-page clock was unreliable. Times are from his polling script. This is not the 10-question Fortinet gate. The export and screenshot he names are not in this checkout. Resume lines below are his annotations and were not re-checked.

## What was logged

| Ask | Heard | Words | Fire | Owner label |
|---|---|---|---|---|
| Cisco firewall security levels | Transcribed cleanly | ~165 | Auto. First text about 1.4 s after the question text. Stream about 0.9 s. | Right question. Not the candidate. Invented personal settings: inside 100, outside 0, a server zone 50. He says the resume has no ASA security-level work. |
| Cisco FTD, and how it differs from ASA | Two asks merged. ASA heard as "A.s.a." | ~200 | Auto. About 1.9 s to first text, then about 0.9 s of stream. | Answered the difference and skipped "have you worked." Invented an ASA-to-FTD migration. He says the resume has Cisco FTD to Fortinet, not ASA to FTD. A candidate line "Yes. Yeah, I work with." was flagged and did not fire a second answer. |
| Screen | A job description in tiny type, shared in the tab | body not shown live | Screenshot. First text about 4.4 s, complete about 6.6 s. | Live panel showed a heading and no body. The export has a Firepower hardware rundown. It followed the conversation, not the text on screen. One migration detail ("mapping legacy physical interface rules") is not how he reads the resume. Later hotkey presses showed nothing after sharing was cancelled. |

Both auto answers were inside about 2 s. No manual press.

## What this adds

- A number said as his own setting (100, 0, 50) is a hard fail when it is not on the resume. Generic textbook facts are not the problem. "In my past network projects, I set…" is.
- Two questions in one line need both parts, or a clarifier from those words. Answering only the difference and skipping "have you worked" is the gap-bridge miss. No clarify chip appeared.
- A mis-hear ("A.s.a.") still produced a confident 200-word answer, over the Long ceiling.
- The screen button did not show its body, and the text it stored did not summarize the job description on screen. That is a separate bug from the spoken gate. It is not a pass.
- Clarify chips are still absent. A separate mic mute is absent. The web app has no always-on-top overlay. Export contains the screen answer the live panel hid. Speaker labels are still wrong.

## Where Chief looks

No code in this note.

- Personal numbers that are not on the resume: `questionFigures` in `src/lib/kompasGuards.ts` and the FIGURES line in `answerForVerifiedUser` (`src/lib/kompasAnswerService.ts`).
- A merged "have you" plus "how is it different": `clarifyingFromQuestion` in `src/lib/kompasConsistency.ts`, or answer both parts inside the band.
- Screen text versus the last spoken topic: the screenshot path. Do not treat a conversation topic as a reading of the page.
- Long ceiling 180: `levelAwareBand` in `src/lib/kompasDissection.ts`. The 200-word difference answer is over it.
