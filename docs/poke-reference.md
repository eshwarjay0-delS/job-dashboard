# Poke reference for MFit Gmail

Reviewed: 2026-10-17. Product name corrected by the user: **Poke**, not Pothi. This is a public-documentation behavior study and an MFit implementation contract. It is not access to Poke's source, private accounts, prompts, models, or internal architecture.

The REA CLI attempt was blocked by host process ownership. Its partial evidence is `/tmp/mfit-rea-evidence.json`; do not represent that attempt as a completed REA analysis. The findings below were independently checked against official public documentation.

## Documented reference behavior

| Area | Official evidence | Boundary |
| --- | --- | --- |
| Messaging | Poke documents Apple Messages, Telegram, WhatsApp and RCS, with conversational email reading, search and drafting. [1] | Do not infer a generic carrier-SMS integration or identical capabilities on every channel. |
| Gmail actions | The public homepage describes Gmail search, drafts, sending, labels and inbox organization. It also describes proactive behavior using connected services and memory. [2] | Marketing language is not a reliability guarantee or evidence of the underlying model. |
| Multiple accounts | Release notes describe connected Google and Microsoft accounts managed together, and adding accounts from Integrations. They also document reconnect controls and past threading/CC defects. [3] | Exact Gmail account limits, account-selection rules and latency guarantees were not established. |
| Connection lifecycle | Integration management supports authentication, connected-account details, disconnect, connection errors and retry/refresh. [4] | Connecting an account does not prove ongoing sync health. |
| Persistent identity | Account merging verifies a phone number and preserves the selected account's memory, recipes and integrations while associating messaging channels. [5] | This is product behavior, not proof of a particular memory database or model-training method. MFit must not silently merge accounts by email/name. |
| Automation configuration | Recipes package onboarding context, initial behavior and required integrations. [6] | A recipe is configuration, not evidence that every proposed automation has executed. |
| Event entry point | Poke's authenticated API accepts contextual messages for the user's Poke assistant to process with connected tools. Its response indicates message delivery. [7] | It is not documented as a white-label Gmail backend, a mailbox export API, or proof that downstream actions finished. |
| Capacity | Usage documentation describes allowances, reduced operation at limits and background automation availability; frequent automation consumes capacity. [8] | Do not promise unlimited monitoring or unlimited reasoning. |

## MFit implementation contract

These are MFit design decisions derived from the user's vision, **not claims about Poke internals**.

| Requirement | Existing MFit source / extension point | Acceptance evidence |
| --- | --- | --- |
| Account strip and safe identity | `src/lib/googleWorkspace.ts`, `src/app/api/identity/google-workspace/accounts/route.ts`, `src/lib/use-gmail-data.ts` | All connected accounts remain visible even when empty. Every thread, draft, cursor and send is keyed by user + account + provider ID. No fallback sender. |
| Inbox and mobile share updates | `src/app/api/gmail-sync/route.ts`, `src/app/api/gmail/crawl/route.ts`, `src/app/api/agent/notifications/route.ts` | A durable event produces one inbox item and eligible mobile delivery; retries do not duplicate it. Show last successful sync and partial account failures. |
| Phone delivery | `src/lib/whatsapp-link.ts`, `src/lib/whatsapp.ts`, `src/app/api/whatsapp/webhook/route.ts` | Delivery uses the user's verified, opted-in linked destination. Receipt states distinguish queued, accepted, delivered and failed; provider configuration must be verified before claiming live delivery. |
| Shared contact context | `src/app/dashboard/mail/_components/contact-card.tsx`, `src/app/api/gmail/person/route.ts` | Same contact skeleton for every thread; unavailable name/phone/company remains blank. Subject/date history is account-scoped and states its retention window. |
| Important sender tracking | `src/lib/mail-important-store.ts`, `src/app/api/gmail/important/route.ts` | Future messages from a marked sender appear in Important, scoped to the selected account. Unmark stops tracking. |
| Explainable assistance | `src/lib/mail-habits.ts`, `src/app/api/gmail/habits/route.ts`, `src/app/dashboard/workflows/page.tsx` | Saved reply examples and explicit preferences support suggestions. A suggestion is distinct from a scheduled rule or completed send. Each action records its source message and result. |
| Reply and follow-up continuity | `src/app/api/gmail-send/route.ts`, `src/lib/gmail-message.ts` | To/CC/BCC, attachments, sender and thread are validated. Follow-ups stop on reply and honor the user's timezone, pause control and authorized rule. |

### Live sync design

For MFit, use Gmail mailbox watches through Cloud Pub/Sub, durable per-account history cursors, idempotent processing, and recovery polling. Google documents watch renewal at least every seven days (daily recommended), notifications carrying mailbox/history identifiers, and `history.list` for changes. Notifications can be delayed or dropped; Google recommends fallback synchronization. [9] This is Google's documented mechanism, not a finding about Poke's implementation.

The existing client hook has a two-minute refresh pulse. A refresh timer alone is not continuous background mobile delivery. Backend ingestion must persist events independently of whether the browser is open. The existing `docs/REALTIME_MOBILE_ARCHITECTURE.md` describes durable catch-up; reuse that principle rather than treating a socket as the event database.

### Release gates

- Two accounts with overlapping sender/thread-like fixtures stay isolated; revoked access to one leaves the other usable.
- Replayed provider notifications and process restarts produce no duplicate phone alerts.
- A disconnected browser catches up from the durable cursor. Connection failure is visible, never an empty successful inbox.
- Mobile alerts identify the receiving account and link to the correct thread; quiet hours and opt-out are enforced.
- Missing contact details stay empty. Suggested facts have source evidence. Incoming email text cannot redefine automation permissions.
- Real-device delivery, reconnect, stop-on-reply and provider receipts require a controlled end-to-end check before “live” is claimed. No private inbox or message delivery was exercised for this documentation review.

## Official sources

1. https://poke.com/docs
2. https://poke.com/
3. https://poke.com/docs/release-notes
4. https://poke.com/docs/managing-integrations
5. https://poke.com/docs/merging-accounts
6. https://poke.com/docs/creating-recipes
7. https://poke.com/docs/api
8. https://poke.com/docs/usage-and-resets
9. https://developers.google.com/workspace/gmail/api/guides/push

## Execution audit, 26 October

26 October execution audit: automation-plans persists mode review and stopOnReply true, but that flag is saved intent, not a running response detector or twice-weekly scheduler. followup-engine explicitly drafts only. Ten reply-pattern guardrail tests pass offline; no real sends or schedules enabled. Next implementation must add account-scoped due/stop evaluation and idempotency before any executor; separate live consent acceptance remains required.

## Local eligibility implementation, 26 October

Local follow-up eligibility helper implemented on 26 October: exact account/thread scope, stop on inbound reply, invalid/future evidence rejection, disabled/ignored checks and completed-occurrence suppression. Four eligibility tests and 21 focused checks pass. Full regression: 1050/1050 pass; TypeScript passes on 26 October 2026 after rebasing onto 66c8fd3. Pure review logic only: no scheduler, send permission, atomic claim or route integration. Next integrate with verified account-scoped observations and atomic occurrence claims before execution.

 PR #81 preview passed and merged on 26 October 2026 as 4829bb27e90a4ea9f0c17b85a7bbfaffe670bca3. Regression 1050/1050 and TypeScript passed. Production verified READY on 26 October 2026: dpl_DMKpH4wn4tDqJwjhfB9N5HMCuQXU, commit cf4e16f7dec32fb91d293a67604c5b6f4c2e46d5 includes PR #81; target production, job-dashboard-fawn.vercel.app assigned, aliasError null. This releases the pure helper only; Gmail observations, atomic claims, route integration and live acceptance remain pending.  no route integration, scheduler, sending or atomic claim is enabled.

Production verified READY on 26 October 2026: dpl_DMKpH4wn4tDqJwjhfB9N5HMCuQXU, commit cf4e16f7dec32fb91d293a67604c5b6f4c2e46d5 includes PR #81; target production, job-dashboard-fawn.vercel.app assigned, aliasError null. This releases the pure helper only; Gmail observations, atomic claims, route integration and live acceptance remain pending.

26 October integration audit: storage already exposes putIfAbsent (local exclusive wx and S3 IfNoneMatch star); reuse this primitive for user/account/thread/occurrence claims rather than adding a database solely for locking. Saved plans still lack explicit dueAt/occurrence fields, so free-text twice-weekly instructions must not silently become executable schedules. Follow-up radar uses substring sender matching; replace it with exact parsed email equality before using radar as verified outbound evidence. No sending or scheduler was enabled.

26 October: follow-up radar now compares parsed sender mailboxes exactly for outbound classification and recipient lookup. Two focused regressions cover lookalike addresses and display-name spoofing. Local fix; publication and deployment pending. No live mail sent. 26 October additional regression reproduced quoted display-name spoofing with an embedded angle-bracket email. The parser now ignores quoted display-name text and refuses multiple bracketed mailboxes. Three focused regressions pass after repair; full regression 1063/1063 and TypeScript pass on the branch merged with master 0d1c3d3. Earlier two-test evidence remains historical. No email sent, no follow-up executor enabled. Ready for review preview and authorized fix deployment. 26 October release: PR #83 merged as 1dcf28456325ace513dc3d847d42927f947506a7 after preview success. Production dpl_ENsvxvPBN4zaf8VWkSoKQTvKNDWX verified READY, target production, exact merge SHA, job-dashboard-fawn.vercel.app assigned and aliasError null. Full sender branch regression 1063/1063 and TypeScript pass; after preserving concurrent master 4d3450d, eight integration/guard/schema checks and TypeScript pass. Sender equality and quoted-display parsing are deployed; no live Gmail acceptance or email sending. Follow-up scheduler integration remains unfinished.


26 October follow-up evidence hardening: a missing internalDate previously became zero and appeared to have waited since 1970. Radar now excludes missing, non-finite, non-positive and future timestamps before calculating quiet days. Twelve sender/time regressions pass, including the exact three-day boundary. Local implementation only; publication and deployment pending. No email sent or scheduler enabled.


27 October release reconciliation: PR #84 merged as 9dde95d74fb5beded6f0352f34836f6117ae0342. Retained full regression completed 1123/1123 with zero failures in 56.2 seconds on the branch preserving master be5587d; TypeScript passed. Production dpl_7jqk94yNTXbpqpNXrApLXhNKtNJV verified READY at that exact merge SHA, target production, job-dashboard-fawn.vercel.app assigned, aliasError null. Supersedes prior publication/deployment-pending notes for timestamp hardening. Authenticated Gmail acceptance, schedule integration and atomic occurrence claims remain pending. No email sent or scheduler enabled.

27 October: eligibility review now rejects zero outbound timestamps and dueAt preceding lastSentAt. Five eligibility tests and twelve sender/time tests pass (17 total). Pure helper only; publication preview and production verification pending, no route integration or sending enabled.


27 October release reconciliation: PR #85 merged as 9799d1ac1bc4a963398c54ed0898fa0c3124055c. Seventeen focused tests and TypeScript passed; retained full regression completed 1124/1124 with zero failures in 56.1 seconds. Production dpl_3kLWQEavD2PCvwGbGyfMXuVeTNS7 verified READY at exact merge SHA, target production, job-dashboard-fawn.vercel.app assigned and aliasError null. Supersedes preview/production-pending notes for the positive outbound timestamp and schedule-order guards only. Pure helper remains unintegrated; next add account-scoped verified observations to review without enabling execution. Atomic claims, explicit schedule fields and live Gmail acceptance remain pending. No email sent.
