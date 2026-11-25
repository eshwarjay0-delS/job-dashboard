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

- Local isolated execution: Node 22.16.0, **4 tests passed / 0 failed**. The helper and test were copied from the exact PR branch into a temporary test layout; this is not a full repository build.
- GitHub focused workflow: run [45265726287](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/45265726287) **SUCCESS** on exact head `a34bac0558e73fca6a7b08c1dfb593775972a0c6`.
- Full CI: run [45265726249](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/45265726249) **FAILED at Lint** on the unrelated current-master `src/lib/kompasConsistency.ts:1059` `prefer-const` error; type-check, remaining regression gates and build were skipped. Do not weaken the lint or Kompas checks. Exact-head follow-up is required after any branch change.
- Production: canonical master `794e8cfdbd3103409552857806bab89851d5bfcb` is READY deployment `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`; the `job-dashboard-fawn.vercel.app` alias independently resolves to that deployment. PR #561 is not deployed.
- Vercel deployment-detail/runtime endpoints returned 403, but the Vercel deployment card and alias lookup succeeded. No protected preview for this PR was created.
No live crawl, vendor portal access, job submission, external message, production deployment or user-device acceptance occurred in this slice.


## Completion Watch independent master restack — 23 November 2026

This continuation copies the contract-board match-any-term helper and focused tests from PR #565 exact head `7eef052c714108290049c7c74648e9ef3f86f537` onto canonical master `794e8cfdbd3103409552857806bab89851d5bfcb`, avoiding the Kompas #554 dependency. The two historical focused 4/4 runs are not reused as exact-head CI. No local tests, live crawl, job-row mutation, or applications were run.


## Owner correction — short-term `IT` boundary (25 November 2026)

A short query term such as `IT` must match a whole token, not a substring in `with`, `site`, `security`, or `commit`. The helper now applies whole-token matching to terms of two characters or fewer, while preserving punctuation and the existing match-any behavior for longer technical terms. The new regression covers positive title/tag matches and negative substring cases. This is a user correction, not a new public-source finding; no external source was consulted.
