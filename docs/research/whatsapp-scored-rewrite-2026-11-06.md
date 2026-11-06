# WhatsApp scored rewrite — 6 November 2026

Method: source and artifact analysis. No live WhatsApp send and no model generation.

## Request

Finish the WhatsApp resume rewrite so a scored updated Word file goes out. Keep the library file when the rewrite fails, times out, or is truly incomplete. Do not refuse a file only because coverage is under 95 percent. The 70 to 94.9 percent clean pass and the website 95 percent gate stay. Do not merge.

`uploads/quality-bar-from-user-2026-11-05.md` was not in the checkout.

## Incidents

5 November 2026, America/Chicago, WhatsApp M Fit, Houston profile `eshwarjay05@gmail.com`. Saint Louis `jayeshwar44` is a different profile.

- About 6:39–6:43 PM: EASM Cybersecurity Engineer (GRC and IT Risk) reached 30.8 percent. The code then in production sent no file.
- About 7:23–7:27 PM: the same pick line, "16 of 17". The progress note said a Word file would arrive either way. The file sent was `Eshwar_Resume.docx` (195 KB), labelled the closest matching resume because the rewrite did not finish cleanly, and the rewrite was marked incomplete. That file was not rewritten. The pick line is not the match score.

PR #230 is on master as `629be0fe`. It sends the already-chosen resume when a rewrite fails, times out, or is incomplete. That backup stays.

## What the caption is

`closestResumeCaption` in `src/app/api/whatsapp/webhook/route.ts` always writes: this is the closest matching resume because the rewrite did not finish cleanly, then the reason, then "This file was not rewritten."

The reason "The rewrite was marked incomplete." is used only when `whatsappRewriteUsable` is false and the returned result is partial, `quality.incomplete`, or skills-only. A thrown timeout or provider error uses a different reason. The 7:23 PM run therefore got a tailor result back. It did not fail before a result existed.

## Why a finished file was marked incomplete

`resumeQuality` set `incomplete` from its `partial` argument. The tailor passed `partial: qualityBlockers.some(blocker => blocker !== "unchanged")`. Any blocker other than unchanged marked the rewrite unfinished. `role_evidence_gaps` is one of those blockers. It is set when a role with supported requirements is under the 98 percent evidence target. A file can be edited, exported, and scored, including at 30.8 percent, and still carry that blocker. WhatsApp then sent the library resume instead of the scored file.

A second path marked the draft incomplete before the role calls finished. The first split draft was assembled at `deadline - repairReserve`, and `repairReserve` was 60 percent of the call, capped at 150 seconds. On a 195 second WhatsApp call the draft was cut at about 78 seconds. Parts still running became pending. If most parts had a provider error, the draft was thrown away before a file existed.

## Change

- `quality.incomplete` is only a missing part or a skills-only outage. A review blocker still keeps the status at needs review, so the file is not cached as complete and is not a clean pass.
- WhatsApp sends a finished file with `role_evidence_gaps`. The caption names coverage, supported coverage, ATS, risk, and the missing job-post terms. Those numbers are the exported-file recount already in the tailor.
- `roles_unrewritten`, a missing part, a skills-only outage, a timeout, and a provider failure still send the already-chosen library file, labelled unchanged.
- The first draft keeps at least three quarters of the call. Repair is at most 45 seconds. A part still running at assemble time is pending and goes to gap fill. A provider refusal of more than half the parts still throws.
- The 70 to 94.9 percent clean pass still requires supported coverage of at least 95 percent and no blockers. That is what gets filed. The website download still withholds under 95 percent raw overlap.
- Unsupported skills are not written onto the file. The evidence floor is unchanged.

## Checks

Focused suites covering the budget, the quality flag, the send gate, the 30.8 percent scored send, the library backup, the 70 percent clean pass, and the website hold: 152 passed, 0 failed. `tsc --noEmit` passed.

Not a live WhatsApp message. Not a production deploy. A live Houston EASM run is still required after this pull request is merged.
