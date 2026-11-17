# Resume tailoring baseline

Owner requirement, 16 October 2026: target 95–98% measured JD keyword coverage and substantive experience points throughout all relevant client roles. A high displayed score or count of rewritten lines is not acceptance evidence.

- Review every experience point for supported JD terminology, concrete action, and documented purpose or result. Preserve client context and avoid repeated generic bullets.
- Preserve formatting, names, employment dates, role titles, credentials, and factual experience. Missing qualifications require confirmation, not invented work.
- For web downloads, the minimum raw JD-overlap threshold is 95%; the generation target is 98%. Report actual exported-document coverage without score bands or forced improvement.
- WhatsApp has a separate repository-recorded 6 Nov 2026 delivery policy: a clean 70–94.9% raw job-post result can be sent when supported coverage is at least 95% and the document is complete; a finished readable file below 70% is not a clean pass but may still be sent with missing terms disclosed. The dated owner-request record and 16 Nov owner-authored provenance correction point to this rule, but the primary 6 Nov message was not independently re-retrieved in this run. Preserve the recorded runtime without overstating source verification.
- A partial/incomplete, skills-only, unreadable export, failed provider run, missing document, or failed identity round-trip uses the already-selected same-account resume fallback. Unsupported experience, certifications, employers, dates, metrics and work claims are never invented; job-post-only terms remain labelled rather than asserted as experience.
- Report the entire JD term set separately from the smaller set of skills already listed in the resume. Listed-skill coverage is not total JD coverage.
- Below-target web results, partial, unchanged, and unscorable generations require review. Do not cache them as complete results or overwrite a completed artifact with a lesser draft.
- Each WhatsApp request consumes one fresh JD/resume pair. Never reuse a completed request’s original or mix identities.
- Keep the summary and headline unchanged by default. Preserve technical expertise category headings, paragraph count, and document formatting; rewrite skills and experience in place.
- Give each client role its own generation pass. Reserve time for repair, retaining original role evidence and never accepting lower total JD coverage for a higher subset score.
- Validate the original resume, full JD, and returned Word file together before claiming the content meets this baseline. Build success and provider health alone are insufficient.

- Before each uncached full generation, run two Gemini-only JD keyword reviews. Give the second review all previously captured terms, merge unique additions, and pass the combined list to skills and role rewriting. No paid-provider fallback for this keyword step.


## Historical WhatsApp incident reconciliation — 17 October 2026

The 5:28 PM America/Chicago screenshot records the older 98% hard hold after automatic repair. The latest 6 November WhatsApp delivery policy supersedes that behavior; it does not authorize adding the missing CCSP, CISM, CRISC, CISA, Canton or SOL terms as candidate experience. The screenshot does not expose the exact score, full JD, original DOCX bytes, generated file or run trace, so the incident cannot be replayed exactly from the available artifact. See `docs/research/whatsapp-resume-acceptance-2026-11-10.md`.


## Owner-approved final exported-DOCX Gemini review — 3 November 2026

For every complete resume DOCX export, compare the actual exported text with the original JD and send Gemini the exact first instruction **“Give me an ATS score”**. Record the returned score plus missing/weak terms as diagnostics only. Apply only gaps supported by the selected source resume or explicit candidate confirmations; keep the current confirmed-skill project-context guard, and do not require first-person phrasing as the only confirmation form. Never create an employer, project, title, date, action, outcome, metric, credential or contact detail. After each accepted correction, regenerate the DOCX and re-review its extracted text. Limit the loop to at most two correction rounds and the request time budget. Missing keys, invalid responses, incomplete exports or exhausted time are skipped/unavailable, never clean passes. Deterministic exported-byte coverage, ATS parseability and factual evidence remain authoritative.

The current-master source restack is on `feat/final-docx-gemini-restack-confirmed-skills-20261117`, dependent on confirmed-skill PR #431. Exact-head CI and source gates are pending. The protected preview needs the owner-controlled private KOMPAS_VERCEL_API_TOKEN, and an owner-authorized baseline/JD/confirmation DOCX bundle is not available in this run. No personal DOCX was exported and no Gemini model call was made.
