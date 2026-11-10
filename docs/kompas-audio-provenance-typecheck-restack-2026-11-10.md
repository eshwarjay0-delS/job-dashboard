# Kompas audio provenance typecheck restack — 10 November 2026

## Scope

This is a behavior-preserving TypeScript narrowing correction in `src/lib/kompas-dossier-bots.ts`. The original PR #197 and first replacement PR #263 are based on older master revisions and report merge conflicts.

## Conflict handling

A new branch was created from exact current master `23ec076b944519e518060f14e2ce530238e8393a`:

`fix/kompas-audio-provenance-typecheck-restack-20261110b`

Source commit: `da3820678c2c442be32871f92a43d1ae52066954`.

Only the filename type narrowing was reapplied. The branch uses a local `filename` string after validating `v.filename` is a string, avoiding a TypeScript narrowing loss inside the `.some()` callback.

## Preserved validation

- Nonempty filename and maximum length of 180 characters.
- No path separators or control characters.
- Allowed audio extensions remain m4a, mp3, wav, ogg, webm and mp4.
- SHA-256 must remain 64 lowercase hexadecimal characters.
- Duration must remain finite, greater than zero and no more than 24 hours.
- Transcript status remains automatic or reviewed only.

The original #197 and prior #263 branches were not overwritten or force-pushed.

## Verification state

The new source commit has not yet run its own exact-head full CI or preview smoke. A draft PR is the next step. Do not mark the fix ready or merge it until full CI, baseline, voice-preview-smoke, required reviews and mergeability all pass. The shared preview workflow currently fails closed because the private `KOMPAS_VERCEL_API_TOKEN` is not configured. No secret was changed or bypassed.

No audio capture, transcript persistence, account identity, privacy, or production behavior was changed.
