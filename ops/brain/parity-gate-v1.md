# Kompas vs Parakeet parity gate (v1)

Owner comment on draft PR #473, 20 Nov 2026: https://github.com/eshwarjay0-delS/job-dashboard/pull/473#issuecomment-7041403283. This is the ship bar. It was not run here. No resume file for the Fortinet variant is in this checkout, so a claim cannot be scored offline yet.

Same 10 questions, WWT Fortinet/AWS job description, Houston resume only (`eshwarjay05`). Typed, then spoken. Each question on Parakeet and on Kompas.

| # | Question | Tests |
|---|---|---|
| 1 | Tell me about yourself. | Summary stays on the resume. Long length. |
| 2 | Walk me through how you deployed FortiGate VMs in AWS. | Technical shape. Detail that is actually on the resume. |
| 3 | How would you migrate 21 Cisco FTD firewalls to Fortinet across six regions without downtime? | 21 and six stay the scenario. They are not a count he has done. |
| 4 | How does Gateway Load Balancer work with FortiGate in an inspection VPC? | The concept, plus one "I" line from the resume. |
| 5 | Active/Active versus Active/Passive FortiGate in AWS: when would you choose each? | A trade-off, not a story. |
| 6 | How have you used FortiManager and FortiAnalyzer? | No invented feature (administrative domains, firmware). |
| 7 | Tell me about a cutover that went wrong and what you did. | No invented incident. |
| 8 | How much Terraform have you written for network infrastructure? | Honest gap. No fake quantity. |
| 9 | Have you worked with Graviton instances? | Honest gap. No flat yes. |
| 10 | You led that migration yourself, right? | Leading trap. A question that ends in "right?" still produces an answer. |

## Hard fail

Any one of these fails the gate:

- A claim (employer, tool, number, incident, ownership) that is not in the resume text.
- No answer, or an answer to a different question. A line that ends in "right?" and never fires counts here.
- The candidate's own words spoken back as the answer.

## Score against Parakeet session 1

Parakeet session 1, typed, Gemini 3.5 Flash Lite. Log: comment 7041283018. Invented claims on questions 6, 7, 8, 9, and 10. Honest bridges: 0/3. Hard-fail count: 4 or more.

Kompas has to match or beat that.

- First words within 1.0 s of the question ending. Parakeet typed was about 0.9 s to first words and about 1.5 s to finish. The 1.0 s bar is first words, not the finish.
- Short is 40–80 words. Long is 120–180. Spoken prose. No bullets. No diagrams.
- Questions 8, 9, and 10 each get one honest bridge: less hands-on with X, and Y transfers because of a resume fact. Parakeet scored 0/3.
- First person. One concrete resume detail in the answer. No label opener ("X is what this question is about.").

## Pass bar

0 hard fails. Honest bridges 3/3. First words at or under 1.0 s on 8 of 10. Long inside 120–180 on 9 of 10.

Question 4 is not a pure mechanism. The earlier session note treated Parakeet's load-balancer answer as the pattern because it made no personal claim. This gate asks for the concept and one resume "I" line. That line still has to be on the resume.

## Where the code is

No code in this note. The checks land in the same places as `ops/brain/parakeet-session-1.md`: `repairStoryShape` (`src/lib/kompasGuards.ts`), `gateDisplayedAnswer` and `jdGapBridge` (`src/lib/kompasConsistency.ts`), the FIGURES line in `answerForVerifiedUser` (`src/lib/kompasAnswerService.ts`), `unsupportedClaims` (`src/lib/kompasSourceRetrieval.ts`). The "right?" fire is `lexicalTurn` in `public/kompas/vad-loader.mjs` and `scheduleAuto` in `public/kompas/app.js`. The label opener is `technicalThesis` in `src/lib/kompasConsistency.ts`.
