# Gmail missing-message sync — 20 October 2026

Request: continue approved Poke-inspired reliable Gmail updates while keeping account isolation, consent and delivery evidence intact.

Method: source analysis and mocked provider regressions, not recovered Poke internals. Source: `src/lib/gmail-updates.ts`; official Gmail errors https://developers.google.com/workspace/gmail/api/guides/handle-errors and message retrieval https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get. Google documents 404 as a resource not found. A message can disappear between list/history retrieval and its metadata request; the old collector treats that as an account-level failure and retains the same history cursor.

Reproduction: the added deletion-race test failed before the change. It supplies one absent and one available message for both initial and incremental sync. Handle only message-metadata 404 as absent; preserve all other errors, and only advance after surviving events are durable. Separate tests assert 401, 403, 429, 500 and 503 retain the original cursor. Existing tests cover history expiration, selected-account isolation and suppression of historical mobile alerts.

Validation: 19 focused tests, TypeScript, scoped lint and full production build passed. Release pending. No live Gmail API calls or real email/WhatsApp sends. This is not proof of end-to-end mobile delivery. Remaining mobile prerequisites: approved template, configured scheduler and authorized connected-account/device acceptance. The original resume failed-run trace and fresh authenticated artifact evaluation remain separate blockers; no quality target claim is made here.
