# Gmail accounts status — synthetic-owner data boundary review (22 November 2026)

## Goal and current status

The owner-approved product goal remains to repair the Gmail accounts page that displayed zero accounts and an unknown WhatsApp state. The prior Plan Journal records a local, unpushed commit `0d8b768b` intended to replace the literal `auth-disabled` bearer with the public Supabase anon key and to let the status route return partial results instead of HTTP 503. That local commit is not present on GitHub and was not inspected directly in this run.

The proposed workaround is **not safe to ship unchanged** until the account-data identity boundary is resolved.

## Source evidence

- `src/app/api/connections/status/route.ts` calls `createClient()`, obtains the application user, then returns `google.accounts` from `loadWorkspaceAccounts(user.id)`. The route currently returns HTTP 503 when profile or connected-services reads fail, apart from known quota errors.
- `src/app/api/gmail/_lib.ts` uses `loadWorkspaceAccounts` for Gmail account discovery and exposes the returned account records to the status response.
- `src/lib/gmailSnapshot.ts` stores/retrieves the saved snapshot under user-ID-keyed R2 objects such as `gmail-snapshot/<userId>/manifest.json`. The returned account records include Google email and enabled-state metadata.
- `src/lib/authDisabled.ts` contains the synthetic skip-login fallback. If the public deployment uses that mode, `createClient()` can return the synthetic owner identity even when the visitor has not authenticated with Supabase.
- `AGENTS.md` says the owner requires skip-login and it must not be turned off without confirmation. Issue [#308](https://github.com/eshwarjay0-delS/job-dashboard/issues/308) separately records that a public synthetic owner must not reach owner-scoped routes without a verified identity boundary.

## Security conclusion

Removing the 503 while allowing the synthetic identity to call `loadWorkspaceAccounts(user.id)` could return the owner's R2-backed Gmail account metadata to an unauthenticated visitor. This is a conditional source-level risk, not a claim that the production environment is currently exposed; production environment values and private R2 objects were not read.

Do not turn off skip-login, do not weaken RLS, do not return owner snapshot data to a synthetic identity, and do not revive local commit `0d8b768b` unchanged. The user instruction in the current task explicitly forbids bypassing access controls.

## Safe unblock

1. Keep the skip-login requirement unchanged.
2. Require a verifiable Supabase user for account-scoped Gmail status and snapshot reads, or implement a narrowly scoped owner-only capability that an anonymous visitor cannot mint.
3. Add negative tests proving anonymous and synthetic-owner requests cannot read account emails or R2 snapshot metadata.
4. Only then remove the broad 503 behavior and verify the page with protected preview and non-private fixtures.

No Gmail API/OAuth call, inbox read, mutation, email send, WhatsApp send or private R2 object read occurred in this review.
