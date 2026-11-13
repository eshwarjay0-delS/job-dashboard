# Supabase Auth egress restriction blocks Gmail notify-rules export — 11 November 2026

## Production evidence

A read-only Vercel production runtime-error query returned one `/api/gmail/notify-rules/export` error group. The latest event was 2026-11-11 20:07:00 UTC on the previous READY deployment `dpl_F6JaLHAps4vNcwMHSdHjrPBXW2Fz`. The exception was `AuthApiError`, HTTP 402, with the exact message that the Supabase Auth service was restricted for `exceed_egress_quota` and the project owner must upgrade the plan or remove spend caps.

A separate read-only Supabase `get_project` call returned project status `ACTIVE_HEALTHY`. This does not contradict the runtime error: the project metadata is healthy while the Auth service reports a quota restriction. Do not generalize this to every database query or claim the entire Supabase project is down.

Gmail persisted-state aggregates remain three account IDs, three sync rows and 2,002 cached threads. Latest sync is 2026-11-10 14:44:44 UTC; no sync occurred in the preceding hour.

## Impact and safe boundary

The observed failure blocks the notify-rules export route's Auth-dependent `listUsers` call. No evidence proves that every Gmail, Calendar, or account-session endpoint is unavailable. No code workaround, alternate credential, service-role substitution, billing change, spend-cap change, manual sync, or email send was attempted.

## Exact unblock requirement

The project owner must decide to upgrade the Supabase plan or remove the spend cap that is restricting Auth egress. Until that owner-level billing decision is made, keep the unattended Gmail update worker disabled and do not claim Poke-style updates are live. After service restoration, recheck the export route and account-scoped sync without sending a real email.

## Sources and limits

- Vercel production runtime-error group for `/api/gmail/notify-rules/export`, last event 20:07 UTC, status 402, code `exceed_egress_quota`.
- Supabase project metadata read returned `ACTIVE_HEALTHY`.
- Read-only Gmail aggregate query: three accounts, three sync rows, 2,002 threads, latest sync 10 Nov 14:44:44 UTC.

No user mailbox contents, credentials, email addresses, or private message bodies are included.


## 12 November 2026 — latest recorded Auth egress evidence (06:53 UTC) <!-- gmail-egress-current-0653z -->

The latest recorded production runtime aggregate for `/api/gmail/notify-rules/export` remains 32 HTTP 402 `exceed_egress_quota` failures across 27 users, latest event `2026-11-12T04:07:07Z`. This is the last available aggregate in this continuation, not a new live re-query at 06:53 UTC. Supabase project metadata may remain healthy while its Auth service is restricted. The owner/project administrator must decide whether to upgrade the plan or remove the applicable spend cap. No billing change, credential swap, alternate-auth workaround, manual export, email send or secret read was attempted.

## 12 November 2026 — live restriction recheck (07:13 UTC) <!-- gmail-egress-402-0713z -->

The latest 24-hour production aggregation has increased to 38 HTTP 402 `exceed_egress_quota` errors across 30 users on `/api/gmail/notify-rules/export`, latest `2026-11-12T07:07:19Z`, on current production deployment `dpl_amu7rE9qzAEG6N7iYjEpnu7BDAwj`. A 30-minute query returned one event. The Supabase Auth service is still restricted; the owner/project administrator must upgrade the plan or remove the spend cap. No billing change, alternate-auth workaround, credential swap, manual export or email send was attempted.

## 13 November 2026 — current-deployment attribution correction

The 12 November 23:02:47 UTC owner-authored correction on [PR #319 comment #6838375980](https://github.com/eshwarjay0-delS/job-dashboard/pull/319#issuecomment-6838375980) supersedes any wording that attributes the earlier Auth 402 events to the new `a247ddf` production deployment. The returned 30-minute events had `lastDeployment` values of the two previous deployments, with last events 22:33–22:37 UTC. The later `a247ddf` deployment's first 30-minute error-level query returned no entries, and no `/api/kompas/account-sessions` request was logged.

Therefore the Supabase Auth restriction is neither confirmed cleared nor confirmed reproducing on `a247ddf`. The current live Gmail/credits status is unverified; no safe read-only API request or owner-device test was made in this continuation. Keep the Gmail worker disabled. Do not attribute the historical 402s to the current deployment, send a real email, change billing or use an alternate identity.
