# MFit continuation handoff — 11 November 2026

This note records a narrow CI repair and the current crawler/WhatsApp acceptance boundary. It does not claim that either the historical WhatsApp delivery or the public application is end-to-end accepted.

## WhatsApp Kompas channel CI regression

- Canonical master at inspection: `5a9e7f84ee1d6e6095f9701bec7cc0f27a31b05a`.
- Full CI run: `43027368507`; failing job: `130545357760`, “Verify WhatsApp Kompas channel and shared-session safety”.
- Exact failure: `Cannot find module '@/lib/appOrigin'` from the custom CommonJS/VM loader in `scripts/tests/whatsapp-kompas-channel.test.mjs:84`.
- TAP summary for the channel suite: 64 passing, one file-level failure. The suite failed while importing the module, before the test cases could exercise the channel.
- Root cause: `src/lib/whatsapp-kompas-channel.ts` now imports `appOrigin` to build the same-account shared-session URL. The test harness mocked the storage, document, WhatsApp, session-store, shared-turn and Kompas modules, but omitted the new public-origin dependency.
- Test-only fix on branch `fix/whatsapp-kompas-app-origin-test-20261111`, commit `9a006a30c1e6812eafddfd9b55d2ab24bce9826f`: inject a deterministic `appOrigin()` mock and assert that the shared link includes that origin. No production source, authentication, account ownership, R2 storage, Meta delivery, voice/capture or external-send behavior changed.
- Exact-head full CI and baseline have not yet run on the new commit. The repair remains unmerged until the normal required checks pass.

## Contract crawler: schedule and production-data boundary

- The owner-approved Hobby usage pack is on master commit `5a9e7f84ee1d6e6095f9701bec7cc0f27a31b05a`. Current `vercel.json` schedules only the watchdog, Gmail cache crawl and WhatsApp recovery. `/api/crawl/run` was deliberately removed from Vercel cron because it is the heaviest 300-second job; the route remains manual-only behind `CRON_SECRET` / `WATCHDOG_CRON_SECRET`, or may later be invoked by an authorized GitHub Actions workflow.
- Read-only production Supabase query: latest `mfit_crawl_runs` row is 10 Nov 2026 11:00:24–11:01:11 UTC, 20 portals, 6,818 jobs found/upserted, one isolated error. There is no 11 Nov 11:00 UTC run. That absence is consistent with the approved cron removal; do not silently restore the cron.
- PR #276's classifier is in the current master ancestry, but there is still no post-release crawl proving its behavior against newly ingested rows. PR #291's Right To Hire / Contract To Perm C2H extension and PR #288's clearance-filter pagination remain open and are being handled by the Safe Merge Gate; this continuation does not edit their branches.
- Robert Half remains manual-only. No adapter, scrape, data rewrite, application submission or outbound request was made.

## Historical WhatsApp resume incident — 17 Oct, 17:28 Chicago

The screenshot and original source DOCX/JD have been recovered in the private evidence review, but the exact generated output DOCX, per-run R2 object key, webhook/request correlation ID, Meta message ID and signed delivered/read receipt are still unavailable. The source's education, employment chronology, tenure and credential claims conflict with owner-confirmed profile facts and remain quarantined. The 6 Nov channel-specific WhatsApp policy supersedes the former 98% hard hold. Current master `docs/resume.md` still contains older universal 95–100% wording; PR #292 carries the channel-specific wording correction and additive prebuild gate, and its exact head `44ab0006be0eed6aef64d0827c83ed0bdecc3a64` now passes full CI `42961087795`, WhatsApp recovery `42961087857`, Plan/REA `42961087787` and Kompas baseline `42961087858`. PR #292 remains draft with the Vercel project/account block unresolved, so its documentation correction is not yet on master. No historical replay, model generation, R2 write, real WhatsApp send or email was performed.

The CI harness repair above is not evidence that this historical run completed, that a generated DOCX was delivered, or that a live WhatsApp message was accepted by the handset.

## Deployment and acceptance

Vercel metadata reports deployment `dpl_4fb5qMKnQj8gk28wsbvswThYnkwQ` READY at master SHA `5a9e7f84ee1d6e6095f9701bec7cc0f27a31b05a`, with `job-dashboard-fawn.vercel.app` assigned to that deployment. Project metadata simultaneously reports `live:false`; the public health/version endpoints could not be verified from this runtime. Treat READY deployment metadata and alias assignment as distinct from public availability. No authenticated production smoke or real device acceptance is claimed.

## Next steps

1. Run exact-head full CI and Kompas baseline for the test-only branch. Merge only through the normal GitHub path after required checks and mergeability are green.
2. Restore Vercel project access through the authorized owner/provider path before any public health/version or authenticated smoke claim. Do not change billing, bypass protection or promote a preview.
3. After access is restored, run the contract crawler only through an authorized manual trigger or a separately approved scheduler; then verify the run timestamp, portal set, C2H classifications, 14-day freshness and clearance filtering from persisted results.
4. Keep the 17 Oct incident blocked until the exact output and R2/webhook/Meta signed-delivery evidence are available and the conflicting source facts are reconciled. No real WhatsApp test is authorized by this note.
5. Keep the evidence-bound writer, final-DOCX Gemini loop, Gmail multi-account/mobile acceptance, and Kompas live paired/native-device gates as separate backlog items. The Kompas Voice Delivery task owns all audio/caption changes; this branch does not duplicate them.
