# MarketFit native-client architecture

## Product boundary

The existing Next.js application remains the web client and canonical HTTP API surface.

Native clients are independent front ends:

- Android
- iOS
- Windows
- macOS

They share Supabase identity, MarketFit UUIDs, subscription/device state, dossier evidence, Kompas session history and usage attribution.

## Authentication

Native apps authenticate with Supabase Google OAuth using the platform browser / deep-link return. They retain the Supabase session in platform-secure storage and call MarketFit with a bearer access token.

The Next.js server already supports bearer authentication through `createClientFromRequest()`. Native-facing API routes should use that helper rather than cookie-only `createClient()`.

## Audio pipeline

Native microphone
→ voice activity detection
→ streaming ASR
→ diarization / speaker embeddings
→ speaker-role calibration
→ interviewer-question detector
→ MarketFit retrieval / evidence
→ answer generation
→ session ledger / transcript.

The role classifier should use the first one or two usable turns as calibration evidence, but never permanently lock a role from a weak observation. Low confidence creates a role-confirmation UI.

## Auto Answer

Mobile default: ON.

When ON:
interviewer question detected → answer request immediately.

When OFF:
interviewer question detected → prepare question state → user explicitly requests/reveals answer.

The toggle belongs to the session and should persist as the user's preferred default locally.

## Packaging

Android: APK + AAB.
iOS: IPA via Xcode/TestFlight/App Store.
Windows: signed EXE.
macOS: signed APP + notarized DMG.

Actual signed binaries require the platform signing toolchains and credentials; source integration can proceed before those credentials are available.
