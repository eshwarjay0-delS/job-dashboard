# Resume profile gap-fill acceptance — 12 November 2026

## Why this slice was isolated

The production WhatsApp tailoring error aggregation was rechecked on 12 November 2026. The 24-hour window contains 10 tailoring quality-gate rejections across 9 users; the latest is 11 November 22:16:15 UTC on older deployment `dpl_5ipmErFiEhTsp5tEupta39o8EA1K`. The last 30-minute window has no grouped WhatsApp errors. The observed rejections include 100% literal and supported keyword coverage while the draft is still `partial`, `incomplete`, and `needs_review`; blocker codes include `draft_parts_missing`, `quality_incomplete`, `quality_not_deliverable`, `role_evidence_gaps`, and/or `roles_unrewritten`.

This confirms that keyword coverage alone is not a deliverability result. It does not prove that one source defect caused every rejected request.

## Source-level defect addressed

In `src/lib/tailor.ts`, the initial split-draft profile part accepted requested skills, summary, or headline content. Two later repair paths used only `e.skills?.length` to decide whether a profile repair was useful. The profile-repair queue was also gated on the skills section being enabled, and accepted profile repairs merged only the skills array.

Consequences:

- A valid summary-only or headline-only repair could be discarded as empty.
- A summary/headline-only profile could not be queued when the skills section was disabled.
- Even when a repair was accepted, its summary or headline could be dropped while the skills array was merged.
- The partial state could therefore remain incomplete despite a usable requested profile response.

## Change prepared

The isolated branch `fix/resume-profile-gap-fill-only-20261112` adds a shared profile acceptance helper and uses it across the initial draft, normal gap-fill and extra generate-then-tailor repair paths.

- Queue a profile repair whenever any requested profile section (skills, summary, or headline) is enabled.
- Accept non-empty output for any requested profile section, not only skills.
- Merge non-empty summary and headline fields while preserving existing values and disabled sections.
- Merge skills by their existing paragraph indexes.
- Clear only the profile or role part that was actually accepted.
- Add eight regressions to the existing prebuild resume guard suite.

This is deliberately separated from the broader confirmed-skill and role-evidence changes in PR #317. It does not change the owner's 6 November confirmed-skill exception, the 30% role-rewrite threshold, the resume coverage/delivery thresholds, employer/project identity facts, external-send eligibility, WhatsApp retry policy, or any account boundary.

## Verification boundary

Exact-head GitHub Actions on code head `77cd61d6471f1dad43307c96225638613494cee9` passed full CI run `43253868401` (completed 16:07:05 UTC), Kompas baseline `43253868346` (16:00:29 UTC), and WhatsApp recovery regression `43253868317` (16:01:54 UTC). The protected `voice-preview-smoke` gate `43253868304` FAILED at `Resolve READY exact-head preview from the pinned Vercel project`; the private `KOMPAS_VERCEL_API_TOKEN` is not available to this run. This proves the source gates on that code head, not a protected preview or deployment. A documentation-only follow-up commit changes the PR head and requires fresh exact-head checks. The local container could not resolve GitHub DNS for a clone, so no local execution is claimed. The tests are synthetic helper/source regressions, not an authenticated model run or a real DOCX review.

Still required before release:

1. Exact-head full CI, Kompas baseline, WhatsApp recovery regression, and the protected preview gate.
2. Review an actual owner-authorized exported DOCX for role coverage, factual boundaries, readable formatting, and the approved final-document ATS review.
3. Separate production deployment/alias verification.
4. Separate real WhatsApp delivery evidence. Do not replay the 17 October incident without the generated output DOCX, per-run R2 key, webhook/request correlation, Meta message ID, and signed delivery/read receipt.

The canonical Plan & Vision / REA restack is already active in PR #319. This branch adds this focused research note without creating a competing edit to the journal or REA source. The next documentation continuation should fold the branch's exact commit and CI evidence into that active restack after coordination.

No live model call, DOCX write, resume-library write, R2 mutation, email, WhatsApp send, manual crawler run, production database mutation, billing change, secret access, or device acceptance occurred in this slice.


## 13 November 2026 — current-master restack

The approved profile-part acceptance change was restacked from PR #325 onto canonical master `4c01951af59f7d64eecd2b39da32d75c607d9eea` as branch `fix/resume-profile-gap-fill-current-master-4c019-20261113`. The current master had no intervening edits in `src/lib/tailor.ts` or `scripts/tests/resume-guards.test.mjs`; the restack preserves the original four-file scope and does not include WhatsApp storage/CAS, confirmed-skill cross-role policy, identity checks, delivery thresholds, or external-send changes.

The latest MFit Safe Merge Gate production review (13 Nov 2026, 07:23 UTC) found two rejected WhatsApp drafts in the 24-hour aggregation, latest 12 Nov 18:18:32 UTC. Both had 100% raw and supported keyword coverage but remained `partial`, `incomplete` and `needs_review`; blockers included `draft_parts_missing`, `quality_incomplete`, `quality_not_deliverable` and `roles_unrewritten`. This change addresses only requested profile-part acceptance/merge. It does not claim to fix role rewriting or establish that one defect caused every rejection.

The source implementation was previously tested on PR #325 head `513be212e693d45ae7fb55ab139618caae6c58f6`: full CI `43292578201`, Kompas baseline `43292578119`, and WhatsApp recovery `43292578125` all passed. Those runs are evidence for the original head only; fresh exact-head checks are required on this restack. No local test execution is claimed.

Current production remains READY on `dpl_BJvUK2kwPCUE6oCLcmTWPa5Dm25d`, exact SHA `4c01951af59f7d64eecd2b39da32d75c607d9eea`, with both canonical aliases verified. This branch is not deployed. The protected preview gate still requires the private `KOMPAS_VERCEL_API_TOKEN`; do not bypass it.

The latest 12 Nov Library recheck did not resolve the exact 17 Oct source DOCX bytes. The matching JD remains retrievable, but the generated output DOCX, per-run R2/webhook correlation, Meta message ID and signed delivery/read receipt remain unavailable. No historical replay, model call, DOCX write, R2 mutation, real WhatsApp send or email send occurred.
