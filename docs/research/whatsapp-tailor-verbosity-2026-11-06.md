# WhatsApp tailor: new file, 70% band, fuller bullets

**Date:** 6 November 2026  
**Method:** Source and artifact analysis. No live WhatsApp message. No model call.  
**Base:** `00594c59` (PR #227, desktop sign-in). Kompas logistics (PR #226) were not edited.

## Request

Make the WhatsApp intake → tailor → reply path use the new document or photo, write a more complete resume that still belongs to the candidate, and stop a 95% raw job-post floor from holding a valid complete draft. Do not invent employer facts. Do not add address, visa, relocation, or work authorization unless the source line already says them.

## What the code was doing

1. A Word upload set `session.resumePath`. An image message never did, so the next job description kept the older upload or the library file.
2. Answering "which email" always called `fromLibrary`, even when a fresh upload was already stored.
3. `whatsappResumeRejectionReasons` required raw coverage of at least 95 and a quality status of `coverage_met` or `delivered_with_gaps`. A complete 84.3% draft with 100% supported coverage was held. The skills line still refuses unevidenced terms, so that 95% raw number is not reachable for an honest gap.
4. Full-mode summaries were clamped at 80 words, WhatsApp left the summary locked, and cache generation 23 could replay that thinner draft.

## What changed

- A new `.docx` or a readable PDF becomes the tailor source. A PDF's own lines are written into a Word file and nothing is added. A photo or an unreadable PDF clears the pending upload and the reply says an older resume was not tailored.
- Delivery band, WhatsApp only: supported coverage stays at 95% for a clean pass. Raw job-post overlap from 70% through 94.9% is a clean pass when the draft is otherwise complete. A finished rewrite under 70% is still sent, with the missing terms named in the reply (whatsapp-resume-delivery-failsafe-2026-11-06). If the rewrite fails, times out, or is incomplete, the already-chosen resume is sent instead of a text-only refusal. `TAILOR_DELIVER_WITH_SHORTFALL=0` or `JD_TERMS_ALWAYS_ON_SKILLS=0` restores the strict under-95% clean-pass refusal. The website download gate stays strict: it still repairs twice and withholds a token under 95% raw overlap. Unverified claims do not block the WhatsApp file; they are named in the reply. A fact-changing repair and an expired budget are not waived.
- Full mode may keep a grounded summary up to 140 words and is instructed to keep each bullet's tools, employer, and outcome. Cache generation is 24.
- Salesforce Security Specialist is the representative professional case in `scripts/tests/whatsapp-tailor-verbosity.test.mjs`: a grounded resume must measure at least 70% of that post, and a junk resume must measure under 70%.

## Limits

This does not prove a live model rewrite, a WhatsApp delivery, or a 95–100% match on a private resume. A photo is not transcribed. The 70% figure is the chosen raw-overlap floor for an otherwise complete draft, not an employer ATS score.
