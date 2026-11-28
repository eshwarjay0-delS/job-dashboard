# WhatsApp resume routing — clean restack, Run 29 (28 Nov 2026)

## Owner decision
Direct approval recorded 22 Nov 2026 12:02:21 UTC for the narrow parser: preserve the named resume, split a two-line job post only when the first line has a known JD signature, ask for account email when ambiguous, and never guess the account. Ordinary short chat and no-signature messages must remain unsplit.

## Changes ported from stale PR #628 onto current master
- `src/lib/role-match.ts`: one-line JD + named resume is now accepted only when the first line matches `JD_SIGNS`; ordinary two-line messages remain intact.
- `scripts/tests/role-match.test.mjs`: 50 repeated positive cases and short-chat/no-signature negatives.
- `package.json`: registers the role-match regression in prebuild.
- `src/lib/kompasPacks.ts`: compatibility re-export for the directory pack module.
- `scripts/tests/kompas-deploy-build.test.mjs`: replaces the brittle exact prebuild-string assertion with required-suite/runner checks, preserving the baseline and all existing required tests while allowing additive tests.
- `docs/whatsapp-kompas.md`: approval, boundaries and acceptance recorded.

## CI evidence and blocker
PR #628 exact head `f17e30d25daf98b2950eeac25f0775c7b4f3a752` failed full CI run 46109239024 at the deploy-build contract: package prebuild included `role-match.test.mjs`, but the test expected the old exact command. The isolated replacement contract probe passed 2/2; that is not canonical CI. PR #628 is behind current master and non-mergeable. This restack is a new draft on current master; exact-head remote gates must pass before merge. No local canonical checkout/dependency test was available.

## Acceptance still missing
No live WhatsApp connection currently exists in iZap for the only business. Read-only status on 28 Nov: `connected=false`, registration `disconnected`, no linked number, no inbound, no outbound proven. The 17 Oct 17:28 Chicago failure is not disproven: the historical phone/business mapping, original resume/JD bytes, exported DOCX, R2 object/version, webhook correlation and Meta receipt are missing. No real send, replay, DOCX delivery, model call or production deployment was performed.
