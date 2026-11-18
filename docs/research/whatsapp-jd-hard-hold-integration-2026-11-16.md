# WhatsApp JD-only hard hold: failsafe integration restack

**Date:** 16 November 2026  
**Product:** Canonical MarketFit / WhatsApp resume tailoring  
**Status:** Proposed source behavior on a current-master review branch; exact owner approval, fallback label, protected preview and release gates pending.

## Owner-approved baseline and proposed hard-hold

The 14 Nov owner-authored rule says honest coverage gaps may be disclosed, but unsupported experience claims must never pass the delivery gate and unverified_jd_terms must not be treated as an acceptable shortfall. A separate 16 Nov owner instruction requires explicit Eshwar approval of the exact behavior that blocks the entire WhatsApp delivery for unverified/unsupported JD-only terms. Accessible owner-authored history does not contain that exact approval. Therefore the whole-delivery hard-hold implementation in this PR is proposed and unapproved; keep PR #427 DRAFT and do not merge or deploy it until exact approval and the legitimate protected preview are recorded.

The 27 Oct owner instruction explicitly approves the closest-matched resume from the same account's library as the offline failsafe. It does not authorize sending the uploaded original after a provider timeout. The Safe Merge Gate review #5915152506 found the current fallback caption and tests do not explicitly enforce Original resume — NOT TAILORED; that label and assertion remain pending.

ATS target provenance is separate: the 5 Oct owner minimum is at least 90% supported keywords; the 3 Nov owner target is 95–100% coverage of genuinely supported JD requirements. The 98% default was assistant wording, not an explicit user target. No owner-authored 6 Nov 70%/95% threshold decision or supersession was recovered; the 70/95 WhatsApp threshold remains repository-recorded/unverified, not approved policy. No live 95–100% match is claimed.

## Source correction

The prior PR #426 source change removes `unverified_jd_terms` from `WHATSAPP_SHORTFALL_REASONS` and makes `whatsappRewriteUsable()` reject both:
- a non-empty `unverified_added_keywords` list; and
- a cached/legacy result with an empty or absent detail list but `quality_blockers: ["unverified_jd_terms"]`.

The hard-hold reason is no longer counted as a delivered shortfall. Role-evidence gaps and honest coverage shortfalls remain separately governed by the existing policy.

## Exact-head failure diagnosis

On prior PR #426 head `4cc711d68a5b8c43002bcb251d149fc4db8463ba`, full CI run `43795909634` passed lint, type-check and 53 of 55 tests in the WhatsApp selected-email/duplicate-job suite. Two tests failed in `scripts/tests/whatsapp-resume-failsafe.test.mjs` (tests 43 and 45).

Both fixtures inherited `unverified_added_keywords: ["supplierninja"]`, but the old assertions expected the generated file containing that unsupported term to be delivered. The updated predicate correctly rejected that rewrite and selected the already-chosen same-account library resume. The failure was an outdated integration expectation, not evidence that the hard-hold source code should be relaxed.

## Current-master restack

Branch: `fix/whatsapp-jd-hard-hold-current-master-20261116`, based on canonical master `11f14891cfc07ba706043c78d1c9b7432d92aec0`.

The restack:
- carries the fail-closed acceptance predicate and its two source-executed unit regressions;
- changes the two stale webhook integration cases to require the selected same-account library resume when an unsupported JD-only term is present, including when a role-evidence-gap shortfall would otherwise be allowed;
- adds a webhook integration case for the blocker-only cached shape; and
- changes the slow-success fixture to a rephrase of facts already present in its synthetic source resume, rather than inventing SailPoint/CyberArk experience.

Code/test commits:
- `6b5995e41d4b5adc21433de85007b8019357f580`
- `1d9ee1fdd6bbeccc886f9527d227c4911eeb1ff5`
- `1fb0bd284ae1dd4559c12feb3c500f4bebc5ce36`

PR #427 was opened DRAFT. Exact pre-docs-finalization head `a3af7b361333ee4b4fead8629b673620091a8428` passed full CI `43803798646` (43 steps), WhatsApp recovery `43803798682`, Kompas baseline `43803798631` and Plan/REA schema `43803798644`. The documentation-only finalization commit must rerun these checks on its new exact head. No local tests are claimed because the scheduled container cannot resolve `github.com`; GitHub Actions is the available test runner.

## Historical incident and release limits

This source-level edge is not proven to have caused the 17 October 17:28 Chicago incident. A read-only Library search found several candidate DOCX files created 15–16 October, but the per-run source reference/R2 object version is missing, so none can be proven to be the exact file selected for the 17 October request. The generated output DOCX, request/webhook correlation, Meta message ID and signed delivered/read receipt remain unavailable. A matching Risk & Controls Atlanta/GA onsite contract JD was reopened read-only, but no near-match resume was substituted. The connected iZap WhatsApp business has no linked number, inbound webhook history or proven outbound delivery; no real send or replay was attempted.

The legitimate protected preview still requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`, which is not available to this run. No production deployment, model call, DOCX export, R2 write, production mutation, billing change or external message occurred. Keep PR #411's uploaded-original-after-provider-timeout behavior separate and blocked. Do not claim live WhatsApp delivery or 95–100% resume/JD match from these tests.


## 16 November approval and acceptance correction

- PR #427 exact head d7189b76087b6f0298481528df083943716eb218 passed full CI 43804784848, WhatsApp recovery 43804784902, Kompas baseline 43804784882 and Plan/REA 43804784926. These validate source/tests only, not owner approval or release. Documentation-only commits have since changed the branch head; all four workflows must rerun on the new exact head.
- The exact-head Vercel preview lookup returned zero deployments. The protected preview requires the owner-controlled private KOMPAS_VERCEL_API_TOKEN, which is unavailable to this run. Keep DRAFT.
- The Safe Merge Gate review found the fallback label and test assertion missing. No code edit was made for that label because the local checkout and AGENTS-required Next.js guide are unavailable in this environment.
- Read-only production Supabase aggregates: seven WhatsApp connected-service entries are disconnected; three Gmail sync rows are all stale since 10 Nov 14:44 UTC; 2,002 cached threads; 14,566 crawler jobs, 12,407 active across 21 portals; 15 active Kompas sessions, seven tombstones and 28 artifacts. No user IDs, email addresses, message bodies or resume content were selected.
- The separate iZap business connector is disconnected and returned zero aggregate messages on 17 Oct. It is not the MFit Meta webhook and cannot establish whether the historical event was sent or delivered.
- The exact 17 Oct generated output DOCX, per-run R2 object/version, request/webhook correlation, Meta message ID and signed delivery/read receipt remain missing. No replay, real send, model call, DOCX export, R2 write or production mutation occurred.
- Canonical master is 11f14891cfc07ba706043c78d1c9b7432d92aec0; production alias remains READY at b94e1629c544048d84a2b048ae83b21b612ab9dd. The merged Plan & Vision data from PR #425 is not live because the normal deployment was canceled by the existing [ship] guard.
