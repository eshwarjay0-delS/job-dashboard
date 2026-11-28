# Contract-board search parity — 21 November 2026

## Request and approval boundary

The owner-approved MarketFit direction is job-first contract discovery, not staffing-firm-first search. The 22 October contract-index implementation history records the intended query behavior: search title, company, location and full description; preserve technical tokens such as `C++`, `C#` and `.NET`; do not require a multi-word query to appear as one literal phrase. The canonical `/api/jobs` route already implements match-any-term semantics for multi-word category queries.

This note records a separate UI inconsistency found during the 21 November master audit. It does not expand portal coverage or alter the crawler.

## Source finding

At master `13542c5e1127ed7c1ccf59e4faa034d0af021fc1`, `src/app/dashboard/contracts/page.tsx` applied the complete normalized query to each field with `String.includes(fullQuery)`. A query such as `Salesforce CPQ developer` therefore missed a listing whose title contained `Salesforce` and description contained `CPQ`, even though the Apply `/api/jobs` search already accepted any matching term.

## Change on PR #488

- Add pure `src/lib/contract-search.ts` with a whitespace-token match-any-term helper.
- Match against title, company, location, description and tags.
- Split only on whitespace so technical punctuation in `C++`, `C#` and `.NET` remains intact.
- Use the helper in the contract board.
- Add focused test groups: multi-word OR semantics, each searchable field, punctuation-sensitive technical tokens, empty/no-match behavior, and whole-token matching for terms of two letters or fewer (so `IT` does not match inside `with` or `site`). The short-token rule is the code from PR #574; that pull request's full lint run failed on unrelated stale files, so only this helper and its test were taken.
- Register the test in `package.json` prebuild and full GitHub CI using Node's TypeScript stripping flag.

The helper does not change ranking, contract classification, clearance filtering, source adapters or stored job rows.

## Exact policy constraints preserved

- Contract crawling is manual/on-demand only. No daily cron is restored.
- Robert Half remains manual-only.
- eTeam remains excluded until a compliant official feed is verified.
- Right-To-Hire / Contract-To-Perm → C2H semantics remain unapproved and untouched.
- No live crawl, portal request, production-row mutation, application submission or external message was performed.

## Validation and release state

- PR: https://github.com/eshwarjay0-delS/job-dashboard/pull/488
- Base: `13542c5e1127ed7c1ccf59e4faa034d0af021fc1`
- Exact head at the first CI trigger: `2965e895b3742f903f5345170021ecc15308f8d3`; this head exposed a test-command/regex correction before validation could be accepted.
- Corrected current head: `3affeb9c84229e3986416192549f28b0223349f6`.
- Kompas baseline: run `44872245403` SUCCESS on the corrected head.
- Full CI: run `44872245342` was IN PROGRESS at the last check; no pass is claimed.
- Local execution was unavailable; exact-head GitHub Actions are the executable test path.
- Plan & Vision, Plan Journal, REA and Completion Watch updates are pending the active Safe Merge Gate's shared-document sequencing. This PR remains DRAFT.
- No protected preview, deployment, active-alias verification or authenticated UI acceptance is claimed.

## Next

Continue: complete the Plan & Vision / Plan Journal / REA update on the final PR head, await full CI, then let Safe Merge Gate review and obtain the legitimate protected preview before any merge or release.
