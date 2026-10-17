# ParakeetAI reference for Kompas

Owner added “And parakeet.ai” on 17 October 2026 while continuation work was active. Interpreted as the interview assistant ParakeetAI at https://www.parakeet-ai.com/, not NVIDIA's speech model. The exact parakeet.ai URL did not resolve through the research tool. Product-reference research is approved; this does not approve every advertised feature or establish access to proprietary internals.

## Public observations

Official homepage reviewed 17 October 2026: https://www.parakeet-ai.com/

ParakeetAI advertises live question detection, automatic answer suggestions, uploaded-document context, coding assistance, meeting detection, mock interviews, question banks, and post-call notes. Its session display includes state, duration, transcript availability and usage. Accuracy, speed and invisibility statements are vendor claims, not independent measurements. No private API, implementation or model architecture was inspected.

## MFit implementation mapping

| Candidate improvement | Existing owner direction | Acceptance test | State |
|---|---|---|---|
| Grounded suggestions | Combined resume/JD evidence; natural engineer/director answers | Every factual personal assertion traceable to selected candidate context | Approved direction; existing engine needs live evaluation |
| Question completion and interruption handling | Voice reliability, turn detection | Replay noisy multi-speaker fixtures; measure false triggers, missing words and latency | Approved direction; coordinate with Kompas voice workstream |
| Session history | Persistent reusable transcripts and preparation | Open saved session after reload; match source documents and transcript | Approved direction; archive fix recently merged, verify live |
| Practice and question bank | Owner-reviewed question/answer examples | Distinguish practice sessions from real conversations; preserve review state | Approved direction; inventory before adding overlapping UI |
| Notes and action review | Useful session memory | Separate source transcript, generated summary and user corrections | Proposed implementation; requires detailed design |
| Coding assistance | Technical depth and implementation examples | Explain approach, run permitted tests, distinguish tested output from suggestion | Existing direction; exact live-screen workflow not yet approved |
| Meeting detection | Smooth session start | Ask before capture; preflight microphone and selected audio source | Proposed implementation; platform capabilities need validation |

Do not copy branding or imply Parakeet affiliation. Do not implement vendor privacy/invisibility claims from marketing text alone. This research is a feature comparison, not completed reverse engineering or a shipped integration.
