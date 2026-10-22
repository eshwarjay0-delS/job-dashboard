# Gmail mobile delivery evidence — 22 October 2026

## Request and boundary

Continue the approved Poke-inspired multi-account Gmail/mobile updates. The system already reserves each eligible alert before calling WhatsApp and records `sending`, `accepted`, `needs_review`, or `cancelled`, but none of those receipts reached the inbox UI. A user therefore could not tell whether a mobile alert was attempted, held, or accepted by the provider.

## Change

`updateDeliveryReceipts` reads only receipts belonging to the authenticated user's update root and only for valid event hashes already present in that user's feed. It returns a strict status, timestamp, and bounded review reason. Provider message IDs are intentionally omitted. The authenticated updates route includes this evidence after both ordinary reads and manual refreshes. The inbox feed displays conservative wording and never equates provider acceptance with handset delivery.

## Safety and remaining wall

The existing atomic reservation and no-blind-retry behavior are unchanged. This change sends no messages, enables no scheduler, and changes no consent. Actual background delivery still requires the approved Meta template, WhatsApp credentials, `CRON_SECRET`, and a configured scheduler. End-to-end acceptance requires a real connected inbox and verified device plus provider delivery-status webhook evidence.
