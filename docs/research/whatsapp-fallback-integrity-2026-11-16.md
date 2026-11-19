# WhatsApp fallback integrity — 16 November 2026

## Purpose

Keep two owner-approved behaviors distinct but consistent at the same WhatsApp resume fallback boundary:

1. **14 November hard hold:** unsupported job-description-only experience claims must not be delivered as a tailored resume or labelled as an acceptable shortfall.
2. **27 October offline failsafe:** when tailoring cannot safely produce a usable document, use the closest matched resume from the current user's selected library, not another account's file.

The hard hold does not revoke the existing supported-shortfall policy. A completed readable rewrite with only disclosed coverage gaps can still follow the current WhatsApp channel rules. A draft that adds unsupported JD-only claims must not be sent as that rewrite.

## Approval provenance

- 27 October 2026, 15:14:08 UTC: accessible prior conversation retrieval recovered the owner's direct instruction: “Continue until done; even offline, give the closest matched resume from the user's library as failsafe.”
- 14 November 2026: accessible owner-authored context confirms unsupported JD-only experience claims are a hard hold.
- The 27 October approval does **not** authorize sending the exact uploaded DOCX unchanged after a provider timeout. PR #411 remains a separate owner-decision gate.
- The whole-message hard-hold interpretation in PR #427 remains separate and is not included here.

## Source findings

Canonical master at the time of this restack was `66291f677cbcc2318229ef9a3164961e6d3cdb6a`.

The WhatsApp shortfall allowlist still included `unverified_jd_terms`. `whatsappRewriteUsable` also needed an explicit fail-closed check for a legacy/cached result whose detail list is empty while `quality_blockers` still contains `unverified_jd_terms`.

The fallback caption did not explicitly distinguish an untouched Files/library document from a tailored DOCX. That could make an original library file look like a completed tailored output.

## Implementation on PR #433

Branch: `fix/whatsapp-fallback-integrity-master-66291-20261116`

Code/test commit: `1b520b9e84438ea47bfbd8c65835c210464df588`

- Remove `unverified_jd_terms` from the shortfall allowlist.
- Reject non-empty unsupported additions and blocker-only cached results.
- Keep supported completed shortfalls and the existing numeric coverage rules unchanged.
- Add `Original resume — NOT TAILORED` only when the selected Files/library record is the source of the fallback.
- Keep the label off completed tailored DOCX outputs.
- Separate the supported low-coverage fixture from the unsupported-term hard-hold fixture.
- Exercise the actual webhook fallback path with a synthetic account/profile and verify that the selected library bytes are sent instead of the unsafe generated rewrite.

## Regression scope

- Acceptance-level tests cover unsupported additions, blocker-only cached results, and exclusion from shortfall delivery.
- Webhook integration covers a supported disclosed shortfall, unsupported-term fallback, provider failure/incomplete fallback, role-rewrite fallback, and account/profile isolation.
- Source-contract coverage verifies that the label is gated by the Files/library marker.
- Fixtures use synthetic identities and reserved example/test contact data only.

## Verification and release state

- PR #433 remains DRAFT.
- Exact-head full CI, WhatsApp recovery, Kompas baseline and Plan/REA schema must complete on the final head.
- MFit Safe Merge Gate review is a separate required step.
- The owner-controlled protected-preview credential `KOMPAS_VERCEL_API_TOKEN` is unavailable to this run; no preview bypass was attempted.
- Vercel project metadata reports `live:false`; the latest production deployment is CANCELED. The older READY alias metadata is not proof that this branch or current master is publicly live.
- No local npm test/build, model call, DOCX generation, R2 write, Meta request, real WhatsApp message, production mutation, historical replay or handset acceptance occurred.

## Historical 17 October incident

The 17 October 2026 17:28 Chicago event remains unverified. The generated output DOCX, per-run R2 object/version, request/webhook correlation, Meta outbound message ID, signed delivered/read receipt and owner reconciliation of candidate facts are still missing. Do not replay or resend the historical event, and do not infer delivery from the recorded model-use event.

## Next action

Complete exact-head CI and WhatsApp recovery for PR #433, then obtain MFit Safe Merge Gate review. Keep the PR DRAFT until legitimate protected preview and production READY/alias verification are available. Only after release should authenticated, owner-consented delivery acceptance be considered; no real outbound test is authorized in this task.


## 18 November 2026 — upload-only fallback containment

Owner review on PR #433 found that the fallback helper was reachable for uploaded-resume runs when no Files/library selection existed. The route's `sendClosest()` used `session.resumePath` for provider timeout, quality rejection and other failures; `chosenResumeMatchesProfile(text, undefined)` returned true. The owner independently compared current master `f5f7f105eb58ab0e964031ee453ba5a9f9201f43` with production alias SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`; both had the same route blob `7ec8dd7727ca454bde76ad794f921b2206efae82` and helper blob `8b7781b8b2aa9dedf67641e68e083d5b3d73632b`. This is a source-level policy risk, not evidence of an actual send.

PR #433 code commit `b70201f29b539fd3c6b37aad69f4c678a3c6957b` corrects the boundary:

- A fallback requires an explicit `files` selection with a non-empty selected email, account root and absolute file path.
- The selected file path must exactly equal the resume path used by the run.
- The selected path must remain inside the selected account's library root.
- A missing/empty selected email is rejected by `chosenResumeMatchesProfile()`.
- The approved same-account selected-library fallback remains available and keeps its **Original resume — NOT TAILORED** label. The uploaded-original-after-timeout behavior remains unapproved and is not added.

New synthetic regressions cover upload-only provider timeout, upload-only unsupported-JD hard hold, selected-path mismatch, and missing/empty email. Existing same-account library fallback cases remain. On exact code head `b70201f29b539fd3c6b37aad69f4c678a3c6957b`, Kompas baseline run [44295809959](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44295809959) and Plan/REA schema run [44295809871](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44295809871) passed; full CI [44295810009](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44295810009) and WhatsApp recovery [44295809782](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44295809782) were still in progress at the last check. PR #433 remains DRAFT pending exact-head gates, Safe Merge Gate review, protected preview and production release.

Vercel project metadata reports `live:false`; latest production deployment `dpl_7xExEMJyGkWJJTEgqE8DwXAhtKRf` is CANCELED at master `f5f7f105eb58ab0e964031ee453ba5a9f9201f43`. The canonical alias still points to older READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3` at `b94e1629c544048d84a2b048ae83b21b612ab9dd`. Protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`; no deployment, protection bypass or billing change was attempted.

The 17 October 17:28 Chicago event remains historically unverified: exact output DOCX, per-run R2 object/version, request correlation, Meta message ID and signed delivery/read receipt are still missing. No real message, replay, model call, DOCX generation, R2 write, production mutation or handset test occurred.

## 18 November 2026 — exact-head typecheck correction

The upload-only fallback containment remains the intended approved behavior. The first exact-head check after the 18 Nov route/helper review exposed two compile regressions on PR #433 head `189320c77d8cf5004442364c4aca49e019900808`: `src/app/api/whatsapp/webhook/route.ts` referenced `IN_FLIGHT_MS` after the 300,000 ms declaration had been dropped from the restacked route, and `src/lib/whatsapp-resume-recovery.ts` compared `deliveryState` with `delivered`/`read` a second time after the earlier terminal guard had already narrowed those states. Full CI `44385137113` and WhatsApp recovery `44385136925` failed on those TypeScript errors; Kompas baseline on that head passed.

Corrective commits on the same review branch:

- `770de26af25744334e801dc0091530ac1dac7fa6` restores the 300,000 ms in-flight lease constant without changing the route's existing 300-second function ceiling
- `ea01770d30d12a54e42a0ec0a46028b98eb608c7` keeps the terminal delivered/read guard and narrows the later pending-retry guard to accepted/sent, preserving duplicate-send protection
- `d50aea28148a85b522db522ca80cc08956ed4254` adds a regression proving a Meta `sent` callback cannot be reset to `pending` by a late retry

At exact head `d50aea28148a85b522db522ca80cc08956ed4254`, Plan/REA `44387330710` passed; full CI `44387330363`, WhatsApp recovery `44387330423` and Kompas baseline `44387330621` were still running at the last read. No local test/build is claimed because the environment cannot resolve `github.com` for a checkout. PR #433 remains DRAFT pending all exact-head gates, Safe Merge Gate review, legitimate protected preview and production READY/alias verification. Vercel project metadata still reports `live:false`; the latest production deployment is CANCELED and the canonical alias remains on older READY SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. The owner-controlled protected-preview token is unavailable. No deployment, real Meta send, DOCX generation, R2 write, production mutation or historical replay occurred.

## 18 November 2026 20:12 UTC — current-master restack

PR #433 was fast-forward restacked onto canonical master `f5f7f105eb58ab0e964031ee453ba5a9f9201f43` as merge commit `61d545ffb3bf3801d04ffac454739c580f4ad3d7`, preserving its exact code/test head `d50aea28148a85b522db522ca80cc08956ed4254`. On the restacked head, WhatsApp recovery `44388132693`, Kompas baseline `44388132609` and Plan/REA `44388132554` passed; full CI `44388132566` remained in progress. The source/test changes are unchanged by this restack. Keep the PR DRAFT pending full CI, Safe Merge Gate review, protected preview and production READY/alias verification. Vercel project `live:false`, latest production deployment CANCELED, owner-controlled protected-preview token unavailable. No live send, replay, DOCX generation, R2 write or production mutation.

## 18 November 2026 20:22 UTC — atomic recovery store verification

The deterministic lost-update finding recorded in PR comment `6989061230` applied to predecessor head `f409ca5ebb79124f65642e498ecdd9334f970dd8`. The branch subsequently added ETag compare-and-swap in `b04dd14b8ff1fc76588fac5967978a7f049433a4`, corrected the R2 adapter/attempt fencing in `f83295dad1e3ae200c1cfbb1e615c730e0b23ecc` and `c43d8c5b49af80f81ebe21f7cbbb615dac6e8941`, and retained callback attempt correlation in `189320c77d8cf5004442364c4aca49e019900808`. `updateResumeRecovery` now reads `{data, etag}`, then commits through `PutObject If-Match`; a failed precondition causes a fresh read/re-evaluation, not a stale overwrite.

**Provider semantics verified from official documentation (18 Nov 2026):** Cloudflare R2's [Conditional operations](https://developers.cloudflare.com/r2/api/s3/conditional-operations/) lists `If-Match` for `PutObject` and states that the condition is checked atomically at commit. Its [Consistency model](https://developers.cloudflare.com/r2/reference/consistency/) says conditional writes are evaluated against committed bucket state and competing writes are serialized. The adapter preserves the opaque quoted ETag returned by `GetObject` and passes it unchanged as `IfMatch`. Unit coverage checks the exact header, a 412 precondition conflict, missing ETag fail-closed behavior, and visibility of other storage errors. No live R2 write was performed.

Vercel project metadata has R2 env entries `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` for production and preview; values were not decrypted or inspected. `storageMode` chooses R2 only when all four are non-empty and returns `unavailable` on Vercel for partial configuration. The local filesystem adapter uses a per-process key lock only; production multi-instance atomicity relies on R2.

New deterministic interleaving tests on commit `08f5c1f71aa01b29f63ffbbd5eb7cb6f213858e6` cover: two workers paused on the same ETag (one claim winner), a signed failed callback racing an in-flight HTTP acceptance, an old delivered callback racing a newer retry acceptance, and a delivered callback racing a stale defer after a prior Meta failure. The earlier stale-retry write test remains. Exact-head WhatsApp recovery `44389751909` and full CI `44389751945` were running; Kompas baseline `44389752006` and Plan/REA `44389751900` passed.

Release remains blocked: Vercel project reports `live:false`; latest production deployment `dpl_7xExEMJyGkWJJTEgqE8DwXAhtKRf` is CANCELED by `ignored-build-step`; canonical alias still points to READY SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`; project env metadata does not contain `KOMPAS_VERCEL_API_TOKEN`. No deployment, real WhatsApp send, historical replay, DOCX generation, R2 mutation or production write occurred.
