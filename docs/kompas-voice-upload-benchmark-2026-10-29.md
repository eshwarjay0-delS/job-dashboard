# Kompas voice upload and benchmark — 29 October 2026

## Canonical endpoint improvement
The MFit Kompas speech endpoint (`src/app/api/kompas/speech/route.ts`) previously called `request.arrayBuffer()` before enforcing the 4 MiB limit. A missing or dishonest Content-Length could force buffering an oversized upload before rejection. The endpoint now reads incrementally, rejects at the first byte over the existing limit, cancels the upstream stream, and copies accepted chunks into one exact-sized array. Authentication, per-user rate limiting, purpose/MIME checks, minimum-size checks, transcription, and existing consent/session archive behavior are unchanged.

Perfact's independent transcription route already bounds streamed bodies; its open PR #13 addresses pre-parsed bodies. The canonical engine remains MFit Kompas.

## Verification
- `node --experimental-strip-types --test scripts/tests/kompas-audio-upload.test.mjs`: **12/12 passed** in an isolated local test harness (synthetic byte streams).
- Existing `scripts/tests/kompas-speech.test.mjs` static contract updated to require authentication before the bounded read and explicit oversize rejection.
- The existing `scripts/kompas-voice-metrics-core.mjs`, `scripts/kompas-voice-metrics-report.mjs` and `scripts/tests/kompas-voice-metrics.test.mjs` are the **single canonical offline benchmark**. No duplicate metric implementation was retained.
- New reference-set SHA-256 binds reference text, technical terminology and reference speaker labels to each ID. Comparisons reject changed reference data and legacy baselines lacking this fingerprint.
- Full CI, hosted preview smoke, and a consented real-audio baseline remain mandatory before production promotion.

## Offline aggregate benchmark
Run `node scripts/kompas-voice-metrics-cli.mjs candidate.json [baseline-aggregate.json]`. Candidate JSON must include `datasetId`, `revision` and a nonempty `samples` array. Each sample needs a unique `id`, `consent:true`, `reference`, `hypothesis`, and optionally `technicalTerms` (array), `editCount`, `referenceSpeaker`, `predictedSpeaker`, and measured `latencyMs`. Keep clips <=500 words; split long recordings. Never commit private fixtures or audio.

The aggregate-only output includes WER, deletion/substitution/insertion rates, technical-term recall, zero-edit rate (only when editCount is supplied), speaker attribution accuracy (only with both labels), silence hallucination rate, and P50/P95 latency. Missing denominators are null. To compare, use a baseline aggregate generated with the same dataset ID, revision, sample IDs, **and reference-set fingerprint**. Candidate-minus-baseline deltas are computed only after validation. No raw transcript, audio or speaker identity appears in the report.

## Baseline and release gate
**Consented real-world baseline: NOT YET MEASURED.** WER, deletion rate, technical recall, zero-edit rate, speaker attribution, and live P50/P95 latency are unavailable for this change. Synthetic upload tests measure boundary correctness, not live accuracy or latency. Keep production unchanged until full CI and the deployed route are verified. Preserve the latest READY production deployment as the rollback reference.

## 30 October 2026: comparable measurement-label coverage

A reference-set fingerprint alone is insufficient for fair before/after comparisons. If a candidate removes latency from a slow clip and adds latency to a fast clip, the sample IDs, reference text and total latency-label count can remain identical while P95 appears to improve. The same issue affects edit and speaker-label coverage.

The aggregate evaluator now also emits `measurementSetSha256`, a SHA-256 of **sample IDs and booleans for availability** of latency, edit-count and speaker-attribution labels. No transcript, speaker name or audio is included in this fingerprint. Baseline comparison rejects changes in per-sample measurement-label availability, mismatched coverage totals and malformed/nonfinite baseline metrics. Older aggregate baselines without this new fingerprint must be regenerated from the **same consented recordings**; never fabricate a matching fingerprint. Actual accuracy and latency deltas remain **not measured** until paired consented baseline/candidate data exist.

Regression scenarios cover swapped latency/edit/speaker labels, valid changes in measured values with stable coverage, missing fingerprints, altered coverage and invalid baseline metrics. This changes only the offline evaluator and does not alter speech capture, model selection, user consent, session archiving, or production transcription.
