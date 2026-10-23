# Inbox feed record recovery

Date: 23 October 2026. Method: source and artifact analysis.

The approved Gmail/mobile reliability work requires valid inbox updates to remain available after a single damaged saved event. `updateFeed` parsed every event inside one `Promise.all`; one invalid JSON document rejected the entire operation. `deliverInboxUpdates` reads the same feed, so the failure also blocked that user's delivery worker.

The reader now parses and validates each record separately, checks its event ID against its filename, and excludes keys outside the user's event prefix. Invalid content is skipped without deleting source records. Storage reads occur outside the parse catch, so service failures remain retryable errors rather than an apparently empty inbox. The existing 150-record bound remains.

Validation: 21 inbox-update and UI tests passed, including mixed valid/damaged records, missing fields, mismatched IDs, cross-user keys and a storage read failure. TypeScript passed. Test data is synthetic; no Gmail request or WhatsApp message was sent.

Delivery: implemented for review. The earlier default-branch publication rejection remains respected; no production release is claimed. Remaining prerequisites: review/merge, deployment verification, authenticated feed acceptance, and separately the approved mobile template, scheduler and verified handset acceptance.

Release gates: seven additional journal/REA checks passed (28 checks total across these runs), scoped lint passed, and the production build generated all 154 pages. The build retains nine existing filesystem-tracing warnings. This change is stacked on the evidence reconciliation branch from PR #41 so concurrent master work is preserved.
