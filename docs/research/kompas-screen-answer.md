# Screen capture and answer audit

Owner requests ten or fifty improvement rounds, combined capture and answering, and a production-ready product without evaluation controls in the customer flow. Interpretation: test harness stays repository-only.

Audited master b834352. Web screen endpoint is acknowledgement-only; client ignored HTTP failure. Added explicit HTTP and empty-answer failures. Ten distinct screen regressions pass; neighboring voice/intake set totals 38/38. This is one improvement iteration, not ten or fifty rounds.

Sources: public/kompas/app.js (analyseScreen), src/app/api/kompas/screen/route.ts. The frontend sends image, preparation and config together, but the MarketFit endpoint does not interpret the image. Desktop backend behavior has not been verified in this change. Do not label the combined feature complete.

Connect authenticated image analysis to the answer engine in coordination with the separate desktop voice work. Verify the native capture bridge, real image interpretation, permission cancellation and installed desktop release. No live vision run or deployment claimed.


26 October continuation: implemented authenticated image extraction through the permitted kompas:screen OpenRouter key (default google/gemini-2.5-flash; OPENROUTER_MODEL_SCREEN override). Extracted questions enter the existing grounded answer engine. Added bounded request size, format checks, no-question/truncation failures, provider deadline, usage-only ledger, duplicate-click exclusion, frame cleanup and stale-session rejection. 52 screen-specific checks and 83 final focused checks pass; full suite before the final stale-session guard passed 1106/1106; TypeScript passes. These are three implementation increments including the earlier error-handling commit, not fifty improvement rounds. No live image/model or Windows acceptance. Preview publication next.

Provider protocol reference: https://openrouter.ai/docs/guides/overview/multimodal/image-understanding ; model reference: https://openrouter.ai/google/gemini-2.5-flash (reviewed 26 October). No copied media or private screenshots included. The prior acknowledgement-only finding describes the baseline and is superseded by the implementation above. Remaining release gates: authenticated screenshot-to-answer trial and Windows installed app verification, including the separate native release owner.
