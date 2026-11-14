# Resume tailoring baseline

Owner requirement, 16 October 2026: target 95–98% measured JD keyword coverage and substantive experience points throughout all relevant client roles. A high displayed score or count of rewritten lines is not acceptance evidence.

- Review every experience point for supported JD terminology, concrete action, and documented purpose or result. Preserve client context and avoid repeated generic bullets.
- Preserve formatting, names, employment dates, role titles, credentials, and factual experience. Missing qualifications require confirmation, not invented work.
- For web downloads, the minimum raw JD-overlap threshold is 95%; the generation target is 98%. Report actual exported-document coverage without score bands or forced improvement.
- WhatsApp has a separate owner-approved delivery policy (6 Nov 2026): a clean 70–94.9% raw job-post result can be sent when supported coverage is at least 95% and the document is complete; a finished readable file below 70% is not a clean pass but may still be sent with the missing terms disclosed. A completed below-target WhatsApp file is not silently labelled as a clean pass or cached as a complete baseline.
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


## Owner-approved final-DOCX Gemini ATS loop — 14 November 2026

The owner-approved 3 November loop asks Gemini exactly **Give me ATS score** after each complete final DOCX export. The review sees the original JD, canonical target terms and text extracted from the actual exported DOCX. Gemini's score and missing/weak terms are diagnostics only; deterministic exported-byte coverage, ATS parseability and factual evidence remain authoritative.

Corrections are restricted to source-resume evidence or explicit first-person confirmations. A confirmed skill may be placed in a relevant existing project across roles only when the original project context fits; no employer, project, action, outcome, date, title, location, contact, metric or credential may be invented. Weak terms may be improved in an existing role only when that role's source/confirmation context supports them. The loop is bounded to at most two correction rounds and the request time budget, with a new DOCX export and Gemini re-review after each accepted correction. Missing keys, invalid responses, incomplete exports and timeouts are reported as skipped/unavailable, not clean passes.

Implementation status, 14 November: the final-DOCX code from stale PR #289 is being restacked on the current evidence-bound confirmed-skill branch fix/resume-confirmed-skill-current-3e710-20261114-run13. Exact-head validation, legitimate protected preview and owner-authorized baseline/JD/confirmation DOCX acceptance remain pending. The protected preview requires an authorized private KOMPAS_VERCEL_API_TOKEN. No personal document, Gemini call, exported DOCX or live 98% match was produced in this run. The 6 November WhatsApp gap-disclosure policy is unchanged.
