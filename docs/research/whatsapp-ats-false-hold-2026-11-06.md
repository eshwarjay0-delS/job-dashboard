# WhatsApp sent the original resume after a finished 100% rewrite

## Request

Owner, 6 Nov 2026, about 12:06–12:08 PM America/Chicago, on the jayeshwar44@gmail.com thread. M Fit picked the Cyber Security Analyst resume in Identity and Access Management (6 of 8 headline requirements), said the rewrite was still running, then sent Eshwar_Resume.docx (32 KB) with the caption that the rewrite did not finish cleanly and the file was not rewritten. The same shape happened earlier that morning. The morning rollback of JD-tool paragraphs was already fixed in merged PR #239. This run is the one that remained.

## What production logged

Deployment `dpl_2aTkS5YJcFNsJeKjtWo26tYzkxzA`, commit `f1ba579acc41dea18adcfdaf4aece54c852b6cac`, request `fnnrf-1793988396338` at 2026-11-06T18:08:06Z:

- coverage 100, supported coverage 100
- partial false, skillsOnly false, incomplete false, cached false
- quality status `needs_review`
- blockers `quality_not_deliverable` and `ats_check_failed`
- roleCount 5, unverifiedCount 0, placedFromJd 0, bulletsReverted 0

`quality_not_deliverable` is not a separate failure. `runTailor` passes `partial: true` into `resumeQuality` whenever any quality blocker other than `unchanged` is set. `ats_check_failed` is that blocker, so a 100% finished file is labelled `needs_review` while `incomplete` stays false. `whatsappRewriteUsable` then returned false because `ats.passed` was false, and the webhook sent the library file with "did not finish cleanly."

## Why the ATS check failed

The check ran. It was not missing and the function did not time out before it. On the library resumes in this repo, `extractZones` opens a role whose title is the section word `Projects` whenever that section has lines and no dated employer header. `atsCheck` required a date on that bucket. The real employer lines already had dates. The same check also missed:

- months glued to the previous word (`MAFeb 2021`, `RemoteNov 2022`, `EngineerSept 2023`)
- current-role endings written `Till date` or `to Present`
- a name that shares the contact line, or a Word drawing id glued to the name (`438150356870JAY ESHWAR` in the plain-text extract)
- a skills category such as `Backend Languages:` read as the start of a Languages section, which dropped the skills section

Before this change, 33 of 36 resumes under `resumes/` failed that check. After it, 35 pass. The one that still fails has no email and no phone in the export. That hold stays.

`placedFromJd: 0` is the skills-line floor count, not the bullet weave. The weave ran only for terms absent from the whole document, and it ran after the skills floor. A term already on the skills line or in the summary was treated as covered and was never written into a project bullet. The weave now runs first and selects terms that are absent from the experience bullets. Overflow still goes to the labelled skills line. Employers, dates, contact, bullet counts, and the three profiles are unchanged.

## What changed

- `atsCheck` ignores a section bucket named Projects or Experience, accepts glued months and till-date / to-present endings, reads a name from the exported text when the header zone missed it, and accepts dotted and en-dash phones.
- The ATS text is `docxText`, which includes header and footer contact.
- A category line that ends in a colon and is not itself a section title stays inside skills.
- WhatsApp sends a finished rewrite when the ATS object is missing, or when the only misses are a date or a name on a file that already parsed contact. An export with no resume text, or with no email and phone, is still held and the library file is the backup.
- A clean pass and the website download still require `ats.passed`.

## Tests

`node --test` on resume-ats, whatsapp-resume-acceptance, constructed-jd-tailor, whatsapp-resume-failsafe, resume-floor, resume-structure, and tailor-ship-on-rollback: 92 pass, 0 fail. `tsc --noEmit` clean. ESLint clean on the edited TypeScript files. The acceptance suite includes the logged blocker pair at 100% coverage with `needs_review` and `incomplete: false`, both for a date miss and for a missing ATS object. A contact-and-substantive failure is still not sendable.

## Limits

No live model call and no live WhatsApp send. The 12:08 PM Word file was not in this checkout, so the library resumes were the stand-in. Offline ATS passes are not a hiring-manager reading of the IAM rewrite. Production is unchanged until this pull request is merged and the alias serves it.
