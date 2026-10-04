# MarketFit native core

This package is the platform-neutral logic shared by the future Android, iOS, Windows and macOS clients.

It deliberately does not capture microphone audio itself. Each native host owns permission prompts, audio routing, background-mode behavior, secure token storage and platform packaging.

The shared session engine owns the cross-platform interview-practice behavior:

1. receive diarized transcript turns from the native speech layer;
2. infer interviewer/candidate roles from the opening turns;
3. maintain a stable speaker-to-role map;
4. detect interviewer questions;
5. default to auto-answer;
6. switch to tap-to-answer when the user disables auto-answer;
7. require role confirmation rather than silently guessing when role confidence is low.

Native apps authenticate with Supabase and send the Supabase access token to MarketFit with `Authorization: Bearer <token>`. The existing Next.js backend remains the canonical API and data layer.

## Safety/product mode

The live assistance loop is intended for mock interviews, coaching and interview situations where assistance is permitted or disclosed. Product policy should not present covert answer generation as a way to defeat an employer assessment.
