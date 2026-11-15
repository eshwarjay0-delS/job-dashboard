# Kompas audio provenance filename narrowing restack — 15 November 2026

## Decision

Reapply the small, behavior-preserving TypeScript narrowing correction from PR #356 onto canonical master without modifying either older contributor branch.

## Conflict review

- Canonical master: `17f8dada7ce1acf11064b1129ca4e33764ebb8a3`
- Prior PR #356 base: `4c01951af59f7d64eecd2b39da32d75c607d9eea`
- Master is 28 commits ahead of the prior base.
- `src/lib/kompas-dossier-bots.ts` is byte-identical at both refs (blob `5956d2e19e082e70344ad9b5e8f5b1591c7454ab`).
- New safe branch: `safe/kompas-audio-provenance-master-17f8dada-20261115-0607z`
- Source commit: `0360838b2017d9e656bf9a007c3905b0f93622cc`

## Minimal additive correction

After the runtime `typeof v.filename === "string"` check, store the validated value in a local `filename` string. Use that value for the extension callback and output object. Preserve all existing rules: nonempty filename, 180-character maximum, no path separators/control characters, allowed audio extensions, 64-character lowercase SHA-256, finite positive duration no greater than 24 hours, and transcript status restricted to automatic/reviewed.

No audio capture, transcript persistence, account identity, privacy, external sending or production behavior is changed. PR #270 and #356 are untouched; no force-push was used.

## Validation and release boundary

PR #356's old-head full CI `43400940786`, Kompas baseline `43400940746`, and Plan/REA schema `43400940841` succeeded, but those results do not validate this new head. Fresh exact-head full CI, baseline and Plan/REA are required.

The separate protected `voice-preview-smoke` and preview gate remain required. The owner-controlled private `KOMPAS_VERCEL_API_TOKEN` is unavailable to this run. Do not bypass it. No Windows hardware acceptance or production deployment is claimed.

## First exact-head validation and correction

- The first full CI run on head `ab3bedd1efba6f58c43ecddb166d54a43c1660f6` failed at Lint with `src/lib/kompas-dossier-bots.ts:216:0 — Parsing error: '}' expected` (run `43684834490`). Type-check and later steps were skipped; the baseline and Plan/REA jobs on that same head succeeded.
- Inspection found the re-applied `audio_transcript` validation block was missing its closing brace immediately before `seen.add(id)`. Added only that brace in commit `37370c77647e9157eba88e6b208e008e156d4444`; no validation rule changed.
- All checks must rerun on the new final head. The previous green baseline/Plan-REA and failed full CI are historical for the old head, not proof for the corrected head.
- The protected voice-preview-smoke and preview remain blocked by the unavailable owner-controlled private token. Do not bypass.
