# Kompas voice: bounded Parakeet response JSON (30 October 2026)

## Source and approval
Owner-approved recurring work: improve Kompas speech capture, dictation, privacy and measurable reliability across canonical MFit and Windows packaging. Read current `src/lib/kompasSttProvider.ts` and existing provider tests at production commit `c8ef5e3d`. The current 100,000-character transcript guard runs only after `Response.json()` has read and parsed the entire upstream response. An unexpectedly large JSON response can therefore consume memory before the existing safeguard runs.

## Additive implementation
Stream the actual HTTP response with a 256 KiB maximum *before* decoding/parsing. Reject oversized provider JSON with a generic error and allow the existing Parakeet-to-Whisper fallback to recover. Reject malformed UTF-8 rather than silently replacing bytes. Existing test doubles that expose only `json()` retain their previous behavior; actual Fetch responses expose a stream. Keep the existing transcript-length/NUL checks, 4-second timeout, language and duration checks, and provider-off default. Do not log raw audio or transcript text. The limit applies to the complete upstream JSON body, not to uploaded audio.

## Regression coverage
Four new provider tests: streamed technical terminology and timing preserved, oversized JSON rejected and Whisper fallback used, exactly 256 KiB of valid JSON accepted, malformed UTF-8 rejected with fallback. These tests use in-memory synthetic response bodies and no external services. Full CI and exact-commit preview are required before merge; production must be verified independently.

## Measurement and limitations
This prevents unnecessary parsing of oversized provider JSON and preserves the existing fallback; it does **not** demonstrate lower WER, deletion rate, technical-term recall, zero-edit rate, speaker attribution or P50/P95 latency. Comparable consented audio remains necessary for those metrics. No claim of live speech or Windows microphone verification is made from unit tests. Retain the prior READY production deployment for rollback. Perfact PR #28 remains separately blocked on authenticated live smoke verification.
