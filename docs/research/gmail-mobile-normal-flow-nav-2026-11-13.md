# Poke-inspired Gmail/mobile normal-flow navigation — 13 November 2026

## Owner-approved behavior

The 4 Oct, 5 Oct and 11 Nov 2026 owner corrections require the mobile hamburger menu to open below the sticky top bar in normal document flow and push page content down. It must not cover, dim or make the page inert with an overlay or scrim. Account switching and desktop navigation must remain intact.

## Restack scope

Source PR #320 head `f286851903417fdb3126c3e972e12e78da8f30a7` passed full CI `43190228931` and Kompas baseline `43190229393`; protected preview `43190224739` failed closed because the private `KOMPAS_VERCEL_API_TOKEN` was unavailable.

PR #331 head `13380ca6d68bd5bbef4f98770ec7c0160fa689dc` includes the approved menu CSS and UI tests, but its `SidebarNav` changes also alter sign-in/auth-disabled behavior. The new restack intentionally excludes those auth changes. It preserves current master auth logic and ports only:
- normal-flow responsive CSS for the navigation panel;
- removal of the scrim and page `inert` behavior;
- outside-pointer and link-selection close;
- Escape close with focus returned to the hamburger;
- a single unique navigation target on the outer panel;
- a source regression in `dashboard-shell.test.mjs`, included in the existing prebuild gate.

## Multi-account boundary

Current master already has the selected-From/per-inbox thread-isolation regression. It passed full CI `43350476035`, step 41, on the current WhatsApp restack. This is source-level mocked coverage only. Read-only production state is 3 account IDs, 2,002 cached threads and 3 sync rows across 3 connected accounts; it does not prove two-inbox send/reconnect behavior. Supabase egress HTTP 402 `exceed_egress_quota` still blocks live Gmail routes. The per-account sync-health card PR #271 remains proposed, not separately approved. The unattended update worker remains disabled pending an external scheduler, `CRON_SECRET`, an approved Meta template and explicit enablement.

## Current state and acceptance

New branch `fix/gmail-mobile-normal-flow-nav-current-master-20261113` is based on PR #345 head `3390272c63e81c7879375625b172f1ac0c254402`. It is not deployed. Require exact-head full CI, Kompas baseline, WhatsApp recovery and protected preview. Then verify the actual narrow-mobile viewport and two authorized inboxes (one healthy, one partial/failed), including selected From, account/thread identity and affected-inbox-only reconnect.

No real phone/browser acceptance, Gmail API call, OAuth request, inbox mutation, email send, WhatsApp send or production deployment occurred.
