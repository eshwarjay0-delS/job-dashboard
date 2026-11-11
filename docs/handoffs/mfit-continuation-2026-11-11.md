# MFit continuation handoff — 11 November 2026

This note records a narrow CI repair and the current crawler/WhatsApp acceptance boundary. It does not claim that either the historical WhatsApp delivery or the public application is end-to-end accepted.

## WhatsApp Kompas channel CI regression

- Canonical master at inspection: `5a9e7f84ee1d6e6095f9701bec7cc0f27a31b05a`.
- Full CI run: `43027368507`; failing job: `130545357760`, “Verify WhatsApp Kompas channel and shared-session safety”.
- Exact failure: `Cannot find module '@/lib/appOrigin'` from the custom CommonJS/VM loader in `scripts/tests/whatsapp-kompas-channel.test.mjs:84`.
- TAP summary for the channel suite: 64 passing, one file-level failure. The suite failed while importing the module, before the test cases could exercise the channel.
- Root cause: `src/lib/whatsapp-kompas-channel.ts` now imports `appOrigin` to build the same-account shared-session URL. The test harness mocked the storage, document, WhatsApp, session-store, shared-turn and Kompas modules, but omitted the new public-origin dependency.
- Test-only fix on branch `fix/whatsapp-kompas-app-origin-test-20261111`, commit `9a006a30c1e6812eafddfd9b55d2ab24bce9826f`: inject a deterministic `appOrigin()` mock and assert that the shared link includes that origin. No production source, authentication, account ownership, R2 storage, Meta delivery, voice/capture or external-send behavior changed.
- Exact PR #299 head `b547f11751c79aac37b16e2360dfabb210ae219a` passed full CI `43030883150`, Plan/REA schema `43030883050`, and Kompas baseline `43030883346`. The separate protected `voice-preview-smoke` run `43030877688` failed because `KOMPAS_VERCEL_API_TOKEN` is unavailable. Safe Merge Gate's 11 Nov 13:47Z decision kept the PR Draft; it also identified shared-journal overlap with this continuation. Do not merge or bypass the protected preview gate.

## Contract crawler: schedule and production-data boundary

- The owner-approved Hobby usage pack is on master commit `5a9e7f84ee1d6e6095f9701bec7cc0f27a31b05a`. Current `vercel.json` schedules only the watchdog, Gmail cache crawl and WhatsApp recovery. `/api/crawl/run` was deliberately removed from Vercel cron because it is the heaviest 300-second job; the route remains manual-only behind `CRON_SECRET` / `WATCHDOG_CRON_SECRET`, or may later be invoked by an authorized GitHub Actions workflow.
- Read-only production Supabase query: latest `mfit_crawl_runs` row is 10 Nov 2026 11:00:24–11:01:11 UTC, 20 portals, 6,818 jobs found/upserted, one isolated error. There is no 11 Nov 11:00 UTC run. That absence is consistent with the approved cron removal; do not silently restore the cron.
- PR #276's classifier is in the current master ancestry, but there is still no post-release crawl proving its behavior against newly ingested rows. PR #291's Right To Hire / Contract To Perm C2H extension and PR #288's clearance-filter pagination remain open and are being handled by the Safe Merge Gate; this continuation does not edit their branches.
- Robert Half remains manual-only. No adapter, scrape, data rewrite, application submission or outbound request was made.

## Historical WhatsApp resume incident — 17 Oct, 17:28 Chicago

The screenshot and original source DOCX/JD have been recovered in the private evidence review. A fresh read-only Library search across conversation and Library still did not surface the generated output DOCX; a date-filtered Library DOCX listing for 17–19 Oct returned no files. Gmail searches found the related recruiter/JD threads dated 16 Oct and other DOCX attachments, but no message containing the 98% hold text or a clearly matching generated output attachment. Search results are not proof that no copy exists elsewhere. The exact generated output DOCX, per-run R2 object key, webhook/request correlation ID, Meta message ID and signed delivered/read receipt are still unavailable. The source's education, employment chronology, tenure and credential claims conflict with owner-confirmed profile facts and remain quarantined. The 6 Nov channel-specific WhatsApp policy supersedes the former 98% hard hold. Current master `docs/resume.md` still contains older universal 95–100% wording; PR #292 carries the channel-specific wording correction and additive prebuild gate, and its exact head `44ab0006be0eed6aef64d0827c83ed0bdecc3a64` now passes full CI `42961087795`, WhatsApp recovery `42961087857`, Plan/REA `42961087787` and Kompas baseline `42961087858`. PR #292 remains draft with the Vercel project/account block unresolved, so its documentation correction is not yet on master. No historical replay, model generation, R2 write, real WhatsApp send or email was performed.

The CI harness repair above is not evidence that this historical run completed, that a generated DOCX was delivered, or that a live WhatsApp message was accepted by the handset.

## Deployment and acceptance

Vercel metadata reports deployment `dpl_4fb5qMKnQj8gk28wsbvswThYnkwQ` READY at master SHA `5a9e7f84ee1d6e6095f9701bec7cc0f27a31b05a`, with `job-dashboard-fawn.vercel.app` assigned to that deployment. Project metadata simultaneously reports `live:false`; the public health/version endpoints could not be verified from this runtime. Treat READY deployment metadata and alias assignment as distinct from public availability. No authenticated production smoke or real device acceptance is claimed.

## Next steps

1. Keep PR #299 Draft while the Safe Merge Gate re-evaluates its now-green exact-head CI together with the failed protected preview and shared-journal coordination. Do not weaken the gate.
2. Restore Vercel project access through the authorized owner/provider path before any public health/version or authenticated smoke claim. Do not change billing, bypass protection or promote a preview.
3. After access is restored, run the contract crawler only through an authorized manual trigger or a separately approved scheduler; then verify the run timestamp, portal set, C2H classifications, 14-day freshness and clearance filtering from persisted results.
4. Keep the 17 Oct incident blocked until the exact output and R2/webhook/Meta signed-delivery evidence are available and the conflicting source facts are reconciled. The Library/Gmail recheck did not find the generated output. No real WhatsApp test is authorized by this note.
5. Keep the evidence-bound writer, final-DOCX Gemini loop, Gmail multi-account/mobile acceptance, and Kompas live paired/native-device gates as separate backlog items. The Kompas Voice Delivery task owns all audio/caption changes; this branch does not duplicate them.


## 11 November 2026 — exact-head CI and historical artifact recheck

- PR #299 exact head `b547f11751c79aac37b16e2360dfabb210ae219a` completed full CI `43030883150`, Plan/REA schema `43030883050`, and Kompas baseline `43030883346` successfully. The separate protected voice-preview check `43030877688` failed because the private `KOMPAS_VERCEL_API_TOKEN` is unavailable. The Safe Merge Gate's 13:47Z review kept #299 Draft because the protected preview and shared-journal coordination remain unresolved. No merge or production change was made.
- A fresh read-only Library search across conversation and Library did not surface the 17 Oct generated output DOCX. A Library DOCX listing filtered to 17–19 Oct returned no files. Gmail search found related recruiter/JD threads dated 16 Oct but no 98% hold email or clearly matching generated output attachment. This does not prove that no copy exists in WhatsApp/R2 or another unindexed source.
- The historical output, per-run R2 key, webhook/request correlation, Meta message ID and signed delivered/read receipt remain missing. The original source chronology, tenure, education and credential conflicts remain quarantined. No model generation, R2 write, replay or real outbound message occurred.
- Vercel project metadata remains `live:false` despite READY deployment/alias metadata at master `5a9e7f84`. Public health/version HTTP and authenticated user acceptance are unverified. Do not change billing or unpause the project early.
