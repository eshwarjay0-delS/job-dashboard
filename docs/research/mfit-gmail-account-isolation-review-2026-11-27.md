# Gmail account isolation and mobile review — 27 November 2026

## Scope and approval

This is a source-and-artifact review of the approved Poke-inspired multi-account Gmail/mobile work. The four connected-account maximum is authoritative. Receiving-inbox identity, per-account From/reply state and the owner-requested normal-flow mobile menu remain safeguards. The proactive Poke worker, scheduler, notifications and sending remain disabled. No new automation or outbound behavior is approved by this review.

## Exact source and remote checks

- PR [#576](https://github.com/eshwarjay0-delS/job-dashboard/pull/576), current branch fix/gmail-digest-mobile-master-restack-20261124, exact head 28d67d66db298bae4bc71e12e377a7837cccbc0b.
- Full CI run [45989032477](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/45989032477): SUCCESS.
- Kompas baseline run [45989032526](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/45989032526): SUCCESS.
- The branch is 21 commits ahead and 8 behind current master 1eb604b33cfe58f3c0f6ad611d346d5921e184ff; it is diverged and requires a clean restack.

The reviewed source includes account+thread digest/radar identity, receiving-inbox-specific sender mutes and open actions, user+account+thread reply/draft identity, a server-side four-account cap, a shared/in-flight Gmail cache keyed by the verified Supabase user, account-switch reset, late-response suppression, and normal-flow mobile navigation.

## New review finding

Review COMMENT [6090182960](https://github.com/eshwarjay0-delS/job-dashboard/pull/576#pullrequestreview-6090182960) is anchored to scripts/tests/mail-digest-account-isolation.test.mjs line 92. The test currently reads source files and checks regular expressions. It does not execute the account-switch lifecycle.

Required regression:
1. Start an A-owned Gmail request.
2. Replace the session with account B without a preceding SIGNED_OUT event.
3. Resolve A's request after B is active.
4. Assert A's payload is never published to B's listeners and is never written under B's snapshot key.
5. Assert B does not join A's in-flight promise and receives only B-keyed data.

Keep the existing source-shape assertions as supplemental wiring checks, not behavioral proof.

## Release and acceptance state

The PR remains unmerged and must be cleanly restacked. Plan/REA validation and protected preview have not been verified for the current head. Two-inbox collision, selected-From preservation, independent reconnect and narrow-phone acceptance remain open. No Gmail OAuth, mailbox content, inbox mutation, email send or phone interaction occurred.

## Execution boundary

GitHub source and Actions metadata were available through the connected GitHub integration. The local container has no canonical checkout, cannot resolve GitHub and has no installed dependencies. The installed Next.js 16.3.8 route-handler guide is unavailable. The Vercel persistent sandbox restore remains quota-blocked until 1 Dec 2026 00:00 UTC. No local test/build or code edit was performed.

## Continue

After the compliant checkout, dependencies and installed Next.js guide are restored, clean-restack #576 on current master, add the executable A→B in-flight isolation regression, and rerun exact-head full CI, Kompas baseline and Plan/REA. Keep DRAFT until protected preview and owner-consented two-inbox/narrow-phone acceptance pass.