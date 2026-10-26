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
