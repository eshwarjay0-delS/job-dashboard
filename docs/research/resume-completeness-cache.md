# Resume completeness and cache audit — 20 October 2026

Owner request: substantive experience points across relevant roles, not keyword presence alone. Continue approved fixes without weakening acceptance checks. Preserve the later recorded 95% delivery floor.

The current quality classifier permitted `partial: true` to receive `coverage_met` at 98–100% keyword overlap. The final tailor passes unfinished role rewrites and insufficient experience evidence into this flag even when all providers returned. Such results could therefore enter the completed-result cache and be reused instead of repaired.

The regression fails before the change at 98%. The fix requires a non-partial rewrite for completed status. Partial results above the delivery floor retain `delivered_with_gaps`; the delivery threshold is unchanged. Completed-cache generation advances from 14 to 15 so earlier classifications are not reused. Source resumes and saved files are not deleted.

52 tests passed: quality, repair, formatting, structure, REA register and provider-lane/cache-contract checks. TypeScript, scoped lint, diff whitespace validation and the full production build passed. Deployment verification is pending. This is a source-level defect and regression, not a reproduction of the exact 17:28 WhatsApp incident or evidence of 98% live resume quality. The full failed-run input/output trace and an authenticated fresh generation remain unavailable. Separate Kompas delivery work is untouched.
