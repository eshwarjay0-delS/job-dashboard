# WhatsApp library fallback label correction

**Date:** 16 November 2026  
**Repository:** canonical `eshwarjay0-delS/job-dashboard`  
**Scope:** caption-only correction for the already-approved same-account library fallback

## Owner-approved behavior

The owner instruction recovered from the accessible 27 October conversation at `2026-10-27T15:14:08Z` says: “Continue until done; even offline, give the closest matched resume from the user's library as failsafe.”

The fallback must be truthful and visibly distinguish an untouched source document from a tailored output. Its caption must include the exact label:

**Original resume — NOT TAILORED**

The selected file remains bound to the current account/profile. This does not authorize substituting another account's resume.

## Approval boundaries preserved

- This change does not alter resume selection, account checks, source bytes, retry logic, R2 state, Meta calls, or whether any fallback is sent.
- The separate proposal to send an uploaded original unchanged after a provider timeout remains an independent owner-decision gate (PR #411). This branch adds the label only when the `files` argument proves the run source is the selected Files/library record; the upload-origin caption path is left unchanged.
- The 14 November unsupported JD-only claim rule is separate. Rejecting an unsupported generated DOCX must not be described as approval to block the entire WhatsApp conversation when the approved selected library fallback is available. PR #427 remains separately under Safe Merge Gate review.
- The repository's 70% raw-overlap / 95% supported-coverage WhatsApp band remains source behavior; the original owner-authored approval for those exact thresholds was not recovered. The explicit 5 October 90% supported-keyword minimum and 3 November 95–100% supported-target instruction remain the verified ATS expectations.

## Source change

`src/app/api/whatsapp/webhook/route.ts` now accepts a `markNotTailored` caption flag. `sendClosest` passes it only for a Files/library-origin run. The generated caption adds **Original resume — NOT TAILORED** before the existing explanation. No document bytes or delivery conditions change.

## Regression coverage

`scripts/tests/whatsapp-resume-failsafe.test.mjs` now asserts:

1. A selected library fallback includes the exact label.
2. A completed tailored DOCX does not include the fallback label.
3. Existing selected-profile and document-content assertions remain intact.

The source change and tests are on branch `fix/whatsapp-library-fallback-not-tailored-label-20261116`:

- Runtime commit: `9fb4bb3a2bacb83b02c90dbed3521b63313aa74f`
- Test commit: `8c183200c24282d6ab0940c625d599faa9b4ad2a`

## Verification and release status

- Exact-final-head GitHub Actions full CI and WhatsApp recovery are still required.
- Kompas baseline and Plan/REA schema checks are still required after the documentation updates.
- MFit Safe Merge Gate review and a legitimate protected preview are separate gates. The owner-controlled private `KOMPAS_VERCEL_API_TOKEN` is not available to this run; no protected-preview bypass was attempted.
- No production deployment, real WhatsApp message, DOCX generation, R2 write, Meta request, database mutation, historical replay or handset acceptance occurred.
- The 17 October 17:28 Chicago incident remains unverified. Its generated output DOCX, per-run R2 object/version, webhook correlation, Meta message ID and signed delivery/read receipt are still missing.

## Next steps

Require all exact-head workflows to pass, Safe Merge Gate review, legitimate protected preview, reviewed merge, production READY on the canonical alias, and an owner-consented real handset acceptance before calling this shipped. Keep PR #411's uploaded-original-after-timeout decision and PR #427's separate hard-hold review open.
