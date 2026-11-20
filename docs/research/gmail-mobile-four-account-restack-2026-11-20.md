# Gmail multi-account digest and mobile navigation restack — 20 November 2026

## Approval and authoritative corrections

- The owner-approved Poke-inspired multi-account Gmail/mobile direction is documented in `docs/gmail.md` and the existing Gmail Plan & Vision.
- The latest direct owner correction is [PR #452 comment 7033546581](https://github.com/eshwarjay0-delS/job-dashboard/pull/452#issuecomment-7033546581), 20 Nov 2026 07:41:46 UTC: **four connected Gmail accounts maximum**; mobile navigation expands below the sticky header in normal flow; the proactive Poke worker, notifications and sending remain disabled.
- Keep the server-side `identity_list_google_workspace_accounts` RPC `LIMIT 4` in `supabase/migrations/20261004_multi_google_workspace_accounts.sql`. PR #440's no-cap migration remains unapproved. The earlier 13 Nov “3–4 is a target, not a hard cap” wording is superseded by this direct 20 Nov correction.
- The mobile menu requirement is hidden when closed and expands beneath the sticky header, pushing content down without an overlay, scrim, dimming or page inertness.

## Current-master implementation

Draft PR [#474](https://github.com/eshwarjay0-delS/job-dashboard/pull/474), branch `fix/gmail-mobile-four-account-restack-20261120-1325z`, is based on master `2da44026c0ab58ab2966b9371992efaf93427de4`. It restacks the source/test slice from older draft PR #424 without rewriting #424.

- Digest sender mute identity is receiving account + sender address.
- Digest/radar and React identity is receiving account + provider thread ID, so colliding IDs across inboxes do not cross-wire.
- Opening a digest, role-card or waiting-on-them item selects its receiving inbox.
- Saved reply drafts are scoped by user + receiving inbox + thread.
- Mobile navigation uses a normal-flow panel below the sticky top bar; the scrim and page-inert behavior are removed.
- The account test checks that the server RPC enforces the four-account maximum while the client does not silently truncate server-authorized accounts.

## Source commits

- Dashboard shell CSS: `468fd9fa4cbb166c9fd32cc86801ef7779dae9f7`
- Sidebar navigation: `68b16ce4c487d8d16ffe0faf1a96b4170902c5c5`
- Digest UI: `6ecd7bc41a91f8d05f5da05a259217b5c8a8337d`
- Mail page receiving-inbox selection: `714cc103702fff1c3283aa86044d02825f9ed26e`
- Digest identity helpers: `2e090c4bb7c9a7514e85f3a7cf894364693d181c`
- Reply-draft identity: `0c3c293ff604f556a43bf63351627fc746da67b7`
- Dashboard shell regression: `bb64b656ca02b06d556b842cb109b717c409934d`
- Prebuild regression registration: `4fdbac07da448972efb302987b78ea31425ee40e`
- Digest/account tests: `afef5dc6dcec90b9cd4c09fa1e0e50c8fe3a628d`, regex correction `15d66720a8243af61f9f9d63af188f7eae39aa1e`
- Package prebuild: `29ec7e07255604fcc7cdf7aef733106668de176f`
- Full-CI registration: `0c95758876d2b288e079a8e01dd97f2fd7788431`

## Validation and release boundary

- The branch's exact-head full CI, Plan/REA, Kompas baseline and applicable recovery workflow are pending; no predecessor PR #424 result is reused.
- Local execution was unavailable because `git ls-remote` failed DNS resolution for `github.com`. This note does not claim local tests passed.
- Vercel project `job-dashboard` reports `live=false`; the owner-controlled protected-preview credential is unavailable to this run. No preview or production deployment was attempted, and no protection/billing control was bypassed.
- No Gmail API/OAuth request, inbox read/mutation, email send, WhatsApp send, scheduler activation, worker enablement or device test occurred.

## Acceptance still required

1. Exact-head GitHub CI and Safe Merge Gate review.
2. Legitimate protected preview.
3. Two authorized inboxes with a deliberately colliding sender and provider thread ID: independent mute, correct inbox selection and no cross-account draft leakage.
4. Selected-From preservation and reconnect limited to the affected inbox.
5. Narrow-phone check proving the menu pushes content down and never overlays, dims or inerts the page.
6. Separate owner/device acceptance before calling the Gmail/mobile experience live.

## Next

Continue: verify the exact final PR #474 head workflows; repair only focused failures; keep DRAFT until Safe Merge Gate and the legitimate preview/device acceptance gates are complete. Keep the Poke worker, scheduler, notifications and sending disabled.
