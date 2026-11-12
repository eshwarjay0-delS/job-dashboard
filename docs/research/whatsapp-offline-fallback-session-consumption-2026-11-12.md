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

The parent PR #303 still owns the approved offline fallback and no-baseline refinement policy. This follow-up is stacked on its branch and must not be merged independently.

## Verification

The patch was developed against parent head `fcee3fb6c46bd3d69bcc1565ed7fd1d5adb244cb` in an isolated Node 22 sandbox.

- Targeted WhatsApp/resume suite: 64 passed, 0 failed.
- Kompas baseline: 92 passed, 0 failed.
- `npx tsc --noEmit`: exit 0.
- Focused ESLint on the changed route and test: exit 0.
- `npm run build -- --webpack`: exit 0, including the repository prebuild gates and production webpack build.

The new mocked regression covers: accepted offline fallback clears its matching JD/resume; a newer session arriving during the send survives; and a refused Meta document send leaves the old pair intact for retry. These are source/runtime contract tests, not real WhatsApp delivery evidence.

## Exact blockers and next action

- Parent PR #303 remains DRAFT. Exact-head full CI 43097475873, WhatsApp recovery 43097475896 and Kompas baseline 43097475962 remain QUEUED. PR #310 exact-head WhatsApp recovery 43136393260 completed SUCCESS. PR #311 Plan/REA schema 43136679015 passed; PR #306 full CI 43131176244, Kompas baseline 43131176252 and Plan/REA schema 43131176205 passed. The protected preview remains unavailable while Vercel project metadata reports live=false.
- The Vercel project metadata reports `live=false`; the protected preview gate is unavailable. Do not bypass Vercel protection or alias a preview.
- The Plan/REA follow-up is recorded in a stacked documentation branch based on PR #306. It remains pending with that parent restack and the WhatsApp code stack; no documentation merge is claimed.
- The historical 17 October 17:28 Chicago incident remains unresolved: the original source DOCX and full JD are recovered, but the generated output DOCX, per-run R2 key, webhook/request correlation, Meta message ID and signed delivered/read receipt remain unavailable. Conflicting education/employment/credential facts remain quarantined pending owner reconciliation.

No model call, R2 write, email, WhatsApp send, production mutation or handset test was performed. Do not claim this fix is deployed or that the historical delivery succeeded.
