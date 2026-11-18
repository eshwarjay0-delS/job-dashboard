# WhatsApp connection and historical delivery evidence audit — 16 November 2026

## Scope

Read-only continuation of the approved October 17, 2026 17:28 Chicago WhatsApp resume-delivery incident. No message was sent, replayed, or modified. No Meta API send, DOCX generation, R2 write, production database mutation, or handset test was performed.

## Connected iZap evidence

At 2026-11-16T21:15:50Z, the connected iZap account returned one business and no linked WhatsApp numbers. The business connection is disconnected. The connection diagnosis reports:

- No connected WhatsApp Business number or phone-number ID.
- No live inbound webhook has ever been recorded.
- No Coexistence history backfill has ever been received.
- No outbound message has ever been proven to reach Meta.
- No latest Meta send error exists because no send is recorded.

Date-scoped, read-only searches were run against that business for 17 October 2026 using the `America/Chicago` timezone:

| Search term | Results |
|---|---:|
| `resume` | 0 |
| `DOCX` | 0 |

This is limited to the currently connected iZap business. It does not prove that the October 17 event never occurred through a different provider, number, WhatsApp account, webhook, or external store.

## Current source repair

PR [#433](https://github.com/eshwarjay0-delS/job-dashboard/pull/433) is a DRAFT current-master restack at exact head `6a112e42f375623197047e145eac2d08776d5ca2`. It combines two separate owner-approved behaviors:

1. Unsupported JD-only experience claims are a hard hold, including a cached result whose detail list is empty but whose quality blockers contain `unverified_jd_terms`.
2. The closest matched resume from the selected same-account library remains the approved offline failsafe; a Files/library-origin fallback is explicitly labelled **Original resume — NOT TAILORED**.

The branch does not add the separate uploaded-original-after-provider-timeout behavior and does not change Meta send semantics or quality thresholds.

Exact-head GitHub Actions results:

- Full CI: [43920312068](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/43920312068) — SUCCESS, 48 steps.
- WhatsApp resume recovery: [43920312058](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/43920312058) — SUCCESS.
- Kompas baseline: [43920312071](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/43920312071) — SUCCESS.
- Plan/REA schema: [43920312549](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/43920312549) — SUCCESS.

These are source/test results, not a real DOCX generation, live resume/JD match, Meta send, signed delivery receipt, or user-device acceptance. MFit Safe Merge Gate reviewed the branch and kept it DRAFT.

## Deployment boundary

The read-only Vercel project lookup reports `live:false`. Its latest production deployment `dpl_GMD7eF8vAw52sXyTopSuHqebEJq6` is CANCELED at master SHA `66291f677cbcc2318229ef9a3164961e6d3cdb6a`. The canonical alias `job-dashboard-fawn.vercel.app` still points to older READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`.

The owner or an authorized Vercel administrator must restore project availability. The protected preview also requires the owner-controlled private preview token through the approved secure channel. No deployment, manual alias promotion, protection bypass, billing change, or secret retrieval was attempted.

## Evidence still required to close the historical incident

- Exact original uploaded DOCX bytes or a cryptographic match to the upload.
- Generated output DOCX from the same request.
- Per-run R2 object/version and its integrity metadata.
- Request/webhook correlation for the original run.
- Meta outbound message ID (wamid) for the exact document version.
- Signed delivered/read callback or provider-side delivery history.
- Owner reconciliation of any disputed source facts.

The same-name Library DOCX found in the earlier review is not accepted as the original because its size materially differs from the approximately 28 KB, five-page file shown in the screenshot and no byte/hash match exists. No substitute was used.

## Next steps and hard blockers

1. Keep PR #433 DRAFT until the legitimate protected preview, Safe Merge Gate review of the current exact head, and deployment controls are satisfied.
2. Have the owner or authorized Vercel administrator restore the project to an available state and provide protected-preview access securely.
3. Recover the original upload, output, R2 version, request correlation and signed provider receipt from the actual provider/account. If they cannot be recovered, mark the October 17 delivery as historically unverifiable rather than successful or failed by inference.
4. Do not send or replay the old request. A separately authorized new test would be a new transaction, not proof of the October 17 event.
