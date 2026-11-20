# Parakeet session 2 — spoken video

Source: owner comment on draft PR #473, 20 Nov 2026, https://github.com/eshwarjay0-delS/job-dashboard/pull/473#issuecomment-7041674669.

Video: a public mock interview, "Top 25 Network Security Engineer Interview Questions" (Rajneesh Gupta, 43:23), https://www.youtube.com/watch?v=HHtQVSGnYgg. The interviewer asks. The person on screen answers as the candidate. This is not the 10-question Fortinet gate.

Limits the owner recorded: the tab was in the background, so the video clock lagged. He seeked forward, so many questions were skipped. Parakeet's speaker labels (Interviewer 1–4) are unreliable. Latencies are approximate. Do not treat the clocks as the 1.0 s bar.

## What was logged

| # | Heard | Words | Fire | Owner label |
|---|---|---|---|---|
| 1 | Question skipped by the seek. Transcript is the candidate talking about a stateless firewall. | 97 | After the candidate finished. Labelled Answer, not auto. | Odd late fire. Nothing invented. Not lifted. |
| 2 | "What is the TCP three-way handshake?" transcribed. | 88 | Auto. Question at 08:05, answer about 50–70 s later, while the candidate was already talking. An ad interrupted. | Late. Nothing invented. Not lifted. |
| 3 | Fragments: "What" / "What is" / "What is physical?" Real ask was the OSI layers. | 67 | Auto on the partial line. | Misfire. Answered layer 1 only. An ad line was transcribed and not answered. |
| 4 | "How does traceroute work?" arrived as "Okay. So then." / "How the work." | 0 | Not fired. Marked "No question." | Misfire. Missed. |
| 5 | "What is IPsec VPN, VPN and how does it work?" Stutter kept. | 100 | Auto during the candidate's answer. Tens of seconds. | Generic. Owner says the resume mentions IPsec VPNs. Not re-checked here. Possibly echoes the candidate's two-phase framing. IKE, ESP, and AH were not copied verbatim. |

Nothing in this log is marked as an invented employer, tool, number, or incident. The spoken failure is the question, not a bluff.

## What this adds

Session 1 was typed and finished in about 1.5 s, and it invented experience. Session 2 is spoken, and the answers that did appear are generic textbook lines. Two of the five are hard fails under the gate in `ops/brain/parity-gate-v1.md`: Q3 answered a fragment, Q4 never answered. Q1 fired on the candidate's line after he had finished. Q5 may be echoing his framing. Those are the gate's "wrong question," "no answer," and "candidate's words" rules.

The word counts that exist (67, 88, 97, 100) sit between Short (40–80) and Long (120–180). Several open with a title line that restates the question. The gate wants spoken prose and no label opener.

This log does not replace the 10 Fortinet questions. A background tab and manual seeks are not the timed spoken run.

## Where Chief looks

No code in this note. Partial fire and a missed question are `lexicalTurn` in `public/kompas/vad-loader.mjs` and the auto path in `public/kompas/app.js`. A title line that repeats the question is the same defect as `technicalThesis` in `src/lib/kompasConsistency.ts`.
