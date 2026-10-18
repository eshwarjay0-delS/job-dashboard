# REA: Parakeet.ai — Real-Time Interview Copilot

**Date:** 2026-10-18
**Method:** Public reference review (pricing pages, reviews, comparisons)
**Request:** Owner: REA parakeet.ai's functionality — their defects (session timeout, response processing, voice dictation) and strengths (smooth response display, meeting window, mobile build, cross-device web app).

## What Parakeet.ai Is
Real-time AI interview copilot (direct Kompas competitor). Listens to interview audio,
transcribes, detects questions, generates answers on a desktop overlay.
- Models: GPT-5, GPT-4.1, Claude 4.0 Sonnet (user picks per session)
- Transcription: NVIDIA Parakeet-TDT (fast, low word-error-rate)
- Platforms: Windows/macOS desktop app + desktop Chrome + mobile web
- 50+ languages, 1.5M+ claimed users
- Pricing: 10 free 10-min sessions; then $149.90/mo or credits ($38/60 min)

## Architecture (to borrow)
1. **System-audio capture**: Listens directly to system audio (not just mic) —
   transcribes the interviewer's question in milliseconds.
2. **Transparent overlay**: Answers appear as a transparent overlay window,
   positioned alongside the meeting — the "meeting window" the owner praised.
3. **Per-session model pick**: User chooses GPT/Claude/Gemini per session.
4. **Resume + JD context loading**: User uploads both before the interview;
   answers are grounded in actual experience.
5. **Post-call artifacts**: Auto-generates notes, summaries, transcripts after.

## Defects (to AVOID — owner explicitly flagged)
1. **Session timeout**: Desktop session times out even when user is active.
   → Our rule: session stays alive until the USER stops it. No idle timeout.
2. **Launch issues**: App doesn't launch reliably.
   → Our rule: web-first (no install), desktop wrapper must degrade gracefully.
3. **Response processing not smooth/real-time**: Answers stutter or lag.
   → Our rule: SSE streaming with immediate first-token, no batching.
4. **Voice dictation issues**: Transcription errors, missed keywords.
   → Our rule: Whisper per-language priming (already built), continuous calibration.

## What They Do Well (to borrow)
1. **Smooth response display**: Answers stream into the meeting window
   without jank — no layout shift, no re-render flash.
2. **Meeting window UX**: Dedicated overlay window for the session —
   separate from the main app, always visible during the call.
3. **Mobile web build**: Works on mobile browsers (not native app).
4. **Cross-device web app**: Same experience on desktop/mobile web.

## Implications for Kompas
- [ ] Audit Kompas for any session timeout — must stay alive until user stops
- [ ] Audit SSE streaming for smoothness — no batching, immediate first token
- [ ] Design "meeting window" mode — dedicated session overlay during calls
- [ ] Test mobile web Kompas session end-to-end
- [ ] Voice dictation: continuous calibration from our 9/10 bar
