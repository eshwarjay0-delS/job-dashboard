# WhatsApp offline fallback session lifecycle — 12 November 2026

## Scope

Continue the owner-approved 6 November no-provider fallback without changing its delivery policy, identity boundary, evidence threshold or WhatsApp external-send eligibility.

## Source finding

On the exact PR #303 head `fcee3fb6c46bd3d69bcc1565ed7fd1d5adb244cb`, `sendOfflineOriginal()` can send the exact selected same-account library original through `sendClosest()`. When Meta returns a document message ID, `sendClosest()` marks the recovery record accepted and returns. That branch exits before the common `consume this pair` block later in `generate()`. The matching WhatsApp session can therefore retain the old JD and resume path after a successful offline fallback, leaving stale context attached to the next request.

## Change in the stacked follow-up

- Extract `consumeSessionPair()` and reuse it in the normal rewrite path.
- After Meta returns a document message ID, consume only fields still matching this run's `jdId`, `resumePath` and pending JD.
- Preserve a newer JD/resume written while the document send is in progress.
- Keep the old pair when the document send is rejected or unconfirmed; do not clear it merely because the provider key is absent.
- Preserve the selected email and relative library path in the last-used record when the matching pair is consumed.

The parent PR #303 still owns the approved offline fallback and no-baseline refinement policy. It now also uses the exact visible caption label `Original resume — NOT TAILORED`. This follow-up is stacked on its branch and must not be merged independently.

## Verification

The patch was developed against parent head `fcee3fb6c46bd3d69bcc1565ed7fd1d5adb244cb` in an isolated Node 22 sandbox.

- Targeted WhatsApp/resume suite: 64 passed, 0 failed.
- Kompas baseline: 92 passed, 0 failed.
- `npx tsc --noEmit`: exit 0.
- Focused ESLint on the changed route and test: exit 0.
- `npm run build -- --webpack`: exit 0, including the repository prebuild gates and production webpack build.

The new mocked regressions cover: accepted offline fallback clears its matching JD/resume; a newer JD using the same resume path survives; a newer resume attached to the same JD survives; a newer JD and resume both survive; and a refused Meta document send leaves the old pair intact for retry. These are source/runtime contract tests, not real WhatsApp delivery evidence.

## Exact blockers and next action

- Parent PR #303 remains DRAFT at updated head `344ed47061ae475a42e9695d08ca2dba91bf3fc2`; its Kompas baseline `43138216526` is SUCCESS, full CI `43138216531` and WhatsApp recovery `43138216521` are IN PROGRESS, and protected preview `43138214326` failed because the private `KOMPAS_VERCEL_API_TOKEN` is absent. PR #310 exact-head WhatsApp recovery 43136393260 completed SUCCESS. PR #311 Plan/REA schema 43136679015 passed; PR #306 full CI 43131176244, Kompas baseline 43131176252 and Plan/REA schema 43131176205 passed. The protected preview remains unavailable while Vercel project metadata reports live=false.
- The protected preview gate is unavailable because GitHub Actions lacks the private KOMPAS_VERCEL_API_TOKEN; the 17 fail-closed resolver tests passed. The owner or authorized repository administrator must configure it privately. PR #306 records public production health/version/desktop-version GETs returning 200; this is not authenticated device acceptance. Do not bypass protection or alias a preview.
- The Plan/REA follow-up is PR #311, stacked on PR #306. PR #310 remains stacked on PR #303's branch; GitHub reports it mergeable relative to that parent, but it is not independently ship-ready. After #303 is accepted, retarget/restack #310 onto accepted master and rerun its full CI, WhatsApp recovery, Kompas baseline and legitimate protected preview. No documentation merge is claimed.
- The historical 17 October 17:28 Chicago incident remains unresolved: the original source DOCX and full JD are recovered, but the generated output DOCX, per-run R2 key, webhook/request correlation, Meta message ID and signed delivered/read receipt remain unavailable. Conflicting education/employment/credential facts remain quarantined pending owner reconciliation.

No model call, R2 write, email, WhatsApp send, production mutation or handset test was performed. Do not claim this fix is deployed or that the historical delivery succeeded.
