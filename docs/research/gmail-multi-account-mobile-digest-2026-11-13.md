# Poke-inspired Gmail account identity and mobile navigation — 13 November 2026

## Approval and scope

This is an implementation slice of the owner's 10 November 2026 approved Poke-inspired direction: up to four connected Gmail accounts, account-specific inbox targeting, thread identity as user + receiving account + provider thread ID, no silent cross-account merge, selected-From preservation, and reconnecting only the affected inbox.

The mobile navigation behavior is separately owner-approved by the 4 October, 5 October, and 11 November corrections: the hamburger expands the navigation below the sticky top bar in normal document flow and pushes page content down. It must not cover, dim, or make the page inert.

## Implemented in this branch

- Digest sender mutes are keyed by receiving Gmail account plus sender address. Muting a recruiter in one inbox does not mute the same recruiter in another inbox.
- Digest and waiting-on-them rows use receiving account plus provider thread ID for React identity and radar matching.
- Opening a digest, role-card, or waiting-on-them item selects its receiving inbox before selecting the thread.
- The mobile hamburger expands the existing navigation panel below the sticky top bar. It does not use a scrim, overlay, or page `inert`; outside-pointer and link selection close it, and Escape returns focus to the hamburger.
- The mobile regression is included in the existing build preflight. The digest identity regression is included in the Gmail isolation CI step.

## Explicit exclusions

- No Gmail notification worker, cron, scheduler, CRON_SECRET, Meta template, or outbound delivery behavior.
- No WhatsApp send, email send, OAuth request, Gmail API call, inbox mutation, or account connection write.
- No per-account sync-health card; PR #271 remains proposed rather than separately approved.
- No change to selected-From persistence or reply composition. This slice only ensures that opening an item does not leave the reading pane on a different inbox.
- No real phone, two-inbox, or partial/failed-account acceptance is claimed.

## Tests and source evidence

- `scripts/tests/mail-digest-account-isolation.test.mjs`: account-scoped sender mute, independent toggles, same provider thread ID in two inboxes, and UI open/key wiring.
- `scripts/tests/dashboard-shell.test.mjs`: normal-flow expansion, top-bar ordering, no scrim/inert page, outside click, link close, Escape and focus return.
- `package.json` prebuild includes the dashboard-shell test.
- `scripts/tests/kompas-deploy-build.test.mjs` is updated to assert the exact prebuild command.
- `.github/workflows/ci.yml` runs the digest account-isolation test alongside the existing Gmail selected-sender isolation test.

## Release and acceptance status

Branch: `fix/gmail-digest-account-thread-identity-20261113`, based on canonical master `4c01951af59f7d64eecd2b39da32d75c607d9eea`.

This branch is not merged or deployed. Full exact-head CI, the Kompas baseline gate, and the protected preview gate remain required. The private `KOMPAS_VERCEL_API_TOKEN` must be configured by an authorized repository administrator if the protected preview workflow still fails closed. Do not bypass that gate.

After an approved release, acceptance needs two authorized inboxes with a deliberately colliding provider thread ID and a shared sender: mute one inbox and verify the other remains unaffected; open digest, role-card, and radar items and verify the correct inbox is selected; verify selected-From remains unchanged; reconnect only the partial/failed inbox; then inspect the menu at a narrow phone viewport. Until those checks are performed, this is source-level implementation, not live multi-account or mobile acceptance.
