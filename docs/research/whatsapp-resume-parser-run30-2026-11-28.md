# WhatsApp resume parser — Run 30 current-master continuation (28 November 2026)

## Approval and scope
Accessible prior owner context recovered direct approval from 21 November 2026: split a two-line message only when its first line matches the existing job-post signature; preserve the named resume; ask for account email when identity is ambiguous; never guess an account. Ordinary short chat and two-line messages without a JD signature must remain intact. The JD is a requirements source, not evidence of the candidate's experience. This approval supersedes the earlier run-29 provenance hold for this narrow parser only.

## Implementation
- `src/lib/role-match.ts`: allow the two-line shape only with the existing JD-signature regex; instantiate a fresh non-global expression to avoid stateful `lastIndex` behavior.
- `scripts/tests/role-match.test.mjs`: add 50 repeated positive calls plus short-chat and no-signature negatives.
- `package.json`: register the regression in the build/prebuild gate.
- `scripts/tests/kompas-deploy-build.test.mjs`: preserve all required test groups while allowing additive regression tests, instead of requiring one exact prebuild command.
- `src/lib/kompasPacks.ts`: compatibility export for source-based test loading.
- `docs/whatsapp-kompas.md` and Plan & Vision journal: record approval, current implementation and limits.

## Validation
The previous PR #633 head `81e839ac` had full CI run 46115683036 and Kompas baseline 46115683096 SUCCESS. Those results do not validate this fresh restack. No canonical local checkout or dependencies are available; clone attempted but DNS resolution for github.com failed. Fresh exact-head CI is pending. No production deployment, protected-preview HTTP smoke, real WhatsApp send, resume export, R2 mutation, Meta receipt or historical replay occurred.

## Historical 17 October incident
The 17 Oct 2026 17:28 Chicago resume failure remains unverified. Missing artifacts include the exact input/output DOCX, per-run R2 object/version, webhook correlation, Meta outbound ID, signed delivery/read receipt, and source-fact reconciliation. Do not replay or resend to manufacture evidence.

## Next
Require exact-head full CI, Kompas baseline, source review and protected preview. Merge only after gates pass; deploy latest approved master once and verify READY plus canonical alias. Then test the parser and resume/JD factual alignment with a consented connected WhatsApp account. Continue investigating issue #201 durable recovery without sending messages or changing account boundaries.
