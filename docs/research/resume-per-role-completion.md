# Per-role experience completion — 20 October 2026

Method: source and artifact analysis.

Owner baseline: relevant JD terminology must become substantive experience points across the relevant client roles; overall keyword overlap or a skills list alone is not completion.

## Finding

The tailor already measured each role's required JD skills and used the measurement while ranking repair candidates. Final completion, however, checked only whether roles had enough rewritten lines and whether each listed skill appeared somewhere. A document could therefore reach the overall target and enter the completed cache while one relevant role showed only a small fraction of its required experience coverage.

## Change

`experienceCoverageComplete` requires every substantive role with supported requirements to reach the existing 98% target. Roles with no supported requirement are ignored instead of being padded. The final incomplete flag now includes this gate, so the document may still be delivered under the existing policy but cannot be called complete or cached as complete. Cache generation 19 invalidates earlier classifications. This does not authorize adding a tool to an employer that the baseline or an explicit role-specific confirmation does not support.

Validation: 42 focused checks and 101 broader resume, role-selection, library and WhatsApp checks passed; the suites overlap and are not one combined unique count. TypeScript, scoped ESLint and the production build passed. The build retained nine unrelated tracing warnings. Commit `89fb2428dbff53f08d405f0249ff392a44786d37` deployed successfully through Vercel. No real WhatsApp message or email was sent. Exact October 17 input, generated document and server trace remain unavailable for direct reproduction.
