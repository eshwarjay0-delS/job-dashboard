# WhatsApp 17 October 2026 17:28 Chicago — evidence follow-through

## Scope

Read-only continuation of the owner's unresolved WhatsApp resume incident. The screenshot is private Library evidence and is not copied into the repository. No historical replay, outbound message, DOCX generation, R2 write, Meta request, production mutation or handset test occurred.

## Direct screenshot evidence

A private Library screenshot item captured at **2026-10-17T22:28:39Z (17:28:39 America/Chicago)** shows a job-description excerpt and an uploaded five-page DOCX of approximately 28 KB. The bot then stated that automatic repair had not reached the then-98% coverage target and that it had held the file, listing remaining JD terms.

This is direct evidence of a **hard hold**, not a successful document delivery. The owner correction at 2026-11-14T15:44:16Z likewise identifies the attempt as a hard hold after automatic repair, not a successful delivery. It does not show an outbound DOCX attachment, a Meta message ID, a delivered/read receipt or the exact reason the quality gate held the file. The remaining-term list alone does not establish whether each item was simply missing from the resume or was an unsupported addition.

The 98% wording is historical. It must not be treated as the current WhatsApp delivery rule. The repository-recorded 6 Nov policy and the explicit 14 Nov correction supersede it: supported completed shortfalls are handled separately, while unsupported JD-only experience/credential claims remain a hard hold. Never invent certifications, experience, employers, dates, metrics or outcomes.

## Accessible Library evidence

The Library listing for 16–21 October contains the screenshot and other resume documents. The 10 Nov research record `docs/research/whatsapp-resume-acceptance-2026-11-10.md` documents prior recovery of the exact input DOCX (27,724 bytes; private digest verified) and the full JD from the matching forwarded inbox message. The current Files tool could not re-resolve that nested archive path or re-hash the bytes in this run, so this remains historical evidence rather than a fresh byte-level match to the screenshot upload. The screenshot's five-page/~28 KB metadata is consistent but not a cryptographic match. The generated output DOCX remains missing.

The recovered JD was classified in that 10 Nov record: CCSP/CISM/CRISC/CISA/AWS Security Specialty are certifications, Canton/Solana are unsupported preferred platforms, `sol` is a Solana fragment, and `attributes` is generic extraction noise. Current `src/lib/keyword-targets.ts` and `scripts/tests/keyword-targets.test.mjs` exclude those items from candidate experience claims. PR #273 merged at `a66c108bff6175149c4aadd882ab11128445b8cc`; GitHub ancestry confirms current production alias SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd` is 37 commits ahead and zero behind that merge. The screenshot-term correction is therefore included in the live alias, but it does not prove the 17 Oct run produced or delivered a final DOCX.

This is limited to the accessible Library and prior repository recovery record. It does not prove that an output is absent from another provider, external store or device.

## Current WhatsApp connection evidence

Read-only iZap checks at **2026-11-17T20:46:48Z** found one business and no linked WhatsApp Business number. Registration is disconnected; no live inbound webhook, history backfill or outbound send has ever been proven for that connected business. Date-scoped searches for `resume` and `DOCX` on 17 October 2026 in `America/Chicago` each returned zero messages.

This only describes the connected iZap business. It does not prove that the historical event never occurred through a different number, provider, WhatsApp account, webhook or external store.

## Source correction for the screenshot terms

The false-positive/noise correction is not a new pending code change. PR #273 is merged at `a66c108bff6175149c4aadd882ab11128445b8cc`, and the current production alias is a descendant of that merge. The current source and regression tests classify the screenshot's certification names as credentials rather than candidate experience and filter `sol`, `specialty` fragments and generic `attributes` noise from match targets. The 17 Oct 98% hard-hold message remains historical; the 6 Nov channel policy and 14 Nov unsupported-JD hard hold are the current rules.

## Current source repair

PR [#433](https://github.com/eshwarjay0-delS/job-dashboard/pull/433) remains DRAFT at exact head `a693cef8f33a72501c769315311aa48e43b037c2`. It implements the 14 Nov hard hold for unsupported JD-only claims and the 27 Oct approved closest matched same-account library fallback, labelled **Original resume — NOT TAILORED** only when that library file is sent. Exact-head full CI `43959332261`, WhatsApp recovery `43959332295`, Kompas baseline `43959332407` and Plan/REA `43959332597` passed. These are source/test results only; the PR is not merged, previewed, deployed or delivery-verified.

PR #411's uploaded-original-after-provider-timeout behavior remains a separate owner-decision gate. PR #427's whole-message hold proposal remains separate and unapproved.

## Production release boundary

The Vercel `job-dashboard` project metadata reports `live:false`. Latest production deployment `dpl_GMD7eF8vAw52sXyTopSuHqebEJq6` is CANCELED at master SHA `66291f677cbcc2318229ef9a3164961e6d3cdb6a`. Its build events show the configured Ignored Build Step exited 0 with `Skipped: no [ship] tag` and explicitly canceled the deployment before an application build; this is not a build failure. The project response did not identify a pause reason. The canonical alias `job-dashboard-fawn.vercel.app` remains on older READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. No deployment, project unpause, billing change or protection bypass was attempted.

No project unpause is authorized here. A future production release must use the normal reviewed Git-linked `[ship]` path after the task-specific acceptance gates pass. The legitimate protected preview also requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN` through its approved secure channel; this run cannot retrieve it or bypass protection.

## Exact blockers and next action

To close the historical incident, recover the exact uploaded DOCX bytes, generated output DOCX, per-run R2 object/version, request/webhook correlation, Meta outbound message ID and signed delivered/read receipt from the correct owner-authorized provider/number, then reconcile disputed candidate facts with the owner. Do not replay or resend the historical request.

For the source repair, restore Vercel project availability and provide the protected-preview token through the authorized channel; then let MFit Safe Merge Gate review #433 and verify the intended production SHA/alias before any owner-consented acceptance. No live 95–100% resume match, Meta delivery or native device acceptance is claimed.


## Additional accessible-file search — 17 November 2026, 23:03 UTC

A semantic search across the accessible current conversation and Library for the 17 Oct 17:28 WhatsApp resume output did not identify a matching generated DOCX or delivery receipt. A metadata-only Library listing restricted to DOCX/PDF created between 2026-10-17T00:00:00Z and 2026-10-18T00:00:00Z returned zero items. The semantic search returned unrelated tailoring/reference files; none is accepted as the incident output. This is a bounded search of accessible sources, not proof that every prior chat, external provider archive or WhatsApp account was searched.

The historical screenshot still proves a hard hold after automatic repair. The exact generated output DOCX, per-run R2 key/version, request/webhook correlation, Meta outbound message ID and signed delivered/read receipt remain unavailable. No replay, resend, R2 write, model call or real test message occurred.

The latest canonical master remains `66291f677cbcc2318229ef9a3164961e6d3cdb6a`. PR #433 remains a green source-tested DRAFT; PR #431 remains a green source-tested DRAFT. Neither has a legitimate protected preview or production release. The latest production attempt was canceled before build because the Git-linked Ignored Build Step skipped a commit without `[ship]`; this does not establish a project pause reason. The owner-controlled private `KOMPAS_VERCEL_API_TOKEN` remains unavailable to this run.



## Additional read-only iZap and production recheck — 18 November 2026, 03:46 UTC

The connected iZap account lists one business and no linked WhatsApp Business number. Its read-only connection check reports disconnected registration, no live inbound webhook, no history backfill and no outbound send proven. A date-scoped search for 17 October 2026 in `America/Chicago` returned zero messages.

This is evidence only about that disconnected iZap business. It does **not** prove that the owner's personal WhatsApp, Meta WhatsApp Manager, another business number, a different provider or an external archive has no record. No message was sent, changed, replayed or downloaded.

The same recheck confirms canonical master `f5f7f105eb58ab0e964031ee453ba5a9f9201f43`; Vercel project `job-dashboard` reports `live:false`; latest production deployment `dpl_7xExEMJyGkWJJTEgqE8DwXAhtKRf` is CANCELED on that exact SHA because the Ignored Build Step printed `Skipped: no [ship] tag`; and the canonical alias remains READY on older SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. No unpause, preview bypass, billing change or deployment occurred.

Seven-day production aggregation shows 15 WhatsApp quality-gate rejections across 13 users, latest 16 November 2026 15:02:15 UTC. Sampled events have 100% supported coverage but are partial/incomplete, with missing draft parts and role rewrites; they do not establish completed DOCX delivery. The same window returned no grouped Gmail runtime errors, which does not prove fresh synchronization.

The generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound message ID and signed delivered/read receipt remain unavailable. The incident stays open. Recover those artifacts from the correct authorized provider/number and reconcile the source facts with the owner; do not replay or resend.
