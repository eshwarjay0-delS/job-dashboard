# Gmail four-account maximum approval audit — 20 November 2026

## Scope

Read-only approval-provenance reconciliation for the connected-account maximum. The initial 20 November audit correctly refused to treat an assistant summary or the unrelated WhatsApp correction as Gmail approval. A later direct owner comment now resolves the cap.

## Historical direction and earlier uncertainty

The historical owner-vision document `docs/gmail.md`, captured 17 October 2026, records 3–4 connected accounts, four mobile account toggles, per-account identity/From, an inbox digest and Poke-style proactive mail. The 10 November Plan Journal also records an up-to-four direction.

The first targeted 20 November prior-context search did not recover the direct wording for a hard maximum. It also correctly identified that the 19 November owner correction about WhatsApp fallback was unrelated to Gmail. That earlier uncertainty is preserved as history, not treated as the final decision.

## Direct owner clarification — 20 November 2026 07:41:46 UTC

The owner-authored PR #452 comment [7033546581](https://github.com/eshwarjay0-delS/job-dashboard/pull/452#issuecomment-7033546581) explicitly states: **four connected accounts maximum**. The same comment reiterates that the mobile menu belongs in normal document flow below the sticky header, and that the proactive Poke worker, notifications and sending remain disabled.

This direct owner comment supersedes the earlier 20 November conclusion that a hard Gmail maximum had not been recovered. It does not turn the 19 November WhatsApp fallback correction into Gmail approval.

## Current source and PR state

- The current server-side `LIMIT 4` already matches the confirmed maximum and remains unchanged.
- PR [#440](https://github.com/eshwarjay0-delS/job-dashboard/pull/440) proposes removing the ceiling; it remains DRAFT and is not approved.
- PR [#452](https://github.com/eshwarjay0-delS/job-dashboard/pull/452) is a narrow sender/receiving-account identity normalization change. Its exact-head full CI, Kompas baseline and Plan/REA gates passed, but it remains DRAFT on an older base and still needs a current-master restack, legitimate protected preview, two-authorized-inbox collision/selected-From/reconnect acceptance and narrow-phone verification.
- The high-level Poke-inspired multi-account/mobile direction remains approved. Per-account Calendar targeting and exact waiting-on-them radar semantics remain proposed where direct owner wording has not been recovered.
- The Poke proactive worker, scheduler, notifications and sending remain disabled.

## Decision

Treat four connected Gmail accounts as the owner-confirmed maximum. Keep `LIMIT 4`; do not merge PR #440 or remove the limit. Preserve the normal-flow mobile menu below the sticky header. Continue account identity, selected-From and mobile-flow work only behind legitimate protected preview, two-inbox collision/selected-From/reconnect and narrow-phone acceptance. Keep proactive worker, scheduler, notifications and sending disabled.

No Gmail API/OAuth request, inbox mutation, account-limit change, email send, scheduler activation or mobile-device test occurred.
