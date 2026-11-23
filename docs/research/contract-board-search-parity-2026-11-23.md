# Contract-board search parity — current-master restack (23 November 2026)

## Approval and scope

The approved contract-search direction is job-first discovery. Search the job title, company, location, full description and tags; preserve punctuation-bearing technical terms such as `C++`, `C#` and `.NET`; and interpret multi-word presets as match-any-term rather than requiring a literal phrase. This slice is limited to the existing contract board.

## Source finding and change

Canonical master before this branch: `794e8cfdbd3103409552857806bab89851d5bfcb`.

The contract board at `src/app/dashboard/contracts/page.tsx` applied the full query as one substring per field. A multi-word search could miss a listing whose terms were spread across its title and description. This current-master restack:
- adds pure `src/lib/contract-search.ts` and uses it in the contract board;
- splits query terms only on whitespace, preserving punctuation inside `C++`, `C#`, and `.NET`;
- adds four focused test groups (multi-word OR, field coverage, punctuation, empty/no-match);
- registers the regression in prebuild and full CI;
- adds an independent focused GitHub Actions workflow so this narrow test can run even when unrelated full-CI failures block the shared suite.

## Boundaries

Contract search and crawling remain manual/on-demand. No daily cron, automatic application, portal request, crawler adapter, ranking/classifier change, or production data mutation is included. Robert Half remains manual-only; eTeam is excluded until a compliant official feed is verified. Contract-To-Hire / Right-To-Hire semantics remain unapproved and untouched.

## Verification

Local checkout and test execution are unavailable in this automation environment because GitHub DNS does not resolve. GitHub Actions is the execution path. The PR must remain draft until the exact-head focused workflow passes, full CI is re-evaluated, and normal independent review/protected-preview requirements are satisfied. The current master has unrelated Kompas Listening-hold/lint blockers; a focused pass will not be reported as full-suite or live acceptance.

No live crawl, vendor portal access, job submission, external message, production deployment or user-device acceptance occurred in this slice.
