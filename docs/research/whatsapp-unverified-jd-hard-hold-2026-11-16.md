# WhatsApp unsupported JD-only claims remain a hard hold

**Date:** 16 November 2026  
**Product:** Canonical MarketFit / WhatsApp resume tailoring  
**Status:** Implemented on a review branch; exact-head CI, protected preview, deployment and real UX acceptance pending.

## Owner-approved policy

Accessible owner-authored context confirms the 14 November decision: unsupported JD-only experience claims are a hard hold. This is separate from the 6 November WhatsApp shortfall policy: 70% raw job-post overlap is the lower shortfall boundary, and a clean 70–94.9% pass requires at least 95% supported coverage. The 95% strict web gate and 98% evidence target remain distinct. The JD is target context, never proof that the candidate performed a skill.

The 27 October offline request for the closest matched library resume is a separate failsafe. This change does not implement or authorize sending an original resume after a provider timeout.

## Source finding

On canonical master `8ad319d1092fffa7e6a31a4da1b4dc61ac634934`, `src/lib/whatsapp-resume-acceptance.ts` included `unverified_jd_terms` in `WHATSAPP_SHORTFALL_REASONS`. `whatsappRewriteUsable()` rejected a non-empty `unverified_added_keywords` list, but it did not independently reject a cached/legacy result where that detail list was empty while `quality_blockers` still contained `unverified_jd_terms`. Because the reason was allowlisted, that blocker-only shape could pass the usable-rewrite predicate and be treated as a shortfall.

This is a source-level fail-open edge. It is not proof that the 17 October 17:28 Chicago screenshot or any historical request used that shape.

## Narrow correction

- Remove `unverified_jd_terms` from the shortfall allowlist.
- In `whatsappRewriteUsable()`, explicitly reject a non-empty `unverified_added_keywords` list and a `quality_blockers` entry equal to `unverified_jd_terms`, including when the detail list is absent or empty.
- Stop classifying `unverified_jd_terms` as a delivered shortfall.
- Leave the 70% raw-overlap / 95% supported-coverage policy, role-evidence gaps, incomplete-draft rules, identity checks and selected-resume fallback unchanged.

## Regression coverage

Two source-executed cases were added to `scripts/tests/whatsapp-resume-acceptance.test.mjs`:

1. A result containing an unsupported addition and the hard-hold blocker is not accepted, not usable and not delivered as a shortfall.
2. A result with an empty detail list but `quality_blockers: ["unverified_jd_terms"]` is also not usable and not delivered as a shortfall.

Commits:
- Runtime: `40ea21ed7ac667b75296368a11c31aec2bdcb55f`
- Tests: `663a3abc3fa60337d04f771d3d21737718140d33`

## Verification and release boundary

The exact final branch head still requires full CI, WhatsApp recovery, Kompas baseline and Plan/REA schema. MFit Safe Merge Gate review is separate. A legitimate protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`; this run does not have that credential and will not bypass protection.

No production deployment, model call, DOCX generation, R2 write, Meta request, real WhatsApp message, historical replay, database mutation or handset acceptance occurred. Do not claim the correction is live until the reviewed commit is deployed READY on the canonical production alias. Real WhatsApp delivery remains unverified; the connected iZap business currently has no linked WhatsApp number.
