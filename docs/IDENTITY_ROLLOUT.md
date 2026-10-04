# Unified identity rollout

MarketFit uses Supabase Google SSO as the account root.

- Google login is identity-only.
- Gmail and Google Calendar are optional post-login connections.
- A verified mobile number is unique to one MarketFit user and binds WhatsApp identity.
- Browser/mobile/extension usage resolves to the same subscription account and usage ledger.
- Subscriptions allow two active device slots; the browser and paired extension can share a physical-device slot.
- Production auth/device gates stay disabled until the preview branch passes end-to-end verification.
- Preview branch enables REQUIRE_AUTH and DEVICE_ENFORCEMENT_ENABLED for rollout testing.

No credentials or tokens belong in this file.
