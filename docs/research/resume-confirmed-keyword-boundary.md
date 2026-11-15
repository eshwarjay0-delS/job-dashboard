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

The blanket-confirmation detector is deliberately narrow. “I have experience with all required skills” and the owner’s “you have experience with all of them evenly” ���q�^