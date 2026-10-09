
## 2026-10-09: Capture and answer reliability

Owner request: improve voice dictation and web/desktop parity, stop losing microphone input and final phrases, and repair AI Answer requests that produce nothing.

Changes: shared capture behavior on the dashboard and Perfact; browser sharing initiated in the user's click; explicit ended/muted/recorder error states; quieter speech gate without adapting speech into the noise floor; short replies preserved; ordered transcription and session isolation; stop flushes the final audio; one bounded retry of the same clip; AI Answer awaits final transcription, holds its click lock until the answer settles, and exposes a retry state on a stalled answer. MP4 uses an M4A upload filename; transcription accepts already parsed binary request bodies and bounds upload/provider duration and size. The existing Whisper Large V3 default and anchor generation rules remain in place.

Verification: behavioral regression tests cover capture timing, short replies, quiet input, stale sessions, retries, stream ordering, failed flushes, repeated clicks and stalled answers. Endpoint tests cover MP4, streamed and parsed audio, rate limiting, malformed responses, invalid headers and oversized input. No real microphone or accent accuracy benchmark has been run. Browser background suspension and unshared call audio cannot be eliminated by this patch; the app surfaces interruptions.

Release stamp: voice-20261009-1. Desktop loads the Perfact website, so it receives the shared source after reload. The dashboard has its own copy with the same voice-v2 marker. The sync guard recognizes the patched upstream source.
