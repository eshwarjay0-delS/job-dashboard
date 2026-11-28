# MFit Completion Watch — run 25

Updated: 2026-11-28T02:00:08.207Z

## Current source and production truth

- Canonical repository: `eshwarjay0-delS/job-dashboard`; default branch `master`.
- Current master at audit start: `997eaa3a4a93028be518ec3098fbd28173b58f37`.
- Production alias `job-dashboard-fawn.vercel.app`: READY deployment `dpl_E3LVFzdJKmXSiJLA25cmTTpdWUHy`, exact runtime SHA `593dff29044a4ec57284d7829ab951c2d499f193`, target production, alias error null.
- GitHub compare confirms master is three commits ahead of production and not behind. The intervening lineage includes PR #618 (`35c1400e`), PR #619 (`dc4f82a`) and the run-24 documentation commit `997eaa3`. PR #619's own instructions explicitly required merge without a ship tag; do not treat that merge as authorization to deploy it by itself.
- PR #461 merged as `53a873d5f10268a579e85a10aa94959546659e1b`; production is a descendant. Its exact head `5820ddf319463a9a6204bc869817206106c7a825` passed full CI 46088696131, Kompas baseline 46088696137, Plan/REA 46088696173 and confirmed-skill 46088696140. Its scope is the WhatsApp upload-hold regression/docs, not a new runtime fallback.

No production deployment was attempted: there is no newly validated, directly approved runtime change in this run.

## WhatsApp — 17 Oct 2026, 17:28 Chicago incident

Current master source review supersedes older Completion Watch wording that said explicit selection proof was absent:

- `src/app/api/whatsapp/webhook/route.ts` has `explicitlySelectedSameAccountLibraryResume`. It requires server-carried `explicitSelection === true`, depth zero, a valid profile email, the authenticated user's Files root, absolute and matching paths, a DOCX, an email-scoped relative path with no traversal, and containment under that root.
- `sendSelectedOriginal` re-reads the exact selected bytes, requires the DOCX to contain exactly the selected profile email, and labels the document exactly **Original resume — NOT TAILORED**. The inspected current route contains no `sendClosest` call.
- The acceptance helper keeps unverified JD-only additions out of a tailored deliverable. The original-file fallback is separate and is eligible only for the explicitly selected same-account Files/Library item. No uploaded-original, cross-account, automatic closest-match or silent-substitution path is authorized.

This establishes current source behavior, not the outcome of the historical send. The 17 Oct event remains **unverified**. Missing evidence: the exact generated output DOCX; per-run R2 object/version; request/webhook correlation; Meta outbound message ID; and signed delivered/read receipt or failure record. A prior read-only Library search did not surface the incident output, which does not prove it is absent from R2. The previously inspected iZap scope was a disconnected business with no WhatsApp number, so it is not established as the incident business. No replay or real WhatsApp send was performed.

Open follow-ups:
- PR #374 remains DRAFT/non-mergeable on an old base; its protected preview gate is not satisfied.
- PR #411 remains DRAFT/non-mergeable. Its uploaded-original fallback conflicts with the latest explicit selection-only correction and must not be merged.
- PR #591 is closed unmerged; current master has the explicit-selection guard through later reviewed work. Do not revive the stale branch over current source.

## Resume, JD and confirmed experience

Current source review of `src/lib/resume-evidence.ts`, `src/lib/tailor.ts` and `scripts/tests/resume-confirmation-quality.test.mjs` confirms:

- Candidate statements are split from team, colleague, client, organization, vendor and other non-candidate attribution.
- The regression suite includes `I used AWS, and my team used GCP` and passive/third-party attribution variants; only the candidate's supported clause is retained.
- Explicitly confirmed skills can be placed only into relevant existing project bullets across roles. Confirmation does not create an employer, project, action, outcome, title, date, location, contact, metric or credential; JD text is not candidate evidence.

This is source/test evidence, not a live tailored-resume acceptance. No owner-authorized resume/JD/confirmation bundle, model generation or exported DOCX was used in this run. The 95–100% coverage target and 98% evidence target are not measured live results. PR #595 is closed unmerged; do not resurrect its stale branch.

## Poke-inspired Gmail and mobile

The source audit confirms the current production lineage includes the four-account Gmail/mobile slice:

- `GET /api/identity/google-workspace/accounts` requires an authenticated user and returns `maxAccounts: 4`; `canAdd` is true only when the loaded account count is below four.
- `src/lib/googleWorkspace.ts` resolves account data through user-scoped Supabase RPCs; it does not expose stored refresh-token ciphertext to the client.
- `src/lib/use-gmail-data.ts` keys local snapshots by the verified Supabase user ID and clears in-memory mail on account switch/sign-out.
- `src/app/dashboard/sidebar-nav.tsx` and `dashboard-shell.css` place the narrow-screen menu below the sticky header in normal flow, pushing page content down rather than overlaying or dimming it.

The four-account ceiling is authoritative. Proactive Poke workers, scheduler, notifications and automatic sending remain disabled. No Gmail OAuth, inbox read/mutation, email send, two-inbox collision/selected-From/reconnect acceptance or real-phone acceptance occurred. PRs #401, #452 and #454 remain stale DRAFT/non-mergeable work; do not merge them over current master.

## Contract job search and crawler

The existing product direction remains contract-only, clearance-excluded by default, and manual/on-demand crawl only. Robert Half remains manual-only and eTeam remains excluded. No crawl, portal request, database write or application submission occurred.

PR #617 (`d3b4d899249e0b4cca282dedecf05f0fe8b354c2`) proposes server-side location/remote filtering before the bounded snapshot, but is based on stale master `6f3cdcb` and GitHub reports `mergeable=false`. Its six exact-head gates were green in the previous reconciliation; there is still no compliant current-master restack, protected preview or public API smoke. A scoped prior-context search did not recover direct owner wording for this exact server-side filter, so do not treat the PR's own “approved” label as independent approval evidence.

## Kompas and approval boundaries

- PR #619 merged at `dc4f82a` without a ship tag, as its body required. Its live-session/capture behavior is not in the current production SHA.
- PR #620 is open and mergeable at exact head `5017bda1a273ed8c23db5da8a1ccd1ad627b0df7`, based on current master. Full CI 46094744779, Kompas baseline 46094744712, Plan/REA 46094744713 and confirmed-skill 46094744695 all completed SUCCESS.
- However, targeted accessible prior-context retrieval did not recover direct user-authored approval wording for the 27 Nov level-personality behavior. The journal's prior `approved` label and the PR title/body do not independently establish that approval. A source-review comment was added to PR #620 (comment 7232042567); keep it open and do not merge/deploy this behavior until its direct approval source is recovered. This scoped retrieval does not claim that no approval exists in every conversation.
- The Kompas Continuous Voice Delivery automation is disabled. No duplicate voice/caption implementation was started.
- The actual 50-pair same-question Kompas/ChatGPT comparison, independent human scorecards, authenticated Windows/mobile/WhatsApp voice acceptance and latency parity remain open. Synthetic fixtures do not close them.

## Execution limits and exact blockers

The available container has Node.js `v22.16.0`, but no canonical repository checkout, no `node_modules`, and no installed Next.js `16.3.8` route-handler documentation under `node_modules/next/dist/docs`. A direct `git ls-remote` attempt failed because the container could not resolve `github.com`. Therefore this run made no source-code edits and ran no local tests, typecheck or build.

Unblock requirements:
1. For the 17 Oct WhatsApp incident: the correct authorized WhatsApp business/phone scope and read-only provider/R2 evidence linking the exact input/output DOCX, R2 object/version, webhook correlation, Meta message ID and signed delivery/read receipt.
2. For the two-line JD + named-resume parser: direct owner-authored request/approval wording was not recovered in scoped prior-context search; also restore an approved canonical checkout with dependencies and the installed Next.js 16.3.8 docs before route changes.
3. For PR #620: recover the direct owner approval source for this behavior; green CI alone is not approval.
4. For PR #617: recover approval for the exact server-side filter, restack onto current master, and satisfy protected preview plus public API smoke.
5. For Gmail/mobile acceptance: authorized two-inbox test identities and a real phone/browser session; keep all sends and inbox mutations disabled unless separately authorized.

No secrets were read or recorded. No real email/WhatsApp was sent, no Gmail mailbox was read or mutated, no crawler ran, no production database was changed, no model call was made and no user device was claimed as tested.


## Additional source review — Gmail cap and Kompas claim filter

- The four-account ceiling is enforced in the database, not only in the UI: `supabase/migrations/20261004_multi_google_workspace_accounts.sql` counts active accounts in `identity_attach_google_workspace_account` and raises when a fifth new account is added; the list RPC is also limited to four. These RPCs are revoked from public/anon/authenticated and granted to `service_role`. This confirms the cap in source; it does not replace two-inbox/mobile acceptance.
- PR #620's latest green head still has a narrow unsupported-experience regex. A local Node probe using the exact pattern from the PR returned false for `I supported a customer through a Saviynt rollout.` and `I helped a client with a Sentinel deployment.`, while `I worked on a Saviynt incident.` was caught. This is a source-pattern probe, not a repo test or a live model response. Review comment 7232074504 records the false-negative examples. Keep PR #620 unmerged/unshipped; the direct owner-approval gate in comment 7232042567 remains independently blocking.


## Kompas approval provenance correction — 28 November 2026

The separate `docs/research/kompas-level-personalities-2026-11-28.md` note labels a 28 Nov request and add-on as an “Owner task.” Targeted retrieval of accessible prior owner context did not recover direct user-authored wording for the level bands, hedge removal, Houston-specific answer behavior, or a customer/partner story for tools absent from the resume. The PR/research-note description is not independent approval evidence. Keep those behaviors proposed/unapproved; the new personality modules are not connected to the answer route and PR #620 remains open. The “tell a realistic customer story for a tool not on the resume” proposal also conflicts with the Chief Relevance source boundary and must not be implemented as written.

The already-live 27 Nov filler/Houston/hedge behavior is present in production SHA `593dff29044a4ec57284d7829ab951c2d499f193`, but scoped prior-context retrieval did not recover its direct owner approval either. It is already deployed; this run did not roll it back or claim it approved. Do not extend or roll back it without a direct owner decision. PR #618 approval correction comment: 7232103912; PR #620 approval/source-quality comments: 7232042567 and 7232074504.


## Final run-25 handoff and validation status — 2026-11-28T02:07:08.193Z

- The run-25 documentation corrections are committed through `79a1fa3ce6157496e1eae50e7b48a11f54da64e5`. GitHub compare shows current master is 18 commits ahead of production SHA `593dff29044a4ec57284d7829ab951c2d499f193`, with no behind commits. The ahead set includes PR #618 personality modules and PR #619 live-session/capture code, plus documentation; PR #620's answer-route integration is still unmerged. The production alias remains READY at `dpl_E3LVFzdJKmXSiJLA25cmTTpdWUHy` / `593dff`.
- Vercel Git deployments for documentation commits were CANCELED by the project's ignored-build-step; they did not replace the production alias. No manual production deployment was requested or attempted.
- Plan/REA schema run `46096395377` passed on `79a1fa3` after correcting the placeholder source locator that caused run `46096310166` to fail. The full CI run `46096310112` on parent `a2f837f` was still in progress at the last check; it is not a green result for the final master head. The Kompas baseline run `46096310096` passed on `a2f837f`.
