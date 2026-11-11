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


## 10 November 2026 — keep writer and role weaving inside confirmed evidence

A source audit found that the evidence boundary was enforced when building `jdKwsPrompt`, but the default writer instructions still told the model to write every JD term into experience and described the candidate as claiming the full JD skill set. The final mandatory role-weaving pass also used `scoreKws`, which includes JD-only target terms, rather than the evidence-supported `jdKwsPrompt`. The optional Gemini related-term pass could add generated terms without checking the original resume or explicit first-person confirmations.

The writer now treats the JD as target context, not candidate history. It develops only source-supported terms in roles whose original bullets support them; explicit first-person confirmations remain eligible under the existing confirmation parser. Gemini-related additions are filtered against the original resume plus explicit candidate statements before they enter the prompt or score, and the mandatory role-weaving pass uses only the evidence-supported `jdKwsPrompt`. Unsupported requirements remain gaps or separately labelled Job-post terms; they are not represented as work performed.

The change is deliberately split from PR #279's separate WhatsApp external-send allow-list change. It does not change the 6 November 70% delivery-with-gaps or 95% supported-coverage clean-pass policy, and does not authorize a real send. A source-contract regression pins the prompt, generated-term filter and final role-weaving input. This is not a live model generation, a 98% match claim, or employer verification; authenticated baseline/JD/confirmation and exported-DOCX review remain required.

## 10 November 2026 — second prompt-boundary audit

The first evidence-boundary pass restricted the deterministic role-repair helper, but a second source audit found two earlier instructions that could still bias generation:

1. The base src/lib/claude.ts RULES prompt still described the candidate as claiming the entire JD, instructed the model to write each JD term into current and previous roles, and treated adjacent security/IAM practice as transferable across employers. This contradicted the evidence-bound J1_HEADER.
2. The split-draft firstAsk carried the global missing-term list into every part, including each employer's experience prompt. A deterministic post-pass could remove unsupported terms later, but the initial model instruction still encouraged them.

The writer-only branch now aligns RULES with the source-evidence policy, removes cross-role assumptions, routes the global supported-term ask only to the profile/skills part in split mode, and keeps each experience part on its own role plan. Gap-fill wording now says each term was matched to that employer's original bullets and instructs the model to leave unsupported requirements as gaps. A source-contract regression rejects the old blanket prompt and global split-prompt leakage.

Evidence: PR #287 exact head 9fbff8ab4c6d2b9b68a268ddf237bd5e32e1540; commits b7d6d8369f03b152005792552bc9a52b3c78ef07, bc3ed928e003065a8c34abacbc474031a6242649, 9fbff8ab4c6d2b9b68a268ddf237bd5e32e1540; full CI 42920485193 passed 46 steps; Plan/REA 42920485382, Kompas baseline 42920485384, and WhatsApp recovery 42920485412 passed.

Remaining boundary: general first-person confirmations may support the skills section, but a structured employer/project-bound confirmation map is not implemented. The current experience guard conservatively requires same-role original bullet evidence; do not attribute a general skill statement to a historical employer. The 6 Nov no-exception blanket-confirmation policy remains recorded, but it must not silently become an employer-specific claim without a role binding. No authenticated model generation, DOCX export, employer verification or 98% live match is claimed.


## 11 November 2026 — final caller review closure

The 10 Nov owner-authored PR #287 review requested that both the final deterministic weave and the extra generate-then-tailor split pass use each employer's original bullets, with a regression proving a term present only in one role cannot be woven into another. The current branch implements that boundary in all three places: per-role fill, per-role final weave, and per-role extra-pass gap generation. A deterministic post-model guard restores any cross-role JD term that remains in an edited bullet. The direct regression uses Splunk only in role A, Okta only in role B, and unsupported Canton; caller tests pin the final weave and generated gap pass to the role-specific helper.

The owner-authored review thread was answered with exact implementation and test evidence and resolved on 11 Nov 2026 at 02:32 UTC. This is thread resolution, not a formal APPROVED review. Exact code head `4c2870ef42525d98625fff51b18bd537353a53b7` passed full CI `42926787326`, WhatsApp recovery `42926787572`, Plan/REA schema `42926787385` and Kompas baseline `42926787329`. Subsequent Plan/REA documentation commits are on the same PR branch and require their own exact-head revalidation.

Release and quality limits remain: GitHub Vercel status is FAILURE (Account is blocked), the protected preview credential is unavailable, and no authenticated original-resume/JD/confirmation generation or exported-DOCX review has been performed. No 95–100% live match, employer verification, real email/WhatsApp send or production deployment is claimed. The 17 Oct historical WhatsApp output, per-run R2/webhook/Meta correlation and signed delivery/read receipt remain missing.
