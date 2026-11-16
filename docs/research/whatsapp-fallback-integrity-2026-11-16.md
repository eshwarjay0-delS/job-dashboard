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
