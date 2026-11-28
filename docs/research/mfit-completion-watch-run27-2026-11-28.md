# MFit Completion Watch — run 27

Updated: 2026-11-28T03:30:00Z

## Source and release reconciliation

- Canonical master at the start of this review: `bf9a0d41855f35f26d341bc31e88c8033b15dc13`.
- Production alias `job-dashboard-fawn.vercel.app` independently resolves to READY production deployment `dpl_E3LVFzdJKmXSiJLA25cmTTpdWUHy`, exact runtime SHA `593dff29044a4ec57284d7829ab951c2d499f193`. Master is documentation-only at this checkpoint; no runtime deploy was needed.
- The run-26 documentation PR #625 original head `42348de8a8c616cc032350565caab9657d0f732e` full CI failed at ESLint parsing `src/lib/plan-vision.ts:7` because a baseline property was malformed. Plan/REA, Kompas baseline and confirmed-skill gates passed. The property is corrected in commit `5e8bc0fe40b864fa584a348d7ab0942da78e3253`; later wording/Resume notes updated Plan Vision to revision `2026-11-28.4` at latest head `6633cdd67106e63896c95af827e414dfc5864306`. The last observed PR-head workflow set on `422ab1c16b4a64fafa9b4db974cc6d84606a3f05` had full CI `46103847113` and confirmed-skill `46103847065` IN_PROGRESS, Plan/REA `46103847078` and Kompas baseline `46103847046` SUCCESS; these do not validate later documentation commits.

## Continue: contract crawler location review

PR #617 head `d3b4d899249e0b4cca282dedecf05f0fe8b354c2` passed six exact-head gates: full CI `46088479438`, Plan/REA `46088479513`, Kompas baseline `46088479463`, crawler freshness `46088479447`, manual-only `46088479424`, confirmed-skill `46088479478`. It remains stale/nonmergeable and has no protected preview or public API smoke.

Source review found two deterministic location-token defects in the server-side filter:

1. `MO` becomes a substring `ilike('%MO%')`. The word `Remote` contains `mo`, so a state abbreviation can match a remote label that is not Missouri.
2. `Kansas City, MO` becomes three AND terms `Kansas`, `City`, `MO`. A stored `Kansas City, Missouri` value misses the `MO` term and can underfill.

COMMENT review `6095458198` records the finding and requests normalized state/location components and tests for `MO` vs `Remote`, the abbreviated/spelled state pair, and a genuine Missouri remote listing. No production database rows were queried and no crawler was run.

## Gmail local-snapshot account-switch race

Current source `src/lib/use-gmail-data.ts` still has a distinct local restore path in `refreshGmailDataForCurrentAccount()`: after `await snapshotKey()`, it reads and publishes the returned account snapshot without rechecking the generation or currently verified account. A delayed A identity lookup can therefore publish A's local mail after the app has reset and switched to B.

The existing deferred A→B test in `scripts/tests/mail-digest-account-isolation.test.mjs` exercises `loadShared(false)` and deferred network results, not the local restore path. Issue #623 comment `7233161027` records this test gap and the proposed regression:
- defer A's `getSession()`;
- switch/reset to B and publish B's snapshot;
- resolve A and assert A is never published;
- repeat for sign-out;
- include a same-account snapshot refresh positive control.

This is a source-derived privacy risk, not a reproduced browser incident. No OAuth, inbox read, local code edit or test run occurred.

## Resume/JD confirmed-experience source audit

Current source `src/lib/resume-evidence.ts` (57a6dada) and `scripts/tests/resume-confirmation-quality.test.mjs` (decddd07) include candidate-vs-team attribution splitting and role-scoped confirmed-skill mapping. Compare `6f3cdcb` → production `593dff` is ahead by 2 and behind by 0, so the source is in the live lineage. PR #595/#598/#600 are closed with `merged_at=null`; their branch status is not merge evidence. No owner-authorized original resume/JD/confirmation bundle or exported DOCX was used. The 95–100%/98% match targets remain unmeasured.

## 17 October WhatsApp resume delivery incident

Read-only iZap `list_businesses` and `get_whatsapp_connection_status` for the sole `eshwarjay0` business confirm no linked number, disconnected state, no inbound ever observed and no outbound send proven. This scope is not established as the incident account. Do not treat empty search as proof of absence. A targeted Files Library search did not recover the incident's exact input/output DOCX; results were general resume research and unrelated content.

The historical 17 Oct 2026 17:28 America/Chicago delivery remains UNVERIFIED. Missing evidence: exact input/output DOCX, per-run R2 object/version, request/webhook correlation, Meta outbound `wamid`, and signed delivered/read receipt or failure status. A Vercel Hobby runtime-log query for 17 Oct 22:25–22:35 UTC was rejected: the plan retains only one hour of runtime logs, so historical request logs cannot be retrieved there now. R2 is not accessible through the available connectors. No send/replay was attempted.

## Execution limits and next steps

Remote GitHub source, PR, CI and Vercel metadata are available, but the local container has no canonical checkout, dependencies or installed Next.js 16.3.8 docs. The Vercel Sandbox restore quota remains a blocker; no replacement sandbox or quota bypass was attempted. No local tests/build, source-code edits, protected preview, deployment, model call, Gmail/WhatsApp action, crawl, R2/DB mutation or owner-device acceptance occurred.

Continue: validate PR #625 exact-head CI and Plan/REA after the syntax correction. Implement the Gmail generation/current-user guard with the deferred A→B/sign-out/same-account test only after the compliant checkout and installed guide are available. Correct PR #617's normalized location filtering and test it before restacking, protected preview and public API smoke. Recover the correct WhatsApp incident business/provider evidence read-only; do not send or replay.
