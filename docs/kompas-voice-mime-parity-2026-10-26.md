# Kompas voice delivery evidence — 2026-10-26

## Scope and rationale
Job Dashboard already detected audio containers from bytes when choosing the provider filename, but still used the untrusted browser MIME for the Blob. Perfact had already corrected both fields. The Job Dashboard patch makes the filename and MIME agree for WAV, WebM, Ogg, MP4/M4A, MP3 and FLAC, without rewriting or persisting the original audio.

## Baseline and candidate
- Baseline: Job Dashboard production `5b10ce48d063bb6d413e1fb27d6f5fcb7f39bea7`, Vercel deployment `dpl_3B7xsYSJyfnPwsmuB5RRMTuGyjb7` (READY).
- Candidate: `fix/kompas-verified-audio-mime-20261026`, PR #80.
- Synthetic container parity: previous implementation had a MIME/extension disagreement when bytes and browser MIME disagreed; candidate uses one verified container for both. This is a structural regression fix, not a measured recognition improvement.
- Regression suite: six isolated tests plus CI voice benchmark, typecheck and build.
- Consent: no new collection, retention or cross-user data flow; existing archive consent gate is unchanged.

## Real-data benchmark comparison
No explicitly consented, versioned, same-cohort baseline and candidate recordings were available to this change. Do **not** report a measured improvement or substitute synthetic pass rates for accuracy. The existing aggregate evaluators in Job Dashboard and Perfact remain the source for WER, deletions, technical-term recall, zero-edit rate, speaker attribution, P50/P95 latency and silence hallucination rate.

| Metric | Baseline | Candidate | Delta |
| --- | --- | --- | --- |
| WER | Not measured | Not measured | N/A |
| Deletion rate | Not measured | Not measured | N/A |
| Technical-term recall | Not measured | Not measured | N/A |
| Zero-edit rate | Not measured | Not measured | N/A |
| Speaker attribution | Not measured | Not measured | N/A |
| P50/P95 latency | Not measured | Not measured | N/A |

## Release gate
CI and READY preview do not prove real microphone transcription. Job Dashboard's preview is protected by Vercel Authentication. Verify a consented, authenticated microphone recording end-to-end in preview, confirm response correctness and no storage without explicit consent, then review for production promotion. Preserve the previous READY deployment for rollback.
