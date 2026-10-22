# Resume Skills → Experience ordering audit

**Date:** 2026-10-22  
**Area:** Resume tailoring / WhatsApp and web shared engine  
**Method:** Source, control-flow, and regression-test analysis

## Owner correction

A resume is not successfully tailored merely because job-description terms appear in a Skills section. Supported terms must also be written into substantive experience bullets that explain the action, context, and purpose/result, spread across the roles where the candidate says the experience occurred. The resume format and identity must remain stable, and the engine must not invent credentials, employers, dates, products, or metrics.

## Defect found

The full-tailor pipeline ran `fillGaps(best)` and only afterward ran `placeRemaining(best)`. `placeRemaining` edits the Skills section, and `applyEdits` recalculates which listed skills each role must demonstrate. Therefore the last deterministic placement step could create new role requirements after the final role-repair pass had already ended.

This explains a specific bad output shape:

1. the draft and first gap-fill rewrite experience;
2. leftover JD terms are appended to Skills;
3. whole-document overlap rises;
4. no later generation pass writes those newly listed terms into client bullets;
5. the quality gate can mark the result incomplete, but the generator has no remaining repair stage to cure it.

## Correction

Run deterministic Skills placement before `fillGaps`. The final experience repair now sees the complete listed-skill set, recalculates role requirements from it, and targets each missing supported term in the relevant client pass. Existing acceptance rules still reject a role repair that removes a previously covered requirement. Certifications remain excluded, and the model prompt continues to state that the JD is a target rather than evidence.

## Verification boundary

The regression pins pipeline order, and the broader resume tests verify per-role completion, non-regressing repairs, candidate-confirmation evidence, certification exclusion, and exported-document keyword accounting. These tests prove control flow and invariants only. They do not prove a live 98% match, provider quality, or a successful WhatsApp delivery; those require a fresh authenticated end-to-end run and inspection of the downloaded DOCX.
