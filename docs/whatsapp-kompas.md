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
