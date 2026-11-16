# WhatsApp JD-only hard hold: failsafe integration restack

**Date:** 16 November 2026  
**Product:** Canonical MarketFit / WhatsApp resume tailoring  
**Status:** Implemented on a current-master review branch; exact-head CI and release gates pending.

## Approved behavior

The 14 November owner-approved rule treats unsupported JD-only experience additions as a hard hold. They are not a shortfall that can be delivered with a disclaimer. The existing WhatsApp policy remains separate: a completed rewrite may be delivered below 95% raw JD overlap when its evidence-supported coverage and quality conditions are met; the 70% raw / 95% supported boundary is unchanged. A blocked rewrite uses the already-selected same-account library resume as the approved failsafe. This does not authorize sending the exact uploaded DOCX unchanged after a provider timeout; that remains a separate decision.

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

Exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA checks are pending on the final restack head. No local tests are claimed because the scheduled container cannot resolve `github.com`; GitHub Actions is the available test runner.

## Historical incident and release limits

This source-level edge is not proven to have caused the 17 October 17:28 Chicago incident. A read-only Library search found several candidate DOCX files created 15–16 October, but the per-run source reference/R2 object version is missing, so none can be proven to be the exact file selected for the 17 October request. The generated output DOCX, request/webhook correlation, Meta message ID and signed delivered/read receipt remain unavailable. A matching Risk & Controls Atlanta/GA onsite contract JD was reopened read-only, but no near-match resume was substituted. The connected iZap WhatsApp business has no linked number, inbound webhook history or proven outbound delivery; no real send or replay was attempted.

The legitimate protected preview still requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`, which is not available to this run. No production deployment, model call, DOCX export, R2 write, production mutation, billing change or external message occurred. Keep PR #411's uploaded-original-after-provider-timeout behavior separate and blocked. Do not claim live WhatsApp delivery or 95–100% resume/JD match from these tests.
