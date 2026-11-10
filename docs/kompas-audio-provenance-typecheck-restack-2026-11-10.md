# Kompas audio provenance typecheck restack — 10 November 2026

## Scope

This is a behavior-preserving TypeScript narrowing correction in `src/lib/kompas-dossier-bots.ts`. The original PR #197 and first replacement PR #263 were based on older master revisions and reported merge conflicts.

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

The original #197 branch was not modified. Earlier replacement #263 was closed as superseded by #270; no force-push or overwrite was used.

## Verification state

Draft replacement [PR #270](https://github.com/eshwarjay0-delS/job-dashboard/pull/270) was opened from current master. On its first validation head `6267d0b488dfb2944a800df300878df807c34db2`:

- Baseline run `42751331001`: SUCCESS.
- Full CI run `42751331030`: IN PROGRESS at the time of the check.
- Separate `voice-preview-smoke` run `42751330881`: FAILURE.
- Failure reason: `KOMPAS_VERCEL_API_TOKEN` is empty; the resolver fails closed and requires the private credential.
- Vercel preview status was pending.

The secret was not changed, substituted or bypassed. Keep #270 in draft until the final exact head has successful full CI, baseline, voice-preview-smoke, Vercel preview, required reviews and mergeability. No Windows hardware acceptance is claimed.

No audio capture, transcript persistence, account identity, privacy, or production behavior was changed.
