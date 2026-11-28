# MFit Completion Watch — run 26

Updated: 2026-11-28T03:06:00Z

## Source and release reconciliation

- Canonical master was read at `bf9a0d41855f35f26d341bc31e88c8033b15dc13`.
- Production alias `job-dashboard-fawn.vercel.app` independently resolves to READY production deployment `dpl_E3LVFzdJKmXSiJLA25cmTTpdWUHy`, exact runtime SHA `593dff29044a4ec57284d7829ab951c2d499f193`. The production alias is not at the newest master.
- Recent documentation-only commits were canceled by Vercel's ignored build step. No production deployment was attempted or needed for this documentation-only run.
- Production Kompas runtime-error aggregation for the last 24 hours returned no errors on the selected answer/speech/section/desktop-handoff/dossier/credits routes. A 30-minute warning/error query for `kompas` returned no logs. This is telemetry absence, not a functional acceptance result.

## Continue: Gmail account-switch local-snapshot isolation

Source review at current master found a separate race in `src/lib/use-gmail-data.ts`:

- `refreshGmailDataForCurrentAccount()` awaits `snapshotKey()`, then reads the localStorage snapshot and publishes it to the current listeners without checking the account generation or re-reading the active user key.
- `resetGmailDataForAccountSwitch()` increments `generation`, clears `shared`/`inflight`, and publishes `EMPTY`.
- If A's `snapshotKey()` is delayed until after a switch to B, A can still publish its user-keyed local snapshot to B's current listeners. `loadShared(false)` runs afterward; its network result guard does not undo the stale snapshot publication.
- Existing `mail-digest-account-isolation.test.mjs` tests a delayed A network load via `loadShared`, but does not exercise the separate `refreshGmailDataForCurrentAccount()` pre-network snapshot-restore path.

This is a source-derived privacy-risk candidate, **not** a reproduced browser incident. Issue #623 records the finding and exact test/fix acceptance criteria. The code fix and behavioral deferred-`getSession()` test remain pending.

## WhatsApp incident: 17 Oct 2026, 17:28 Chicago

A new read-only iZap check of the currently connected business scope found:

- no WhatsApp number linked;
- connection status `connected=false`, registration disconnected, no inbound/outbound activity proven in this scope;
- search for `resume` on 17 Oct 2026 in America/Chicago returned zero results.

The current iZap business is **not established as the incident business**. These results do not prove the historical delivery did not occur. Still missing: correct authorized business/phone, original input/output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound ID, signed delivery/read receipt or failure, and source-fact reconciliation. No replay/send/media download or database/R2 mutation occurred.

**Live source safeguard verified:** production SHA `593dff29044a4ec57284d7829ab951c2d499f193` and current master `bf9a0d4` contain `explicitlySelectedSameAccountLibraryResume` plus `sendSelectedOriginal`. The fallback requires durable explicit-selection proof, depth 0, the verified user's Files root/path, a DOCX and profile-email match; the route has no `sendClosest` call. This confirms source guardrails are live, not the historical send or current real delivery.


## Other approved backlog and gates

- **PR #554 (Kompas S5/current-resume + first-press Listening hold):** latest head `4fafd56663bb5ddce064dcebea8802d758bb8259`; full CI, baseline, cross-device, Plan/REA and Windows gates previously SUCCESS. GitHub requires an independent authorized reviewer; the connected owner identity cannot self-approve. Keep unmerged.
- **PR #566 (two-line JD + named-resume parser):** focused WhatsApp recovery 133/133 and Plan/REA 15/15 at `9465113780c59020cfdaf5e041d42dd4e93f93f8`; full CI is blocked by its stacked base on #554. Direct owner approval wording was not recovered in scoped prior-context search; keep the parser gated.
- **PR #617 (contract crawler server-side location/remote filters):** exact head `d3b4d899249e0b4cca282dedecf05f0fe8b354c2` now has full CI `46088479438`, baseline `46088479463`, Plan/REA `46088479513`, manual-only `46088479424`, freshness/classification `46088479447` and confirmed-skill `46088479478` all SUCCESS. Still stale/non-mergeable. Current tests are source-text assertions; behavioral query-builder composition (location AND tokens, remote-only, missing-location and scan-cap/underfill) is missing, as are protected preview, API smoke and live crawl.
- **PR #620 (Kompas level personalities):** exact head `5017bda1a273ed8c23db5da8a1ccd1ad627b0df7` has four green gates. Direct approval was not recovered. Source review also found ordinary paraphrases such as “supported a customer through a Saviynt rollout” and “helped a client with a Sentinel deployment” may evade its unsupported-experience regex. Keep unmerged/unshipped; do not invent personal customer history.
- **PR #614 Brain/Feedback:** no direct owner approval recovered; keep unmerged/unshipped.
- **#619 live-session/capture:** merged no-ship; no duplicate voice work. The separate Kompas Continuous Voice Delivery automation is disabled.

## Exact execution wall

- Vercel Sandbox creation was rejected with HTTP 402 `payment_required`: Hobby Snapshot Storage usage limit. No sandbox was created; do not change billing or retry blindly.
- Container has no canonical checkout, no Vercel CLI, and `git ls-remote` fails DNS resolution for `github.com`.
- Installed Next.js 16.3.8 docs under `node_modules/next/dist/docs` are absent, as required by `AGENTS.md` before source edits.
- Protected preview credential `KOMPAS_VERCEL_API_TOKEN` and owner-authenticated device/bundle evidence are unavailable.

No runtime code, tests, build, deployment, model call, Gmail/OAuth, WhatsApp send/replay, crawler, DOCX, R2/DB write, or device action occurred.

## Next

Continue: implement the account-generation/current-user guard for the Gmail local snapshot restore and add a deferred A→B behavioral regression **only after** a compliant canonical checkout with dependencies and installed Next.js guide is available. Then run focused tests, full CI, review and protected preview. In parallel, preserve the #554 independent-review gate and the #566/#617 approval/preview dependencies; recover the correct WhatsApp incident business/provider evidence without sending or replaying.
