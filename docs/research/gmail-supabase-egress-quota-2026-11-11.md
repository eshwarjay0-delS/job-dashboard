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
