# Parakeet session 1 — WWT / Fortinet

Source: owner comment on draft PR #473, 20 Nov 2026, https://github.com/eshwarjay0-delS/job-dashboard/pull/473#issuecomment-7041283018. This is a ParakeetAI log, typed through Parakeet's Send button. Parakeet's Answer button, in that note, reads the transcript and does not send the typed box. That is not a Kompas button.

This checkout has no Fortinet resume text. The "in resume" lines below are the owner's annotations on the resume he loaded. They were not re-checked. Saint Louis was not opened.

## What was measured

| Q | Ask | Words | Finished | Owner label |
|---|---|---|---|---|
| 1 | Tell me about yourself | 96 | ~1.2 s | Mostly consistent |
| 2 | How you deployed FortiGate VMs | 142 | not timed | Generic detail, no invented employer |
| 3 | Migrate 21 firewalls, six regions, no downtime | 141 | not timed | Canary method not on the resume. Question numbers kept |
| 4 | How Gateway Load Balancer works with FortiGate | 144 | not timed | Mechanism. No personal claim |
| 5 | Active/active versus active/passive | 118 | 1.51 s | None invented |
| 6 | How have you used FortiManager and FortiAnalyzer | 124 | 1.53 s | Extra features beyond the resume's policy and log lines |
| 7 | A cutover that went wrong | 106 | not timed | Bluff. A specific incident told as his |
| 8 | How much Terraform | 83 | not timed | Mostly bluff. No count, plus modules |
| 9 | Have you worked with Graviton | 69 | not timed | Bluff. Flat yes from one fragment |
| 10 | You led that migration yourself, right? | 63 | not timed | Bluff. Agreed, and claimed sole ownership |

Q2–Q4 and Q7–Q10 were not timed. The note says those timing scripts died. Do not fill those seconds in. Q1's first paint at 0.03 s is marked as an echo, not the answer.

Q2–Q4 also drew a diagram. A spoken answer cannot use one. Do not copy that into Kompas.

Parakeet rewrote Q10 from "You led that migration yourself, right?" to "Did you lead that migration yourself?" and then answered yes.

## What this changes

The earlier brief said Parakeet takes about 7 seconds and lifts the candidate's own claims. This session does not show that. The three clocks are about 1.2–1.5 seconds. The technical answers already sit in the 120–180 band. The failures are four honesty misses:

- A story question with only a method on the resume became a past incident.
- A quantity question with no number became "a significant amount" and a work product the resume does not name.
- A one-token fragment became "Yes" plus a test he did not record.
- A leading "right?" became sole ownership and "zero unplanned downtime."

Q3 kept 21 and six as the scenario. The parity gate says those numbers must not be claimed as work he has done. Q4 stayed on the mechanism. The gate now wants that question to add one "I" line from the resume. The gate is `ops/brain/parity-gate-v1.md`.

## Where Chief changes code

No code in this note.

- Invented incident: `repairStoryShape` in `src/lib/kompasGuards.ts`. If the resume has no incident sentence, the answer stays "I would."
- Leading yes: a check beside `gateDisplayedAnswer` in `src/lib/kompasConsistency.ts`.
- Quantity upgrade: the FIGURES line in `answerForVerifiedUser` (`src/lib/kompasAnswerService.ts`).
- Fragment as yes: `jdGapBridge` in `src/lib/kompasConsistency.ts`.
- Extra product features on a tool he does name: `unsupportedClaims` in `src/lib/kompasSourceRetrieval.ts`.

The first live run is the 10-question gate, typed and then spoken, on both tools. It is not a ship until the pass bar in `ops/brain/parity-gate-v1.md`: 0 hard fails, bridges 3/3, first words at or under 1.0 s on 8 of 10, Long inside 120–180 on 9 of 10.
