# WhatsApp inbox-alert delivery status

Request: continue the approved Poke-inspired multi-account Gmail and mobile update work (22 October 2026).

## Source audit

The update worker reserved each Gmail event before sending and stored accepted, cancelled or needs_review. The WhatsApp webhook verified Meta's request signature, parsed the callback body, then returned success when messages was absent. Meta delivery-status callbacks contain statuses rather than messages, so accepted alerts could never advance to delivered, read or failed in MarketFit.

## Implementation

- After Meta accepts an inbox alert, keep the display-safe event receipt and register the provider message ID under a SHA-256 lookup key. Provider IDs are not written into the user-facing receipt.
- The existing signed webhook consumes at most 20 status callbacks per request. Unknown provider IDs and unknown statuses produce no user-visible mutation.
- Store callback evidence as append-only event markers. Inbox reads select the furthest known state: accepted, failed, delivered, then read. A concurrent or late lower state cannot downgrade a higher state.
- Failure detail is reduced to Meta's numeric code and title, stripped of control characters and capped before display.
- Inbox updates uses separate wording for provider acceptance, linked-device delivery, read and failure.

## Verification

Nineteen focused checks cover consent, account isolation, cursor recovery, no-blind-retry behavior, private provider indexing, unknown callback rejection, monotonic state selection, webhook ordering and UI language. TypeScript passes. Provider calls remain mocked.

## Limits and next action

No real Gmail account was read and no WhatsApp message was sent. This code does not configure an approved Meta template, enable the scheduler, subscribe the production WhatsApp app to status callbacks or prove handset delivery. After deployment, configure those prerequisites and run one controlled opted-in device acceptance, recording accepted, delivered and read independently.

## Release evidence

Commit `538d77d35f4bcaad03e990a74aad6a23612f5c28` reached `master` and Vercel reported a successful deployment. The broader Gmail regression set passed 122 of 122 checks. Local production compilation reached the font-resolution step, where this runner could not resolve Next's Google Font module; the hosted build completed successfully. Live handset delivery remains unverified and is not inferred from either unit tests or deployment success.
