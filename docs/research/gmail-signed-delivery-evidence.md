# Gmail mobile alerts: signed delivery evidence

## Request and method

Continue the approved Poke-inspired Gmail/mobile update work without sending a real message. Method: source and deployment-configuration audit on 23 October 2026.

## Observed

The webhook's compatibility behavior accepts requests when `WHATSAPP_APP_SECRET` is absent. That keeps the existing WhatsApp bot usable during setup, but it also meant a public status-shaped request could be stored as delivered or read evidence. The Inbox API did not expose whether signed callback verification was configured.

Production environment metadata could not be inspected: the connected Vercel identity returned HTTP 403 for team `qu4ntum-s-projects`. No secret value was read or changed.

## Implemented

- Expose whether WhatsApp signature verification is configured without exposing the secret.
- Ignore provider status payloads when the application secret is absent. Outbound acceptance remains visible and inbound bot compatibility is unchanged.
- Show a precise Inbox-settings notice when delivery/read evidence is waiting for signed webhook setup.
- Correct the stale Gmail product note that described the already deployed feed-recovery fix as review-only.

## Verification and limits

Thirty-nine focused webhook, Inbox-update, UI, phone-verification, Plan & Vision and REA checks passed. TypeScript and the 154-page production build passed. Scoped lint has zero errors and one pre-existing unused-variable warning; the build retains nine existing filesystem-tracing warnings. No Gmail request, WhatsApp message, environment mutation or handset test is performed. A successful deployment will not prove that Meta is subscribed to the production callback or that a handset received/read an alert.

Delivery: PR #44 merged as `9d3aa21e863eb7c51c8022c35d4368f689cb3c6a`. Vercel reported a successful production deployment: <https://vercel.com/qu4ntum-s-projects/job-dashboard/DarYdy6jv4DoRzWNLvVM3CEdrunP>. This establishes release status only; signed production configuration and handset acceptance remain unverified.

## Next

Authorize read-only Vercel team access, verify the required production variable names and scheduler flag, then configure Meta's callback subscription and perform one controlled opted-in handset acceptance.
