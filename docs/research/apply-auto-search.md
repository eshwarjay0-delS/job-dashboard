# Apply initial contract search

Request: continue the approved contract-job search work and ensure users see relevant listings when Apply opens without having to submit a search first.

## Source finding

The existing page loaded a saved query into React state, waited 300 milliseconds, found the form in the DOM and dispatched a synthetic submit event. That made the first request depend on render timing and on which state snapshot handled the event. It also made “one search on open” difficult to prove.

## Change

- Resolve the last saved query, location and remote choice once on mount; use `security engineer` when no usable saved query exists.
- Put those exact values into the visible controls and pass the same object directly into the search function.
- Remove the timer and synthetic DOM submit.
- Retain the request sequence guard, so a slow initial or earlier saved search cannot replace a newer choice.

## Verification and limits

A DOM regression proves one aggregate request and one crawler-index request use the saved query, location and remote choice; it also rejects the old synthetic-submit source path. The existing reverse-order response test proves a stale request cannot replace the newer results. The wider focused set passed 37 Apply, crawler, adapter and journal checks; TypeScript passed and scoped lint retained eight existing warnings with zero errors.

No production account was used, no portal was opened and no application was submitted. Deployment and authenticated visual acceptance remain separate.

## Release evidence

Commit `a0c22c0dcd6ddc0c3914a9ddde8d10fe80b88cc3` reached `master` and Vercel reported a successful deployment. The local production build compiled and generated all 154 pages. Authenticated Apply-page visual acceptance remains open and is not inferred from tests or deployment.
