# Screen capture and answer audit

Owner requests ten or fifty improvement rounds, combined capture and answering, and a production-ready product without evaluation controls in the customer flow. Interpretation: test harness stays repository-only.

Audited master b834352. Web screen endpoint is acknowledgement-only; client ignored HTTP failure. Added explicit HTTP and empty-answer failures. Ten distinct screen regressions pass; neighboring voice/intake set totals 38/38. This is one improvement iteration, not ten or fifty rounds.

Sources: public/kompas/app.js (analyseScreen), src/app/api/kompas/screen/route.ts. The frontend sends image, preparation and config together, but the MarketFit endpoint does not interpret the image. Desktop backend behavior has not been verified in this change. Do not label the combined feature complete.

Connect authenticated image analysis to the answer engine in coordination with the separate desktop voice work. Verify the native capture bridge, real image interpretation, permission cancellation and installed desktop release. No live vision run or deployment claimed.


26 October continuation: implemented authenticated image extraction through the permitted kompas:screen OpenRouter key (default google/gemini-2.5-flash; OPENROUTER_MODEL_SCREEN override). Extracted questions enter the existing grounded answer engine. Added bounded request size, format checks, no-question/truncation failures, provider deadline, usage-only ledger, duplicate-click exclusion, frame cleanup and stale-session rejection. 52 screen-specific checks and 83 final focused checks pass; full suite before the final stale-session guard passed 1106/1106; TypeScript passes. These are three implementation increments including the earlier error-handling commit, not fifty improvement rounds. No live image/model or Windows acceptance. Preview publication next.

Provider protocol reference: https://openrouter.ai/docs/guides/overview/multimodal/image-understanding ; model reference: https://openrouter.ai/google/gemini-2.5-flash (reviewed 26 October). No copied media or private screenshots included. The prior acknowledgement-only finding describes the baseline and is superseded by the implementation above. Remaining release gates: authenticated screenshot-to-answer trial and Windows installed app verification, including the separate native release owner.


Owner clarification, 26 October: distill question regions from screen clutter with Gemini, preserve coding constraints and diagrams, assemble scrolled sections explicitly, and answer separate single/multiple-choice tasks with original labels and explanations. Implemented structured bounded task extraction (eight regions maximum), cropped previews, selectable questions, explicit continuation with overlap deduplication and conflicting-option rejection, incomplete-context confirmation, and memory-only session-scoped drafts. No generation occurs on collect/cancel. Answer requests preserve screen code and constraints instead of speech cleanup; selected MCQs receive per-question option/explanation instructions. Screen retries preserve their source; concurrent answering during review is not aborted or unlocked. Tests: 91 screen cases plus 17 neighboring voice cases pass (108 total); prior full suite passed 1144/1144 before the final review concurrency fixes; intermediate route/asset/screen set 143/143. TypeScript passes. PR #82 initial preview succeeded at 1389b563; latest expanded selection flow still awaiting publication. No live OCR/model accuracy, rendered browser or installed Windows acceptance. KOMPAS_API_TOKEN is absent from this runtime; authenticated live trial and Windows runtime access remain required. Native desktop voice/release changes were not duplicated.


### Current interaction and acceptance gates

1. Analyse screen captures the user-selected display/window through the existing capture path. Gemini on OpenRouter locates task regions using text and visual context.
2. Review shows cropped previews and extracted text; irrelevant regions can be unchecked. No screenshot or extracted draft is persisted by this feature.
3. Keep sections; capture more stores selected task text in memory. After scrolling, another explicit capture can append to the last task, or add separate tasks. No scroll event auto-generates an answer.
4. Answer selected sends the assembled questions/options through the current grounded answer engine. Unreadable/ambiguous extraction is surfaced; missing options are never invented. The model instructions require original option labels plus reasons. Offline tests prove the contract, not model correctness.
5. Full product release acceptance requires real screenshots across MCQ/coding/diagram/paragraph cases, OCR and crop relevance review, measured extraction/answer latency, and the installed Windows capture path. This worktree has no native Windows runtime or authenticated evaluation token. Preview may be tested without claiming final-product readiness.

The MarketFit assets now include screen-core.js and screen-review.js in the runtime manifest. The older sync-kompas script can overwrite the self-hosted app; port these changes deliberately when synchronizing the separate native repository. No native installer is built by this PR.


Release reconciliation: expanded screen-review implementation b90c962 completed 1150/1150 offline regression checks. Merged concurrent master 0d1c3d3, retaining the other developer's numbered hypotheses, design alternative and director opening calibration. Screen tasks explicitly control their task-specific format so MCQs do not inherit an unrelated director opening or personal story. Combined revision 8853e64 passes 144 focused checks and TypeScript. PR #82 preview refresh follows; production promotion remains pending live OCR and Windows acceptance.


### Desktop Screen Answer visibility — 27 October
The owner's desktop screenshot reported the screen-capture answer button absent. Source audit found the real cause in `public/kompas/app.js`: desktop setup unconditionally hid `screenBtn`; the audio-disabled branch also hid it. The desktop's preloaded Electron bridge already exposes `kompasDesktop`, and the installed MarketFit shell loads `https://job-dashboard-fawn.vercel.app/kompas/index.html`. A separate native installer is not intrinsically required for an HTML/JS control fix. The web capture model and any actual Windows capture accuracy still require verification.

Branch `fix/kompas-desktop-screen-action-20261027` removes the suppression, restores the ⋯ / Analyse screen menu item, and puts `▣ Screen Answer` immediately after AI Answer in the desktop live toolbar. The button reuses `analyseScreen`: manual full-display screenshot (or existing live track), server region extraction, user review/selection, then the grounded answer engine. It does not create a second vision model or bypass the existing region-review consent. Audio controls remain independent. `scripts/tests/kompas-desktop-screen-action.test.mjs` guards the control, handler and flow. Test results and final deployment must be recorded after execution; nothing in this entry alone proves the user's installed Windows screen works.
