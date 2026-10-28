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
