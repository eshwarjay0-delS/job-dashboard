# Constructed JD tailor — 6 Nov 2026

## Request

Eshwar, 6 Nov 2026, 7:23 AM CT, and the same method in the attached note. Before any resume edit, run two iterations that generate related skills, experiences, points, bullets, skill-section lines, and a summary from the job post plus the candidate's existing work. Sum those keywords. That combined text is the JD. The tailor updates the resume against it. If the score is not above 95%, run one more generate-then-tailor iteration.

Standing limits, same day: do not change experience length or format. Same employers, dates, locations, titles, and the same number of bullets and paragraphs under each employer, including the lead paragraph and any Environments line. Overflow terms go to the summary and the skills line. A term in the constructed JD belongs on the updated resume. Job-post terms are labelled. Do not invent employers, contact details, or dates. Do not mix Houston (`eshwarjay05`, LinkedIn `jayy-eshwar`) and Saint Louis (`jayeshwar44`, LinkedIn `jay--eshwar`).

He also asked that a usable file be produced for the website download and the WhatsApp send, and that the old "terms not in your resume" stop not refuse a file when those terms were placed on the labelled skills line.

## What the code was doing

`expandJdKeywordsTwice` already asked Gemini twice, but only for a keyword array. `scoreKws` was `targetKeywords(extracted, [], jd)`, so those suggestions were not the scored JD. `placeEverything` wrote only terms the resume or the candidate had already evidenced. A later `removeUnsupportedRewrites` stripped other job-post terms, including from the skills line. A term that remained was `unverified_jd_terms`, which the website and a strict WhatsApp check describe as terms that are not in the resume. `roles_unrewritten` fired when fewer than about 30% of a role's bullets changed. That combination matches the reported shape: a file near 30.8% raw coverage with supported skills at 100%, and quality rejections that named `roles_unrewritten` and `quality_incomplete`.

## What changed

`generateRelatedMaterialTwice` asks for the six fields twice, before `draftPass`. `constructJd` appends the summed keywords to the job post, and that string replaces `jd` for extraction, scoring, and the writer. Cache key and resume matching still use the original post. If measured coverage is not strictly above 95% and time remains, one `generateRelatedPass` plus one in-place tailor pass runs, and its new keywords join the score. After the evidence rollback, `placeConstructedOverflow` writes still-missing terms onto the last skills line as `Job-post terms: ...`, and soft skills into an open summary as `Strengths:`. A provider outage (`skillsOnly`) still adds nothing. `JD_TERMS_ALWAYS_ON_SKILLS=0` still leaves them unplaced. A term that appears in an experience bullet is still an unverified claim. A term that exists only on the labelled line is not. Experience edits still drop `added` bullets, keep an `Environments:` prefix, and put a source term back on the same bullet if a rewrite dropped it. Cache generation is 25.

## Tests

Offline only. No live model and no WhatsApp send.

- `scripts/tests/constructed-jd-tailor.test.mjs` 4/4. Two Gemini calls, the second sees the first pass. Coverage at 95 and at 30.8 needs another pass; 95.1 does not. A bullet claim still blocks; a labelled-only term does not. The fixture used two passes plus a third because the first score was not above 95. The Word file scored above 95% of the constructed terms. Employer headers, paragraph counts, and bullet counts matched the source. Roles were rewritten, so `roles_unrewritten` was absent. `Job-post terms:` was in the file. Email stayed `jordan.test@example.com`. `Zscaler Inc` and `2030` were not written. `acceptableWebResume` and `whatsappRewriteUsable` were both true. ATS parse passed.
- Floor and outage: `resume-floor.test.mjs`, `resume-floor-gate.test.mjs`, and `resume-evidence-quality-20fold.test.mjs` passed. A provider outage still does not write JD-only tools.
- Also passed: tailor-lanes, WhatsApp verbosity, resume-profile-evidence, WhatsApp contract, acceptance, ship-on-rollback, keyword-targets, resume-quality, tailor-batch-1030, WhatsApp failsafe, WhatsApp single-request.
- `tsc --noEmit` clean. ESLint clean on the edited tailor files and the new test.

## Limits

This does not prove a live 95% match on Eshwar's EASM or Fairview files. The fixture's writer is deterministic, not Gemini. If every model fails, the run is still `skills_only` and WhatsApp sends the already-chosen resume. If a finished rewrite leaves a role's evidenced bullets under the 98% role check, `role_evidence_gaps` can still hold the website download. The extra model pass is skipped when fewer than 8 seconds remain; the labelled line still runs when a writer finished. Production was not deployed. The pull request is not merged.
