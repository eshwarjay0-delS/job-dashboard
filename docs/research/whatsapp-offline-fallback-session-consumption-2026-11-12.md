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


## Current-master lifecycle integration — 12 November 2026, 09:35 UTC

The owner-approved 6 Nov fallback/no-baseline policy is restacked in current-master PR #321. This continuation also integrates the race-safe pair-consumption helper from the old stacked PR #316 into #321, so the fallback and lifecycle fix can be reviewed together.

- Code commit: `921033d71fba5f33e0d5566bde572be7287baf8b`.
- Regression commit: `ed15c9782e7d71c9340a04a718f8b36821f58fa2`.
- The helper clears the JD and resume only when both still match the run; it preserves a newer JD/resume combination and retains the pair when Meta rejects the document.
- New mocked cases cover accepted offline consumption, newer JD, same resume/new JD, same JD/new resume and rejected-send retention.
- Updated PR head: `ed15c9782e7d71c9340a04a718f8b36821f58fa2`. Exact-head Kompas baseline 43193485006 and WhatsApp recovery 43193485660 are SUCCESS; full CI 43193485035 is still IN_PROGRESS at migration asset closure. Earlier `ac38ff` full CI results do not validate the new head.
- The previous protected preview 43191231435 failed closed because the private `KOMPAS_VERCEL_API_TOKEN` was empty. No exact-head preview pass, merge, production deployment, model call, R2 write, real WhatsApp message or Meta callback is claimed.

The canonical production alias remains READY at master `da1db145c5981254f95620ff6bb0222ab4228125`, not this PR. Vercel project metadata reports `live=false`. The historical 17 Oct 17:28 Chicago output DOCX, per-run R2 key, webhook/request ID, Meta message ID and signed delivered/read receipt remain unavailable. No replay or resend is authorized.

**Continue:** finish exact-head full CI 43193485035; then keep PR #321 DRAFT until an authorized repository administrator privately configures the preview token and the protected preview passes. Only then review/merge, deploy the exact merged SHA, verify the active production alias and perform a consented real WhatsApp acceptance. PR #316 is now a source/history dependency and must not be merged independently; close it as superseded only after PR #321 is accepted.


## 12 November 2026 — 10:05 UTC exact-head continuation

PR #321 current head is `b5b418905906e925cacba1772a011457d9a5db03`. Exact-head full CI `43196332095`, WhatsApp recovery `43196332031`, and Kompas baseline `43196332103` all completed SUCCESS. No exact-head protected-preview pass is recorded; the previous preview attempt `43191231435` failed closed because the private `KOMPAS_VERCEL_API_TOKEN` was empty. Keep the PR DRAFT and do not bypass the protected resolver.

The no-provider path is a best-match fallback, not a random file: `fromLibrary` calls `pickAndMake`, which calls the same `chooseResume` selector used by the normal library path with the authenticated user directory, selected email and JD. The fallback then sends only the exact selected library original after root, relative-path, byte-equality and profile-email checks, with the explicit caption **Original resume — NOT TAILORED**. It does not write a tailored document or claim that AI edits occurred. The pair-consumption helper clears only the JD/resume pair that still matches the run, after Meta returns a document message ID; a newer JD/resume pair is preserved and a rejected send retains the old pair. The failed swipe-refinement path remains text-only and keeps the last delivered version.

No real WhatsApp send, model call, R2 mutation, Meta callback or handset acceptance occurred. The 17 Oct 17:28 Chicago generated output DOCX, per-run R2 key, webhook/request ID, Meta message ID and signed delivered/read receipt remain unavailable. The current production alias remains READY on master `da1db145c5981254f95620ff6bb0222ab4228125`, not PR #321.


## 12 November 2026 19:55 UTC — exact-head status

PR #321 is at `2d642ffb5acc37c1066a070ab182bd461112d3b3`. Full CI `43292088241`, Kompas baseline `43292088358` and WhatsApp recovery `43292088573` are SUCCESS. The PR remains DRAFT because the protected preview prerequisite is unavailable; it is not deployed and no real WhatsApp message was sent.

The 6 November channel-specific correction is authoritative over the earlier broad “closest library match” idea: an initial JD/no-provider fallback may use only the exact selected original from the same authenticated account after identity/path/byte validation, clearly labelled **NOT TAILORED**. Do not choose an unselected or cross-library best match. Swipe-refinement failure remains text-only and must not silently reuse or send a stale pair.
