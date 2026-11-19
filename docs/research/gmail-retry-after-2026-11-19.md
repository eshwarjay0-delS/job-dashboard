# Gmail Retry-After long-wait correction — 19 November 2026

## Why this follow-up exists

The active MFit Safe Merge Gate reviewed the Gmail Retry-After work in PR [#454](https://github.com/eshwarjay0-delS/job-dashboard/pull/454) and identified a gap: the parser preserved a very large but valid safe-integer delay, while the Overview decremented the wait with one 1-second timer per second. That could leave a client scan running for an effectively unbounded period.

## Current-master implementation

Draft PR [#458](https://github.com/eshwarjay0-delS/job-dashboard/pull/458), branch `fix/gmail-retry-after-master-bounded-20261119`, based on canonical master `1c6c1622cddf533e8b268a51d0e4350e508a158e`. The older PR #454 branch was not edited; this is a clean restack on current master.

- `gmailRetryDelaySeconds` continues to honor numeric and HTTP-date values and never shortens a valid delay below the existing 15/40/65-second fallback floor.
- A syntactically numeric value beyond JavaScript's safe-integer range becomes a conservative hold sentinel, not the short fallback.
- One abortable browser timer is allowed for waits up to 24 hours.
- Longer or overflow waits stop that inbox scan with a clear no-automatic-retry message. The code does not shorten the server delay or automatically retry early.
- The same page, cursor, selected account, three-pause limit, cached snapshot and other inboxes remain independent.
- The proactive Poke worker, scheduler, notifications and sending remain disabled.

## Source and tests

- Overview: `src/app/dashboard/overview/page.tsx`
- Helper: `src/lib/gmail-retry-after.ts`
- Tests: `scripts/tests/gmail-retry-after.test.mjs`, `scripts/tests/mail-overview.test.mjs`
- CI: `.github/workflows/ci.yml`

Commits: `5b4f9d517da53e124990c8d8e0648a6b1e898d2b`, `603bfc74069f9abb9b5145121075eb3cd8e8882b`, `25913153153010f35e97b71c0ffad7ae7cc3c5de`, `4af6df68cf043a156de356268506beec93ea094f`, `e96e17457a0c3391e6932bdb3abb9ceeffbf9b0c5`.

The added cases cover delta-seconds, HTTP-date, missing/invalid values, shorter-than-fallback values, interleaved account responses, overflow, the 24-hour timer boundary, human-readable long-wait labels, the absence of a per-second loop and abortable cleanup. Exact head 5ceee7fb494425d6d3aaced9c9027ee074d7e4ff passed full CI 44624954359, Plan/REA schema 44624954365 and Kompas baseline 44624954387. The first full-CI attempt 44622620354 failed only on prefer-const for the timer; the fix and listener-cleanup regression are included in the passing head. No local full test run is claimed.

## Next.js guidance and environment limitation

The page is a Client Component. The Next.js v16.3.8 upstream guides for [Server and Client Components](https://github.com/vercel/next.js/blob/v16.3.8/docs/01-app/01-getting-started/05-server-and-client-components.mdx) and [`use client`](https://github.com/vercel/next.js/blob/v16.3.8/docs/01-app/03-api-reference/01-directives/use-client.mdx) were read. The scheduled environment has no repository checkout or installed `node_modules/next/dist/docs`, so the exact installed copy required by AGENTS.md could not be inspected. This limitation is recorded rather than claimed as satisfied.

## Release and acceptance boundary

Canonical master `1c6c1622cddf533e8b268a51d0e4350e508a158e` is independently READY at production deployment `dpl_A8i4LFvu1EqqdKWmLe1SpiT1NUAN`, alias `job-dashboard-fawn.vercel.app`. This deployment does not contain the current branch's Retry-After change. No protected preview or deployment was attempted; Safe Merge Gate review, exact-head full CI/Plan-REA/Kompas baseline, protected preview, production READY + canonical alias, two-inbox collision, selected-From, reconnect and narrow-phone acceptance remain required.

No Gmail API/OAuth request, personal inbox read or mutation, outbound email, Poke scheduler activation or device test occurred. Cached rows are not evidence of fresh sync.


## Exact-head schema correction — 19 November 2026 23:09 UTC

Safe Merge Gate full CI run 44626858570 failed at TypeScript because the new REA record used a state string outside the existing `ReaSession.state` union. The record now uses the existing `Implemented, verification pending` state; only `src/lib/rea-register.ts` was changed by commit `c7c35c8240be5b60112e89458c9116cd6c297b5d`. The prior Plan/REA schema run 44626858546 and Kompas baseline 44626858670 were green on the pre-fix head, but all exact-head checks must rerun after the journal/Plan/Completion Watch documentation updates. This correction changes no Gmail runtime code and does not activate the Poke worker, notifications, scheduler or sending. No inbox access, OAuth call or email send occurred.
