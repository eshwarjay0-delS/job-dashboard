# Kompas voice upload and benchmark — 29 October 2026

## Change and ownership
The canonical MFit Kompas speech endpoint (`src/app/api/kompas/speech/route.ts`) previously called `request.arrayBuffer()` before enforcing the 4 MiB limit. A missing or dishonest Content-Length header could cause an oversized upload to be fully buffered before rejection. The endpoint now reads incrementally, rejects at the first byte over the existing limit, cancels the upstream stream, and copies accepted chunks into one exact-sized array. Authentication, per-user rate limiting, purpose/MIME checks, minimum-size checks, transcription, and the existing session-archive/consent path are unchanged.

Perfact's independent transcription route already bounds streamed bodies; its open PR #13 addresses pre-parsed bodies. Do not duplicate a separate MFit answer engine there.

## Local verification (offline, synthetic inputs only)
- `node --experimental-strip-types --test scripts/tests/kompas-audio-upload.test.mjs`: **12/12 passed** in the isolated local test harness.
- `node --test scripts/tests/voice-benchmark.test.mjs`: **15/15 passed** in the isolated local test harness.
- The existing `scripts/tests/kompas-speech.test.mjs` static contract was updated to check authentication before `readBoundedAudio` and explicit oversized rejection. Full repository CI and hosted smoke testing are required before production promotion.

## Repeatable benchmark
Run `node scripts/voice-benchmark.mjs candidate.json [baseline.json]` with a local JSON object containing `kind: "synthetic"` or `kind: "consented-deidentified"` and `samples`. Each sample includes a unique `id` when comparing to baseline, `reference`, `hypothesis`, optional `technicalTerms` (array of exact phrases), optional aligned `speakerReference` and `speakerHypothesis` arrays, and optional measured `latencyMs`. Keep utterances <=2000 words. Output is aggregate only; never commit personal audio, raw transcripts, private fixtures, or user identifiers.

Metrics: word error rate (S+D+I/reference words), deletion rate (D/reference words), technical phrase recall (matched occurrences / reference occurrences), zero-edit utterance rate, speaker attribution accuracy over aligned reference turns, and nearest-rank P50/P95 latency. Missing denominators are **null**, never zero or perfect. A paired comparison requires the exact same unique case IDs and dataset kind and returns signed candidate-minus-baseline deltas.

## Baseline and release gate
**Consented real-world baseline: NOT YET MEASURED.** WER, deletions, term recall, zero-edit rate, speaker accuracy, and live P50/P95 latency are all unavailable. The 27 offline test cases establish correctness of boundary handling and metric calculation, **not** live STT accuracy or latency improvements. No production promotion until CI, route-level behavior, and the actual Vercel deployment are verified. Preserve the current READY production deployment as rollback reference.
