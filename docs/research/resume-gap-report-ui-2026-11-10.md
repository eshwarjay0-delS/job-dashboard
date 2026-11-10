# Resume-to-JD gap report UI — 10 November 2026

## Owner requirement and approval

On 3 November 2026 the owner required every tailoring run to produce its own resume-to-JD gap/risk report, separating missing keywords from missing experience evidence. The owner also approved iterative Gemini-assisted keyword placement and re-analysis toward a 95–100% supported match, while explicitly rejecting fabricated qualifications, unsupported claims and unvalidated 100% reports.

This implementation is a presentation-only slice of that approved requirement. It does not change tailoring prompts, qualification gates, WhatsApp send policy, or the meaning of any score.

## Source audit

Canonical master before this change: `f7f322f242d39b12a0ade7c8d548f6f48eea79b5`.

The tailor already returns separate source fields:

- `coverage`: measured JD-term overlap on the exported DOCX.
- `supported_coverage`: coverage of requirements supported by the original resume or explicit first-person candidate confirmations.
- `quality.missing`: missing terms from the exported-file recount.
- `unsupported_keywords`: requirements not evidenced by the source resume or explicit confirmations.
- `unverified_added_keywords`: unsupported terms detected as new claims in the generated DOCX.
- `role_alignment`: per-role bullet and requirement counts.
- `enrichment_suggested`, `enrichment_placed`, and `enrichment_blocked`: Gemini suggestions and their exported-file presence.
- `ats` and `quality_blockers`: export parseability and review flags.

The result page previously showed keyword-analysis chips but did not display the distinct supported-coverage and unsupported-requirement fields. That hid the difference between a term absent from the document and a requirement absent from candidate evidence.

## Change

- Added `src/lib/resume-gap-report.ts` to normalize a TailorResult into an explicit, non-inferential report.
- Added `src/components/ResumeGapReportPanel.tsx` to show exported-DOCX overlap, evidence-supported coverage, missing document keywords, unsupported requirements, unverified generated claims, per-role evidence counts, Gemini suggestion status, and DOCX parseability.
- Wired the panel to both initial tailoring and regeneration results in `src/app/dashboard/resume/result/page.tsx`.
- The existing interactive missing-keyword list now prefers `quality.missing`, the exact exported-file recount, when that field exists.
- Added focused helper and UI-contract tests under `scripts/tests/resume-gap-report*.test.mjs`.

## Safety boundaries

- Missing keywords are not described as missing experience.
- Unsupported requirements are not inserted or treated as qualifications.
- Gemini suggestions are explicitly labelled advisory.
- The composite match and keyword overlap are not presented as an ATS vendor score or hiring probability.
- This change does not relax the web 95% delivery floor, the WhatsApp 70–94.9% disclosed-gap policy, identity checks, source ownership, or any delivery gate.
- No model generation, real Gmail access, email, WhatsApp send, R2 write, or production data mutation was performed.

## Verification state

- Source implementation and focused regression tests are committed on branch `feat/resume-gap-report-ui-20261110`.
- GitHub Actions exact-head validation is pending PR creation.
- Production deployment and authenticated browser acceptance are pending.
- The production alias was last independently verified at deployment `dpl_7gjdfRFeLjqcPdVC52NkaEatugKA`, SHA `a66c108bff6175149c4aadd882ab11128445b8cc`; master `f7f322f` is ahead of that alias. GitHub reports `build-rate-limit`; no deployment retry or quota bypass is included in this slice.

## Plan & Vision coordination

PR #275 is actively updating `src/lib/plan-vision-journal.ts` and `src/lib/plan-vision.ts` for the recovered 17 October WhatsApp source and current acceptance blockers. To avoid overwriting or conflicting with that in-flight evidence work, this slice adds this dedicated research record and defers the journal/plan append until PR #275 is reconciled. The exact follow-up is to add this UI slice's commit, tests and deployment state to the canonical Plan & Vision journal after the active docs branch is merged or safely restacked.

## Next steps

1. Open a reviewable PR and wait for exact-head helper, UI-contract, full CI and baseline checks.
2. Review the rendered result page on a verified preview when Vercel capacity permits.
3. Merge only after exact-head checks and review; then verify a READY production deployment and canonical alias.
4. Confirm the report against an authorized real resume/JD/confirmation bundle. Do not call a unit test or UI render a 95–100% live resume match.
5. Reconcile the Plan & Vision journal after PR #275 so neither branch loses the other's evidence.
