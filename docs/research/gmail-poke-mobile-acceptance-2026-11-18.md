# Poke-inspired Gmail and mobile acceptance — 18 November 2026

## Owner request and latest corrections

- The owner requested a Poke-inspired product on 5 October 2026 and explicitly clarified “Poke integrations” on 17 October 2026.
- The historical 3–4 connected-account range and four mobile toggles are not permission to exceed the existing limit. The latest owner correction (17 November 2026, 18:08:40Z) keeps the four-account ceiling; no-cap removal remains unapproved. PR #440 must stay DRAFT and its migration must not be applied.
- The owner explicitly requires that mobile navigation must not cover or block the view, even if requested (4 October 2026, 23:32:48Z). The normal-flow menu below the sticky header in PR #435 is an implementation candidate; the exact menu layout/interaction was assistant-proposed, not separately owner-approved.

## Source change

PR [#435](https://github.com/eshwarjay0-delS/job-dashboard/pull/435), branch `fix/gmail-poke-mobile-current-66291-20261116`, received test-only commit `9e041f6306e227d267317a174bb30b623d9db6c6`. It corrects a misleading test title so it states the intended contract: the client renders all accounts returned by the server, while the database account-list function retains primary-first ordering and `LIMIT 4`. No runtime code, migration or production behavior changed.

The branch already includes account+thread identity, per-account sender mutes, receiving-inbox selection, account-scoped reply drafts and selected-From assertions, plus the normal-flow no-cover mobile implementation candidate. PR #435 remains DRAFT.

## Exact-head validation

On exact head `9e041f6306e227d267317a174bb30b623d9db6c6`:
- Kompas baseline workflow 44207751254 — SUCCESS.
- Plan/REA schema workflow 44207751272 — SUCCESS.
- Full CI workflow 44207751371 — SUCCESS. All three source gates are green on this exact head; predecessor results were not reused.

## Read-only production state

A read-only aggregate against the connected MFit Supabase project found:
- One owner with three connected account IDs (maximum three in this snapshot).
- 2,002 cached Gmail threads across those accounts.
- Zero provider thread IDs shared across receiving accounts.
- Three Gmail sync rows, all older than 24 hours; latest sync 10 November 2026 14:44:44 UTC.
- Latest cached-thread update 10 November 2026 14:46:49 UTC.

These counts do not prove fresh sync, successful two-inbox collision handling, correct selected-From behavior or mobile acceptance. The Gmail connector profile read returned no profile data in this run.

## Deployment and acceptance boundary

The canonical production alias `job-dashboard-fawn.vercel.app` remains READY at older SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. The Vercel project reports `live:false`; the latest master deployment was CANCELED by the Ignored Build Step because the commit lacked `[ship]`. The owner-controlled protected-preview token is unavailable to this run. No deployment, preview bypass, project unpause, billing change, Gmail API/OAuth call, inbox mutation, email send, worker activation, notification delivery or device test occurred.

## Required acceptance

1. Full CI is complete on exact PR #435 head; keep the PR DRAFT until the remaining live acceptance gates pass.
2. Run a legitimate protected preview through the owner-controlled access path.
3. Use two authorized inboxes with colliding sender/thread identities; verify account badges, digest opening, per-account mute, selected From, reply-draft isolation and independent reconnect.
4. Verify the mobile menu on a narrow phone and confirm it never covers or blocks the page.
5. Keep the four-account ceiling. Keep proactive worker, scheduler, external notifications and automatic sending disabled.

Do not call source tests, a database aggregate or a READY deployment a live Gmail/mobile acceptance result.
