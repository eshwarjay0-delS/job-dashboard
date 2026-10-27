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
