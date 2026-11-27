# Gmail shared-cache account isolation — 27 November 2026 (run 22)

## Scope
Static review of approved multi-account Gmail/mobile PR #576, preserving four connected accounts maximum and no Poke proactive workers, scheduler, notifications or sending.

## Finding
In PR #576 head `27f096fbb9a687069e18ea389de67b0470682d96`, module globals `shared` and `inflight` are not keyed by Supabase user ID. `useGmailData()` initializes directly from `shared?.data`, and its mount path can short-circuit when `shared` exists without checking `snapshotKey()`. Sidebar `signOut()` calls `forgetGmailData()`, but the `onAuthStateChange` user-ID-change handler updates admin state and posts the auth event without invalidating Gmail caches/generation.

If a session changes from account A to B without the explicit sidebar signOut, B can initially receive A's cached mail; an A-owned in-flight load can also publish to global listeners after the switch. This is a **potential source-level privacy leak**, not a reproduced incident.

A COMMENT review was posted on PR #576 (6083838182). It requests owner-bound shared/inflight caches, cross-user publication rejection, and a regression that switches A→B without calling `forgetGmailData()` and proves no A mail is rendered/published.

## Validation / blockers
The shared lint correction commit `27f096fbb9a687069e18ea389de67b0470682d96` aligns the unmodified utility file to current master exactly (`let`→`const`). Full CI `45944935727` was IN_PROGRESS with 44 steps green at Kompas S1 replay; baseline `45944935730` SUCCESS. No local checkout/dependencies, Next.js 16.3.8 guide, OAuth, two-inbox/phone acceptance, or real Gmail data access.

## Next
Continue: fix owner binding and account-change invalidation with executable A→B regression in a compliant checkout; rerun exact-head CI. Keep PR #576 DRAFT until protected preview and account collision, switching, reconnect, and narrow-phone acceptance. Never expose or send real mail during tests.
