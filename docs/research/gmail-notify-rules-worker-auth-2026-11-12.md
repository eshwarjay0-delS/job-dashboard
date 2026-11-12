# Gmail notification-rule worker security — 12 November 2026

## Finding

The worker-readable /api/gmail/notify-rules/export endpoint was publicly callable and used Supabase Auth admin listUsers() to enumerate accounts, filter admin metadata, and return sender preferences. This both exposed owner-curated sender rules to unauthenticated callers and caused avoidable Auth egress failures. The mobile delivery worker also fetched user_metadata through getUserById for each event.

## Implemented on the Gmail multi-account digest branch

- Authenticated notify-rules GET/PUT now synchronize per-user rules to an R2 cache. Two pending markers are written before metadata mutation and cleared only after user/admin cache writes succeed. A failed cache commit leaves the marker in place, so delivery/export fails closed rather than using stale rules. Markers older than ten minutes are reclaimed on the next authenticated settings read/save, which rebuilds the cache from the current user metadata.
- The worker delivery path reads the owner-scoped R2 cache instead of Supabase Auth admin.getUserById; missing, malformed or pending cache state blocks the send and records needs-review.
- The worker export endpoint now requires a constant-time CRON_SECRET bearer check, reads only the admin R2 cache, returns sender-only fields with private/no-store caching, and no longer calls Auth listUsers().
- The /api/gmail/updates/tick route checks CRON_SECRET and additionally refuses to run unless GMAIL_UPDATES_SCHEDULER_ENABLED=true. The documented worker remains disabled until an approved scheduler, Meta template and device acceptance exist.
- The Gmail digest shows a visible warning when the preferences are saved but the secure worker cache is still pending.

## Tests

- Store tests cover pending markers, owner-scoped cache reads, admin export, and fail-closed behavior for missing/pending cache.
- Route tests verify unauthenticated export rejection, sender-only export fields, authenticated metadata migration, and pending state after cache commit failure.
- Tick tests verify no collection or delivery occurs while the scheduler flag is false, even with a valid CRON_SECRET.
- Existing mail-update delivery tests now prove sender mutes are read from the owner cache and no Supabase Auth admin lookup is performed.
- Full CI explicitly runs the new worker-auth regression plus mail-updates tests.

## Acceptance limits

No email or WhatsApp message was sent. No real scheduler was enabled, no template or phone was configured, and no handset delivery was tested. This is source and mocked-test evidence only. Production deployment and signed-in multi-account/mobile acceptance remain separate. The protected preview still requires the private KOMPAS_VERCEL_API_TOKEN; no access gate or provider quota was bypassed.
