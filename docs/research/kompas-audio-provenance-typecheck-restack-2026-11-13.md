# Kompas audio provenance typecheck restack — 13 November 2026

## Why a safe restack was made

PR #270 is a small TypeScript narrowing correction, but GitHub reports its merge state as `dirty` against the current master. Its original base is `23ec076b944519e518060f14e2ce530238e8393a`, while canonical master is `4c01951af59f7d64eecd2b39da32d75c607d9eea`.

The validator file on current master still contained the original narrowing pattern. A new branch was created from the exact current master SHA, leaving PR #270 and its earlier contributor branches untouched:

- Branch: `fix/kompas-audio-provenance-restack-4c01951-20261113`
- Source commit: `ab76922a33a7ffbd7410abfa6998b16fccbcc5df`

## Minimal additive resolution

The code now stores `v.filename` in a local string only after the runtime `typeof` check. The callback and output object use that validated local value. All original validation rules remain unchanged:

- nonempty filename, maximum 180 characters
- no path separators or control characters
- allowed audio extensions only
- 64-character lowercase SHA-256
- finite duration greater than zero and no more than 24 hours
- transcript status restricted to automatic or reviewed

No audio capture, transcript persistence, identity, privacy, account isolation, external sending or production behavior was changed. The original PR branch was not rewritten or force-pushed.

## Verification and release boundary

The replacement must receive fresh exact-head full CI and Kompas baseline results. PR #270 also explicitly requires the separate protected `voice-preview-smoke` and preview gate. The private `KOMPAS_VERCEL_API_TOKEN` is not available to this run, so those gates cannot be bypassed or claimed.

This replacement remains a draft until exact-head CI, baseline, protected voice-preview-smoke, preview and required review conditions pass. No production deployment or Windows hardware acceptance is claimed.
