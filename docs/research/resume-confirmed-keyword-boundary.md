# Confirmed-keyword boundary audit

**Date:** 2026-10-22  
**Area:** Shared web and WhatsApp resume tailoring  
**Method:** Source and control-flow analysis

## Owner rules reconciled

- Aim for 95–100% measured JD coverage and use the full JD plus Gemini relational vocabulary.
- Treat skills the candidate explicitly says they possess as factual input, even when an older baseline omitted them.
- Do not fabricate qualifications merely because the employer requests them.
- Develop supported keywords into substantive experience points rather than stopping at Skills.

## Defect

The prompts correctly said “the JD alone is not proof,” but deterministic recovery did not. `injectFor`, `fillGaps`, and `placeRemaining` forced every missing target from the JD/Gemini set. Therefore a named product appearing only in the employer requirements could be inserted into Skills and sent to every role-repair prompt as mandatory experience.

## Correction

The full cleaned target set remains the scoring and model-review set. Forced placement and mandatory role repair now use an evidence-supported subset:

1. exact terms already in the baseline;
2. exact terms in the candidate’s explicit confirmations; or
3. the complete set when the candidate explicitly states that they have experience with all listed requirements.

The blanket-confirmation detector is deliberately narrow. “I have experience with all required skills” and the owner’s “you have experience with all of them evenly” qualify. “Add all keywords,” “spread every keyword,” and “make it 98%” are formatting/scoring instructions, not evidence.

Unsupported target terms remain measured gaps. The model may still translate semantically equivalent baseline work into the JD wording under the existing evidence rules, but deterministic code no longer turns the JD itself into biography.

## Verification boundary

Tests cover positive and negative confirmation language and pin all three forced-repair paths to the evidence-supported set. They do not establish that a live provider will produce 98% coverage or that a real DOCX has been delivered. That requires a fresh authenticated run with the baseline, JD, confirmations, exported file, and role-by-role inspection.

## Owner ruling, 26 Oct 2026: the 90% floor

Two WhatsApp resumes made under the rule above came back at 52% and 28.5% measured coverage (a Senior PeopleSoft Security Analyst post and a Senior Enterprise Network Zero Trust Security Engineer post), and the reply called the held-back terms "cut short". The owner: "I kept repeating that I want this to be a consistent build. Even if something going wrong until then the baseline is serve atleast 90% match."

So the evidence rule above stays for the experience (forced role repair and mandatory bullet placement still use only terms the baseline or the candidate's own words show), and one step is added at the end of every run, `THE FLOOR` in `src/lib/tailor.ts`:

1. every target term still missing, certifications excepted, is written onto the skills line it fits best, in the job post's spelling (`placeInSkills`: shared words, then the kind of skill a line is about, then the line its kind already went to, then the line given least);
2. soft skills ("problem solving", "communication skills") go into a single-paragraph summary as one "Strengths:" sentence;
3. when no AI writer answers at all, the source resume with those placements is still made (`skills_only`), so the floor holds when the providers do not;
4. the reply names every term that came from the job post alone ("Added to your skills from the job post: ..."), so the person can check each one;
5. a resume made earlier for the same job is sent again only while it still shows 90% of the job post's keywords (`src/lib/made-floor.ts`); below that it is made again.

The experience measures (listed skills shown per role, `provenShare`) are taken from the pass before the floor, so a term the floor listed never turns into a demand on the bullets. Verified offline by `scripts/tests/resume-floor.test.mjs`: the real tailor on a real .docx with every provider failing gives 100% on both posts measured on the Word file, every bullet unchanged, skills headings still bold.

Review before shipping (three independent reviewers, 26 Oct 2026) found the first floor would write what is not a skill: a clearance, a rank, a fiscal year, a city, benefits, the equal-opportunity line, a recruiter's name, credential fragments and Gemini-only products. So the floor and the match score now use one set, `floorTerms(jd, targetKeywords(extracted, [], jd))` in `src/lib/keyword-targets.ts`: the post's own terms, written in a sentence about the work, minus credentials, clearances, degrees, ranks, benefits, places and numbers (`isQualificationOrJunk`). Gemini's suggestions remain targets for the writer only. A resume the floor wrote onto is filed as a copy (depth 2), never the base of another job; a skills-only run is not filed; a locked summary is never touched; a run the floor carried is never cached as complete.

## Superseding owner correction — 4 November 2026

The owner supplied two shared incident conversations and requested quality resumes, genuine matching without fake numbers, and twenty-fold testing. This supersedes the October JD-only skills-floor exception above. A label in a WhatsApp caption cannot make an unsupported skill truthful inside a standalone resume.

Implemented:
- Deterministic vocabulary recovery accepts only baseline terms or explicit candidate experience assertions. Editing instructions, questions, negations and blanket confirmations with exceptions do not establish new skills.
- Unsupported JD claims are checked across the actual exported document, including skills and summary. Refinements use the same cleanup. Recovery never exempts a term because it was placed by the floor.
- Provider outage / skills-only results remain incomplete at every overlap score and cannot be cached or automatically filed as completed tailoring.
- Empty supported sets and empty saved-file target sets score zero. Overall overlap is still calculated against the original extracted JD skills; it is not a mandatory-qualification or hiring score.
- Saved-file reuse requires a completed-run evidence-v1 receipt bound to SHA-256 of the exported bytes. Old keyword-stuffed exports cannot bypass the new generator through reuse. Valid existing files are preserved; an unreceipted file triggers fresh tailoring.
- J1 v6 explicitly preserves audit participation versus independent execution and binds metrics to their original action/employer/scope. It asks for natural action/method/purpose bullets rather than unsupported keyword lists. This is a prompt contract, not an independent semantic verifier.

Validation: 20 varied real DOCX outage/export cases: unchanged abf577dc passes 5 and fails 15; repaired source passes 20/20. Cases cover SOC 2, SOX, privacy, agents, threat platforms, PeopleSoft, networks, GCP, cloud, endpoint, SOC, IAM, scripting, AppSec, DevSecOps, GRC, recovery and Azure, with open/locked summary and skills. They assert exported-text scores, no JD-only additions, incomplete outage status, original bullets/numbers, identity, dates, titles and bold headings. This is twenty regression cases, not twenty live model generations. Focused release set: 163/163 pass. Broader resume/channel set: 541 pass, 3 fail; all three reproduce on unchanged master (two older round-trip expectations and one obsolete library source assertion). TypeScript passes. Targeted ESLint has no errors. Local production prebuild passed; Webpack build stopped in unchanged Google Inter font fetching/parsing code. Exact-head hosted CI/build and deployment are pending.

Remaining acceptance: actual authenticated model generation and rendered-output review with the original resume/JD bundles, mandatory-qualification evidence review, and original WhatsApp identity/date incident plus signed delivery. Existing PR202/204 header/footer work remains separate. No real messages sent, no employer records independently verified, no fabricated ATS percentage or full-resolution claim.

### Same-session acceptance refinement

Owner additionally requires every resume to iterate until 95–100% match and low risk. Removed the legacy under-95% and locked/no-skills delivery exemptions. Web now applies the same completion/evidence/coverage gate as WhatsApp, attempts up to two fresh repair runs while its request budget permits, rechecks identity on repair outputs, and returns measured gaps with HTTP422 and no download token before charging or saving if still below target. WhatsApp retains its existing fresh-pass and durable recovery flow. No unbounded paid loop is claimed: absent evidence and provider failures cannot be repaired by inventing qualifications, and deadline exhaustion holds delivery. Risk remains evidence-qualified, not a fabricated numerical probability. Six executable production-route-block checks cover successful repair, unchanged failure, identity mutation, unverified claims, no-retry success and exhausted budget.

Final review found a pre-existing web fact-check fail-open: unreadable source/export or extraction errors returned true. This is corrected to fail closed, and the web fact check is mandatory regardless of the older opt-out switch. Three additional source-executed checks cover missing bytes, extraction failure and valid unchanged facts. First-head preview f087ffde is READY; WhatsApp recovery and baseline CI passed. Its optional voice-preview workflow cannot resolve the preview because KOMPAS_VERCEL_API_TOKEN is absent; the missing secret is not changed or bypassed. The matching fix does not touch voice behavior. Final-head hosted checks remain required before release.


## 10 November regression pin — explicit candidate confirmation

The current implementation separates candidate confirmations from employer requirements in `candidateEvidenceInput`. `confirmedCandidateStatements` accepts first-person experience assertions and rejects editing instructions, questions, negations and JD-only requirement lists. `explicitlyConfirmsAllRequirements` recognizes the owner's explicit statement, “I have experience with all of them evenly,” while rejecting exceptions and formatting requests.

The focused regression now pins both sides: the explicit blanket statement is accepted, while “Add all keywords,” “Make this 98% match,” and a bare required-skills list are not blanket experience evidence. This is a source-level guard, not a live model generation, a 98% match claim, or employer verification. The exported DOCX still needs an authenticated baseline/JD/confirmation review before quality can be accepted.


## 10 November 2026 — close the unverified-claim delivery loophole

A source audit found two contradictions against the existing confirmed-experience boundary:

1. `tailor.ts`'s default writer preferences still said to write every JD term into current/previous experience and that the candidate claimed the full JD skill set, despite `forcedJdKws` and `jdKwsPrompt` already being evidence-bound.
2. The mandatory experience-weaving pass used every `scoreKws` term instead of only `jdKwsPrompt`. The extra Gemini-related pass also admitted new generated terms without checking whether they appeared in the original resume or explicit first-person confirmations.
3. `whatsapp-resume-acceptance.ts` included `unverified_jd_terms` in `WHATSAPP_SHORTFALL_REASONS`. As a result, a draft with an unsupported experience claim could be marked unusable by `acceptableWhatsAppResume` while still being considered sendable by `whatsappRewriteUsable`. A caption saying “confirm this” does not make a false experience claim safe inside the DOCX.

The new draft fix keeps the user's separate labelled `Job-post terms` line intact, but:
- rewrites the default prompt so only source-supported JD terms and explicit first-person confirmations can be written as experience;
- limits mandatory role weaving to `jdKwsPrompt`, with per-role source evidence;
- filters Gemini-related additions against the original resume plus explicit candidate confirmations before they enter the prompt or score; and
- removes `unverified_jd_terms` from the WhatsApp shortfall allow-list, so an unverified claim uses the already-chosen same-account resume fallback rather than sending the generated DOCX.

Regression coverage now checks that unverified claims are not sendable, that the default writer prompt does not turn JD requirements into candidate claims, and that generated related terms are filtered against candidate evidence. Existing 70% WhatsApp delivery-with-gaps policy and 95% supported-coverage clean-pass rule remain unchanged. This is a draft implementation only; no live model call, resume write, WhatsApp send or production release occurred. The Safe Merge Gate requires an explicit owner decision before changing external-send behavior.


## 10 November exact-head CI reconciliation

The first full-CI run for PR #279 (`42775486431`, head `cc7e4ea`) failed two cases in `scripts/tests/whatsapp-resume-failsafe.test.mjs`. Both fixtures contained `unverified_added_keywords: ['supplierninja']` and expected the generated DOCX to be sent, contradicting the new factual-integrity gate. The test-only correction commit `417ec0b` changes the first case to assert that the selected same-account source resume is sent instead of the unsupported draft. The second case now removes the unsupported claim and uses a source-backed rewording, preserving the 6 November rule that a completed low-coverage file with disclosed gaps can still be sent. This does not change the 70% WhatsApp delivery-with-gaps policy or the 95% supported-coverage clean-pass rule.

The updated full CI, baseline and WhatsApp recovery regression must run on the exact new head. PR #279 remains a draft. The Safe Merge Gate requires an explicit owner decision before this external-send behavior change can merge. No live model call, real resume write, WhatsApp send or production release occurred.
