# WhatsApp constructed-JD rewrite — 6 Nov 2026

## Request

Owner, 6 Nov 2026, about 8:41–8:43 AM America/Chicago, and the clarifications at about 9:52 and 9:55 AM CT. The existing plan stays: two pre-edit generation passes, their keywords summed with the job post become the JD, the chosen library resume is tailored against that text, and coverage that is not above 95 percent gets one more generate-then-tailor pass. Experience length and format stay. The 9:55 AM clarification rejects a timid reading of "do not invent." Known JD skills are written into the existing project bullets as natural work, including earlier roles, even when the older bullet did not name the tool. He claims that skill set. A new employer, a new date, a new contact, and a different candidate profile are still forbidden. WhatsApp must send the rewritten file when that plan finishes. The website download stays on the 95 percent gate. The WhatsApp 70–94.9 percent band, with supported coverage at least 95 percent, stays.

## What production did

Deployment `dpl_65vFxLJJPbbQ9ns4XLQfi1PCncLU` is commit `21ba3028` (PR #236). Request `lmvq8-1793979250073` started 2026-11-06T15:34:10Z and logged at 15:36:28Z, about 138 seconds later:

- coverage 100, supported coverage 100
- partial false, skillsOnly false, incomplete false
- blockers: `quality_not_deliverable`, `ats_check_failed`, `unverified_jd_terms`
- unverifiedCount 10, placedFromJd 118, bulletsReverted 32

`unfinishedRewriteWhy` then returns "The rewrite did not finish cleanly." because the result is not partial, not skills-only, and not `roles_unrewritten`. `closestResumeCaption` sends the already-chosen library file and says it was not rewritten. The 8:41 AM CT thread is the same caption shape. That hour is outside hobby runtime-log retention, so that exact request was not re-read. The hypothesis that the function was killed at 60 or 300 seconds does not match this 138-second completed run. The extra-pass skip when fewer than 8 seconds remain is real in the source and is removed here; it is not what rejected this logged run.

## What changed

`removeUnsupportedRewrites` no longer strips a project bullet only because it names a known JD term, while `JD_TERMS_ALWAYS_ON_SKILLS` is on. `dropInventedExperienceEdits` removes a bullet that adds an employer suffix, a year, an email, or a phone the source line did not have, and it drops added bullets. `weaveExperienceRepresentation` writes every still-missing term into the existing project bullets, rotating across roles, as "using / applying / covering" clauses. Environments lines and role-header lines are not given those clauses. Anything a bullet still cannot carry goes to the labelled Job-post terms line. The draft deadline holds back `extraPassReserveMs` so the extra generate-then-tailor pass is not skipped for lack of 8 seconds. WhatsApp gives that one call the budget minus 25 seconds and keeps a result that arrives within 8 seconds after the model deadline. Cache generation is 26.

## Tests

`node --test scripts/tests/constructed-jd-tailor.test.mjs scripts/tests/tailor-budget.test.mjs scripts/tests/whatsapp-resume-failsafe.test.mjs scripts/tests/whatsapp-tailor-verbosity.test.mjs scripts/tests/whatsapp-resume-acceptance.test.mjs`

60 pass, 0 fail. The fixture Word file scored above 95 percent. Illumio and Zscaler are in project bullets. Employer headers, paragraph counts, and bullet counts match the source. `Zscaler Inc` and `2030` are not in the file. A slow usable result is sent; the caption does not say the file was not rewritten. Houston and Saint Louis are not mixed on the failsafe path. `tsc --noEmit` clean. ESLint clean on the edited files.

## Limits

No live model call and no live WhatsApp send. Offline weaving is not a hiring-manager reading of an IAM resume. A total provider outage is still `skills_only` and still sends the already-chosen resume. The 8:41 AM file itself was not replayed.
