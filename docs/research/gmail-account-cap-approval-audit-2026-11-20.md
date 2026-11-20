# Gmail four-account ceiling approval audit — 20 November 2026

## Scope

Read-only audit of the claim in the current Gmail product plan that a 19 November owner correction established a hard four-account maximum. No account limit or Gmail behavior was changed.

## Historical direction preserved

The historical owner-vision document `docs/gmail.md`, captured 17 October 2026, records 3–4 connected accounts, four mobile account toggles, per-account identity/From, an inbox digest and Poke-style proactive mail. The 10 November Plan Journal entry also records an up-to-four account direction. The targeted 20 November prior-context search did not recover the underlying direct wording for a hard maximum; preserve those records as historical scope, but do not treat the 3–4 range as proof of a hard cap.

## Exact correction provenance

The accessible prior-context retrieval found:
- A 19 November 16:04 UTC owner message about WhatsApp fallback: only an explicitly selected same-account library resume may be used as the offline fallback; a fresh upload without explicit library selection must not be sent unchanged or silently replaced.
- No direct owner-authored wording in the retrieved context requiring a hard four-account Gmail maximum.
- No direct owner-authored wording approving removal of a four-account Gmail maximum.
- A prior assistant summary incorrectly described a 19 November WhatsApp correction as a Gmail four-account ceiling decision. That is a cross-feature attribution and must not be treated as owner approval.

This was a targeted search of accessible prior conversation context, not proof that every chat was accessible.

## Current source and PR state

- `src/lib/plan-vision.ts` previously stated that a 19 November owner correction set a four-account Gmail ceiling. That attribution was unsupported by the accessible owner message.
- The current server-side `LIMIT 4` remains unchanged.
- PR [#440](https://github.com/eshwarjay0-delS/job-dashboard/pull/440) proposes removing the ceiling and remains DRAFT; owner confirmation is not established.
- The high-level Poke-inspired multi-account/mobile direction remains approved. Detailed per-account Calendar targeting and waiting-on-them radar semantics remain proposed where direct owner wording has not been recovered.
- The Poke proactive worker, scheduler, notifications and sending remain disabled.

## Decision

Preserve the 3–4 account historical target and the existing implementation limit of four for now, but do not describe four as a verified owner-mandated maximum. Do not merge PR #440 or remove the limit until direct owner wording resolves the question. Continue the already-approved account identity, selected-From and mobile-flow work only behind legitimate protected preview, two-inbox collision/selected-From/reconnect and narrow-phone acceptance.

No Gmail API/OAuth request, inbox mutation, account-limit change, email send, scheduler activation or mobile-device test occurred.
