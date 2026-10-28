# WhatsApp Kompas integration

## Owner approval
27 October 2026 continuation: “Setup that”, following explicit implementation and production approval. Earlier requirements: exact keyword kompas enters Kompas; request resume and JD; accept supporting attachments at session start; reply to questions in WhatsApp; exact revert restores ordinary resume tailoring. Latest correction requires the latest MFit Kompas engine and desktop context to remain synchronized. No new approval is required for this scope.

## Required implementation
- Use the shared deployed Kompas answer service, not a separate prompt/model fork.
- Verify webhook signatures and the linked account before accessing any session. Bind sessions to account ownership, not only phone number.
- Collect resume and JD separately; start must never be stored as source text. Keep supporting documents distinct, with bounded parsing and explicit unsupported/oversized file errors.
- Persist one shared session ID, source revisions and ordered turns for desktop and WhatsApp. Retain context across follow-ups and reconnects. Show pending synchronization while offline; do not promise instantaneous offline synchronization.
- Treat exact case-insensitive kompas and revert as commands; ordinary prose containing those words remains content.
- Revert detaches WhatsApp from Kompas without deleting desktop history. Prevent an in-flight answer from leaking into the reverted tailoring mode.
- Deduplicate webhook retries and concurrent turns; prevent stale source revisions and account relinking from exposing another user's context.
- Preserve existing resume tailoring and existing voice/native work.

## Ten distinct acceptance groups
1. Verified and unverified sender boundaries, account relinking.
2. Exact command routing and ordinary JD fallback.
3. Resume/JD setup order, premature start, missing sources.
4. Supporting attachments, supported formats, malformed/empty/oversized input.
5. Same deployed engine and source revision on both channels.
6. Ordered follow-up history and question fragment handling.
7. Duplicate delivery, concurrent events and retry idempotency.
8. Revert during setup, active chat and in-flight generation.
9. Offline/reconnect reconciliation and visible pending state.
10. Provider/storage failure recovery and existing tailoring regressions.

Use mocked outbound delivery for automated integration checks; do not send real WhatsApp or email test messages. If ten improvement rounds are requested, retain each round's cases, failures, fixes and results. Ten scenarios are not ten rounds. Generated-answer quality requires separate real-model evidence.

## Evidence and exact wall
Prior conversation records local commits b041fad (state reducer), 6773cfe (shared answer-service refactor), c63abe9 (sync requirement) and 8538d3f (setup limits/tests). These local commits are not recovered or verified in this environment and must not be presumed present on GitHub. Prior report: 10 scenarios initially 7 passed/3 failed, then all 10 plus four existing checks passed after fixes; one improvement cycle only. Answer-route test harness adaptation and full regression remained unfinished.

Last checked production was READY at 9ece077261527c77f230b5a67cc8ab8e009962ff; its WhatsApp webhook had no Kompas or revert integration. This document does not change production behavior.

Current execution attempt returned: “No usable execution environment is available.” GitHub reads/writes work. Implementation, typecheck, build and integration tests cannot execute here. Unblock by restoring a runnable checkout with dependencies; recover the local commits or reimplement from current master, preserving concurrent changes. Read installed Next.js documentation before code edits, per AGENTS.md.

## Release completion
Implement and test the actual webhook-to-shared-engine flow and shared desktop persistence; repair test harnesses without weakening authentication assertions. Run focused acceptance, full regression, typecheck and build. Publish reviewable code, validate preview, deploy approved scope and verify exact production SHA/alias. Record live acceptance separately. Coordinate voice/native edits with Kompas Continuous Voice Delivery; no voice/native changes are included here.

## Restored runtime implementation, 27 October
The runnable checkout is restored. Work continues from master 7d849ea, preserving newer engine policy changes rather than copying the stale engine. The authenticated answer HTTP route now delegates to a shared internal engine. Immutable, account-scoped session revisions use conditional writes for conflicting updates. Shared turns claim a revision before calling the same engine and reject stale completions. A timed-out claim may be superseded after 120 seconds; old completion cannot overwrite a newer revision. Attachment intake is bounded to the engine's actual 60,000 resume / 8,000 JD / 8,000 combined supporting-document characters.

Webhook and desktop adapters are not yet wired. Revision retention/deletion and session discovery must be implemented before exposing the store to users. Ten offline concurrency/history folds increase parallel attempts and history lengths; they are not live provider evaluations. Validation results will be recorded after completion.

Validation: full regression completed 1,162/1,162 with zero failures in 179.5 seconds after the engine extraction and session store. After adding shared-turn coordination, focused validation passed 42/42 (including seven shared-turn cases and twenty increasing concurrency/history cases); TypeScript passed. No live provider calls or outbound delivery. A second bounded-concurrency full run has no completion evidence recorded and is not counted as another completed run. Two further intake boundary checks passed, including attachment JD parity and supporting-document formatting overhead (16 intake tests total).

## WhatsApp transport implementation (27 October, PR #87)
The previous WhatsApp webhook now routes only exact `kompas` and `revert` plus messages in an active, verified account-owned Kompas channel to the same `sharedKompasTurn` answer service as the authenticated Kompas route. A channel is backed by immutable conditional-write revisions under an account-and-phone hash. Resume and JD source text remains separate from supporting DOCX/PDF/TXT; supported documents are downloaded with a 5 MB streaming limit, and the engine's character/source limits are enforced by the existing reducer. Revert writes a channel tombstone and cancels a pending generation without erasing desktop session history. The sender's account is rechecked before outbound messages. Ordinary JD/docx resume-tailoring flow is unchanged for non-Kompas messages.

New mocked transport test suite: `scripts/tests/whatsapp-kompas-channel.test.mjs`, covering ten cases including source separation, unverified user, concurrency, revert and stale answer. Test file committed; pass count not yet verified by a test runner. Git commit `0d5a23758eb5fae40eddb7fb7cba521a28a60ccd` adds acceptance fixtures after the adapter commits `0b1d506`, `72bfbe7` and webhook wiring `e564473`. Preview build and actual WhatsApp delivery still require confirmation. No live outbound test messages were sent. The native desktop discovery/reconciliation UI and retention/deletion controls remain incomplete. Do not describe this as deployed to production until the exact production SHA, alias and delivery acceptance are verified.


## Complete PDF evidence and production reconciliation — 28 October

Fresh verification supersedes the historical deployment blocker above: PR #87 merged as 4374b13. Production deployment dpl_Hqejp9oxwBQB3bHVbsunxL4cvfn7 is READY at e9b7d272d19d3bcbe49810ff1b6d893349ddb891, target production, with job-dashboard-fawn.vercel.app assigned and no alias error. This proves deployed code, not real WhatsApp delivery or desktop history synchronization.

The deployed PDF helper silently sampled twelve pages, potentially discarding confirmed experience. WhatsApp Kompas now requests complete extraction: PDFs above twelve pages, incomplete page extraction, and text above the helper limit are rejected without replacing session evidence. The user is told to split a longer PDF. Library classification keeps its prior sampling behavior. The reducer continues to enforce separate resume/JD/support budgets. Parser resources are released on success, rejection and failure.

Validation: 47/47 focused PDF and WhatsApp Kompas tests, including a real generated PDF parsed by unpdf; TypeScript and production webpack build pass. No outbound messages or live model evaluations were sent. Full regression baseline comparison follows.

Scope coordination: Kompas Continuous Voice Delivery remains enabled; this change does not edit voice/native behavior. No separately named Bible-Keeper automation was visible. The existing source of truth retains superseded decisions. Desktop session discovery/reconciliation, retention controls and real authenticated delivery acceptance remain open. Original 17 October resume failure still needs the exact input, generated document and request trace; this PDF fix does not claim to resolve that incident.

Regression comparison: patched full suite completed 1,374 tests: 1,347 pass / 27 fail. All 27 failure names reproduce in the six affected test files on unchanged master e9b7d272 (baseline replay); no checks were skipped or weakened. The initial full baseline process exited without a summary, so only the completed targeted baseline replay is counted. Failures include a missing FIXTURES definition in the evaluation runner, outdated source-contract assertions and WhatsApp harnesses without the new channel mock. The nine PDF tests and all focused channel tests pass. These existing failures remain backlog items; the whole suite is not green. Focused ESLint also passed.

Release evidence: [PR #100](https://github.com/eshwarjay0-delS/job-dashboard/pull/100) merged as `0934ed6a2b6992b8bd1597a44c4d4a448d4dfc61`. Vercel preview passed at `77cdcf11f1cc8f68420e922fdab3317e9abf7fa8`; production `dpl_4HWPWqSHCeqWZEZi5QCMFWAw9wxs` read back READY, target production, exact merge SHA and live alias `job-dashboard-fawn.vercel.app`, aliasError null. Existing PDF-to-Word suite: 4/4 pass. Code deployment is verified; no real Meta message delivery or model-quality acceptance is claimed.

Next approved slice: repair the evaluation runner FIXTURES regression and older WhatsApp harness failures while retaining assertions; desktop synchronization and live delivery acceptance remain separate.


## Tailoring test harness restoration — 28 October

Continue owner-approved WhatsApp reliability work from master 30ec8d9. Legacy tailoring tests could no longer import the webhook after the Kompas channel and voice imports were added. Their harnesses now provide explicit boundaries: the channel returns not-consumed for tailoring scenarios, and unexpected voice transcription throws. Runtime code and all existing assertions are unchanged. Separate channel acceptance tests remain in the focused run.

Two new route behavior checks verify that a Kompas-consumed message cannot also generate/store/send a tailored resume, and that explicit profile switching bypasses the optional Kompas channel and persists the selected email. Account, verified flag and request ID forwarding are asserted. Focused validation: 60/60 tests pass; TypeScript passes. Full regression result follows. No real messages or model calls.

Production before this change was READY at 30ec8d9 on job-dashboard-fawn.vercel.app. Kompas Continuous Voice Delivery remains enabled; this work does not edit voice/native runtime. No separately named Bible-Keeper task appeared in accessible tasks. Original Oct17 incident acceptance still requires the original JD/resume/generated artifact and trace; these harness repairs are not evidence of live resume match or delivery success.

Four remaining source-contract failures were traced to prior runtime changes: generic operation failures now use a sanitized service-unavailable reply rather than always attributing them to an AI provider; failed tailoring uses a concise retry reply; unchanged generation takes the existing library fallback or explicitly reports no changes. Source assertions now require those actual branches, preserving raw-error exclusion and unchanged-result safeguards. Added runtime-harness checks confirm failed and unchanged direct rewrites send no document, release their request claims, and report the failure without exposing the mock provider error. These updates do not change or newly authorize fallback behavior.

Final validation: full hardening suite 1,378/1,378 pass, zero failures, 71.0 seconds; focused channel/tailoring 60/60; source/failure reconciliation 44/44; TypeScript and diff checks pass. Supersedes the previous 22-failure status for this revision only. This is offline regression evidence, not live resume-match or WhatsApp delivery acceptance.

Release verified 28 October: [PR #102](https://github.com/eshwarjay0-delS/job-dashboard/pull/102) merged as `54a77908780c51d83c1c47ed22f57d5dc9d7b35a`; preview READY at `b0bf08341b283d80c968b8199af82e67f3bf6464`. Production `dpl_B7txNcTrv3jrnd8Hc5goLoo4JvhF` read back READY/production at exact merge SHA, alias `job-dashboard-fawn.vercel.app`, aliasError null. This releases restored test coverage and handoff records, with no runtime change. Next approved product slice is desktop discovery/history reconciliation for shared WhatsApp Kompas sessions; authenticated live acceptance remains distinct.


## Shared web conversation — 28 October

Owner approved WhatsApp Kompas, latest shared engine and desktop synchronization. From master f6a9528, add `/dashboard/kompas/shared/[id]` and authenticated `/api/kompas/shared`. New or repeated `kompas` replies include the same session's web link; the link is only an identifier and never authorization. API identity always comes from authenticatedUser, not the request body. GET returns bounded conversation history and source-ready indicators, not raw resume/JD, ledger, owner or pending question. POST uses sharedKompasTurn with the displayed revision and server-owned sources, retaining concurrency, stale-answer suppression and normal engine quota/auth boundaries. Both responses are no-store.

The web page polls every five seconds while visible, ignores older revisions, clears history on authentication failure, and keeps a failed question for deliberate retry. It uses plain React text rendering for answers. WhatsApp questions and web questions share the latest 40 stored turns. Sending revert disconnects WhatsApp mode while retaining the web thread, as previously designed. Web answers are not automatically pushed as new WhatsApp messages. The link opens a browser view; this is not a rebuilt native installer or a session catalog in the native app. Existing sessions get a link by sending kompas again. No bucket listing or new storage permissions are required.

Validation: 79/79 focused API/channel/store/turn tests; full suite 1,386/1,386 before the final link-only regression was added, with that additional test passing in the final focused run. TypeScript, focused ESLint and webpack production build pass. Local production server: signed-out session API 401 with no-store, shared page route HTTP 200. Browser interaction/visual acceptance blocked: Chromium executable absent and attempted download produced an invalid archive. Needs a working browser runtime plus authorized synthetic account/session fixtures. No real WhatsApp/email messages or provider evaluations sent.

Voice task remains enabled; voice/native implementation untouched; no separately named Bible-Keeper task visible. Original Oct17 incident still needs exact input/output/trace. Session catalog, retention/deletion controls, source editing, installed Windows acceptance and actual two-channel delivery remain open. Keep these distinct from shared history/API implementation.

Release verified 28 October: [PR #103](https://github.com/eshwarjay0-delS/job-dashboard/pull/103) merged as `8e291f966b6ac3157c10a5196df38013ceadd594` after preview READY at `09a6a4be8dc68d728b6a9ad30c38d5eead6df92d`. Production `dpl_HXCJhx5TgqjYTJ57bkE7N81jxGcK` read back READY/production through `job-dashboard-fawn.vercel.app` with exact merge SHA and aliasError null. Live signed-out GET to the shared-session API returned 401 and Cache-Control no-store. No actual account session, model generation or Meta delivery was exercised. Browser acceptance and remaining catalog/retention/native work stay open.

## Recent shared-session discovery — 28 October

Owner-approved shared WhatsApp/web synchronization continues with a recent-session catalog and dashboard navigation. The catalog keeps the latest 100 registered session IDs and registration dates, under a hash of the verified account, using immutable conditional-write revisions and exact-key reads. It never requires ListObjects. New sessions are registered only after successful channel attachment; repeating `kompas` repairs discovery for an existing active session. Opening an owned web session also registers it. Registration is idempotent; concurrent registrations retry against the winning revision. Catalog failures do not prevent chat use or normal tailoring; retry by opening the existing link or sending `kompas` again. Older sessions are not bulk-discovered, and evicting an entry from the recent list does not delete its content or invalidate its link.

The authenticated shared endpoint lists only IDs and dates. It does not return source text, phone numbers, ledger, or question/answer previews in the catalog. Each conversation still checks owner scope independently. Dashboard Kompas navigation includes WhatsApp chats. `revert` preserves the catalog/history as requested. Native/voice files are untouched; the separately enabled Voice Delivery task retains that scope. No separately named Bible-Keeper automation was visible in the accessible task list.

Retention/deletion design (pending implementation): a real deletion must first mark an account-owned session inaccessible, cancel pending turns, and detach any active channel before removing immutable revisions. A durable deletion job must enumerate exact known revision keys, include prior catalog snapshots and source-bearing session revisions, retry failures, and record completion without private content. Removing only a recent-list entry would falsely promise erasure. Do not apply automatic retention or delete user history until a retention policy and the full verified erasure path exist. Catalog snapshots currently retain historical IDs/dates; session revisions retain original source/history content. No deletion control is claimed in this release.

Validation: 67/67 focused checks, including ten increasing concurrent-registration cases, owner boundaries, bounded catalog retention, corrupted ownership and retry after catalog failure. Full suite 1402/1402 passes; TypeScript, focused ESLint and production webpack build pass. Release evidence follows. Authenticated browser interaction and real two-channel delivery remain separate acceptance gates; no outbound test messages or live model calls are authorized by these automated checks. Original Oct17 resume incident still needs exact inputs, generated output and trace. Live answer-quality evaluation needs an authorized token and approved source bundles.

Release: PR #104 merged as 53fc9b6b64d583d3684cad1509a1ba40c967a43c after preview dpl_8dZ6pvKEJX6BTwR2RPT9XdCffsV3 was READY at e39b53e6. Production dpl_GZJVL1DDbuzfxNbV2CYSgapu5nzY read back READY/production with the exact merge SHA and job-dashboard-fawn.vercel.app alias, aliasError null. Live catalog GET signed out: 401/no-store; list page: 200. No real outbound messages/model calls. Authenticated browser, native and Meta delivery acceptance remain open. Next independent approved slice is shared web source editing with the same source limits and revision-conflict guarantees; retention/deletion remains separate unfinished work.

## Shared web source updates — 28 October

Continue owner-approved latest-engine and shared-context integration from master 09f2944. The shared chat now accepts explicitly selected pasted resume replacement, JD replacement, or supporting notes through an authenticated PATCH. It reuses kompasTransition, including 60,000 resume / 8,000 JD limits and the combined 8,000-character support budget (names/separators included, maximum ten documents). File attachment parsing remains in WhatsApp; this slice adds pasted text, not a new file upload promise.

Every mutation derives the owner from authentication, requires the displayed revision, and conditionally commits one new revision. Changed evidence clears active history, ledger and pending generation exactly like WhatsApp source changes. The UI explains this reset and retained older revisions before saving. An identical replacement is a no-op. Existing source text is not fetched into the browser: users paste a complete replacement. Supporting notes append; deletion/reordering is not included.

Drafts retain their original revision while visible-page polling continues. Concurrent changes disable saving until the user reviews the current conversation and explicitly chooses its revision. Failed requests keep the draft; a connection failure warns that the save may have completed. A successful update shares the new evidence with the next question from either channel; the old in-flight answer cannot commit over it. No proactive WhatsApp message is sent.

Focused validation: 35/35 API/store/turn checks, including ten increasing concurrent-editor cases, signed-out/cross-account denial, source boundary and cumulative support limits, no-op preservation, and an actual shared-turn state-machine race against PATCH with a mocked provider. Full regression 1420/1420 passes, zero failures; TypeScript, focused ESLint and production webpack build pass. Local production PATCH returns 401/no-store while signed out. Release evidence follows. No live model-quality rounds or real messages. Original resume incident needs exact input/output/trace; authenticated browser and two-channel acceptance require working browser runtime and authorized fixtures. Voice Delivery remains enabled; no separately named Bible-Keeper task visible. Native/voice code is untouched.

Release verified 28 October: PR #105 merged as 88744ff9ba7b0bbf44510ad70933463b2ce5fea9 after preview dpl_2ngnBuMzp2Li8gHFyAZMPXLvJX1Q READY at f0112fcb. Production dpl_DKVBS2yH6zkEPm8e6a1SQesoNDYK read back READY/production through job-dashboard-fawn.vercel.app with exact merge SHA and aliasError null. Live signed-out PATCH returns 401/no-store. No authenticated user sources were changed by validation. Browser/Meta/live-quality acceptance remains open. Next independent source-management slice: explicit supporting-document replacement/removal with revision safety, without claiming erasure of retained revisions.

## Supporting-document corrections — 28 October

Continue owner-approved shared-context source management from master 226c982. The owned session view now exposes supporting-document index, name and character count (not source text). The web chat offers explicit replacement/removal with a confirmation form. The selected index is valid only at the captured session revision. Polling cannot silently retarget a draft; after any revision change, cancel and reselect from the current list. Duplicate or racing removal requests must conflict rather than remove the next item after indexes shift.

PATCH supports replace/remove only for supporting evidence. Replacement validates against the remaining combined budget, retains document order and works at the ten-document cap. Both operations retain resume/JD, reset active history/ledger and cancel stale answers. Unchanged replacement is a no-op. Removal excludes future answer context; old immutable revisions still retain the original data and this is explicitly not permanent deletion. No user documents are changed by mocked validation, and no outbound messages or model calls are sent.

Validation underway: focused API/store/turn cases include ten increasing duplicate-removal races, ownership, invalid indices, replacement at exact cumulative budget, document-cap replacement, and removing evidence during generation. Initial boundary fixture overcounted available text by one character; corrected to account for all name/separator overhead without weakening the reducer limit. Browser interaction and live two-channel acceptance still require a working browser and authorized account/source fixtures. Voice task remains enabled; native/voice code untouched; no separately named Bible-Keeper task visible. Original Oct17 incident still needs exact inputs/output/trace.

Validation: 50/50 focused checks; full suite 1435/1435, zero failures; TypeScript and focused ESLint pass. First local build failed inside unchanged Next Google-font loader (null-match TypeError); retry completed successfully with no code or quality-check changes. No quality threshold or security assertion was weakened.

Release verified 28 October: PR #106 merged as ebbf5c081cde14b795f3277cd2be1f2af97645f3 after preview dpl_BG8tNSKvnFJveb9qCxSoEg6m9KCS READY at 4406fabc. Production dpl_HYARGQUiFjAqfZcewZxVfv1FZwB4 read back READY/production through job-dashboard-fawn.vercel.app with exact merge SHA and aliasError null. Local and live signed-out removal PATCH return 401/no-store. No authenticated user document was removed by these probes. Browser/Meta/live-quality acceptance remains unverified. Next independent approved slice: bounded web attachments reusing complete PDF extraction and existing source budgets; native integration and complete retention/erasure controls remain open.
