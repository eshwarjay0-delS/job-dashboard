# Candidate confirmation priority — 20 October 2026

Owner request: candidate-confirmed experience must supplement an older baseline and reach Gemini enrichment and role rewriting. Related suggestions do not establish new facts or employer assignments.

Source audit found `candidateInput` placed the entire JD before immediate candidate confirmations. Gemini enrichment separately receives a 12,000-character JD and truncates combined candidate input at 16,000 characters. A longer pasted JD can therefore discard confirmations on both reviews.

The shared candidate-input builder now puts labeled explicit input first, then retains the original submitted text. The downstream input budget, JD context, source-fact rules and role attribution are unchanged. Cache generation 17 supersedes 16 to avoid reusing results built without those confirmations.

Regression uses a long JD and a role-specific confirmation including an explicit exclusion of an earlier employer. It reproduces the old loss on both mocked Gemini calls and verifies that both new calls retain the full confirmation and exclusion. No real provider or messaging call is made. This does not prove live output quality. Confirmations exceeding the existing budget can still be truncated; this fix prevents JD length from taking priority over them.

Build, full regression and deployment checks pending. Fresh authenticated output/download evidence and the exact 17:28 failed-run trace remain unavailable. No Kompas code or separate task was modified.

Validation checkpoint: 62 regression tests passed, including profile/role evidence, both Gemini passes, quality, repair, formatting, structure, provider-lane/cache contracts and REA register. TypeScript, scoped lint, whitespace checks and full production build passed. Deployment verification remains pending.
