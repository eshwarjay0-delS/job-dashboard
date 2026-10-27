# WhatsApp voice messages → MFit Kompas (2026-10-27)

## User path
1. User records a WhatsApp voice message or taps their phone keyboard's microphone for direct speech-to-text.
2. WhatsApp Cloud API delivers a signed message with `type: audio` and a media ID **after Send**. The recipient's device-side voice-note transcription is **not** available to webhook integrations.
3. MFit verifies sender identity, claims the original WhatsApp message ID once, downloads a bounded audio file through authenticated Meta CDN requests and runs the **existing** `kompas:transcribe` speech provider.
4. Its corrected transcript is turned into a virtual ordinary text message with the **same** original ID and owner, so `kompas`, `revert`, `help`, JD intake, resume preparation, and interview answers share the existing verified logic.
5. Audio remains in memory for the processing request and is never saved by the MFit voice-note bridge. STT usage is metered in the existing Kompas ledger. Do not log message speech content or raw audio.

## Latency and honesty
- **True streaming is not available through WhatsApp voice-note webhooks.** The server receives the audio file only once recording has been sent. No implementation can recover live words from the user's recording before Meta sends it.
- Reduce avoidable overhead by a **single recognizer pass** rather than a second model for classification, preserving the same cached Kompas context and existing text command handling. No fixed sleeps, artificial waits, or LLM-based intent classifier.
- Actual elapsed time depends on Meta webhook/CDN round-trips, clip duration, provider recognition response and any subsequent resume/Kompas answer generation. Avoid promising near-zero latency. Measure inbound-to-recognized time (milliseconds and text length only, not content), and separately outbound delivery acknowledgement.
- For **live partial transcription** with immediate words while speaking, use MFit Kompas microphone live mode. It is a separate capture surface controlled by the user and must not silently open their device microphone from WhatsApp.
- For **device-side free speech dictation** with no business-side transcription cost, use the keyboard microphone inside WhatsApp so the phone sends ordinary typed text directly.
- Existing MFit Kompas prefers `whisper-large-v3` for accuracy, which may be slower than Turbo. Don't silently downgrade recognition precision without benchmarking English, accents, Telugu, code and endpoint-security technical vocabulary.

## Robustness
- Only handle media after sender linking/authentication and the original signed `wamid` deduplication.
- The byte-limited Meta media download caps at 4 MiB; clips under 800 bytes, empty transcripts, unrecognized formats, 429 busy and unavailable recognition have distinct actionable responses.
- The input text flows through the same verified account source and answer revision locks as typed messages. Voice messages never change mode merely because they are audio; the **recognized words** control the mode.
- Preserve Meta audio as ephemeral memory only; do not archive it or expose provider errors and secret-bearing URLs to the end user.
- Never replay paid transcription automatically on uncertain network/provider failure. Users may resend if the voice note did not work.

## Acceptance
- `scripts/tests/whatsapp-voice.test.mjs` covers audio→text, original ID, spoken commands, JD, disabled/invalid users, rejected file formats, size/empty audio, busy/unavailable failures, webhook sequencing, storage and artificial wait prohibitions.
- CI runs this suite alongside existing WhatsApp, Kompas, screen-capture, voice and build checks.
- Test a genuine WhatsApp OGG/Opus voice note end to end from a linked test number, with short `kompas`, resume/JD, question and `revert`, and verify real provider availability and timed response. Mocked unit tests and a READY production deployment **do not establish** live Meta receipt or answer quality.
