# Kompas Meeting-Window Focus Mode Design

**Status:** Design (2026-10-18)
**REA source:** Parakeet.ai (`docs/research/parakeet-recon.md`)
**Borrow:** Transparent overlay "meeting window" — smooth response display alongside the interview.
**Avoid:** Parakeet's defects — session timeout, launch issues, janky response processing.

## Problem

During a live interview (Zoom/Teams in another window), the user needs Kompas answers glanceable without switching tabs. Current Kompas UI is a full dashboard — too much chrome for live use.

## Design: `/kompas/focus`

A minimal, distraction-free view:

```
┌─────────────────────────────────┐
│ ● LIVE  12:34        [End]      │  ← status bar: recording indicator, timer, end button
├─────────────────────────────────┤
│                                 │
│  Q: Tell me about a time you... │
│                                 │
│  A: At Citi, I led the...       │  ← current answer, large text, auto-scroll
│     [beat] ...                  │
│                                 │
├─────────────────────────────────�at
│ Last Q  │ Pause │ Model: Sonnet │  ← controls: history, pause, model pick
└─────────────────────────────────┘
```

### Rules (from REA)

1. **No session timeout.** Session stays alive until user hits End. (Parakeet defect #1 — we audited, we don't have it, we keep it that way.)
2. **Web-first.** No install, no launch issues. Opens in browser, works on desktop + mobile web. (Parakeet defect #2)
3. **Smooth streaming.** RAF-throttled render (already shipped in `public/kompas/app.js`) — no jank on token deltas. (Parakeet defect #3)
4. **Per-session model pick.** Dropdown in the control bar: Sonnet / Haiku / Gemini — same as Parakeet's strength #3.
5. **Resume + JD preloaded.** Session starts with dossier + active JD context (Parakeet strength #4, we already do this).

### Layout specifics

- **Single column, max-width 640px.** Readable at a glance from 2 feet away.
- **High contrast.** Dark background, light text — visible in peripheral vision.
- **Large type.** Question at 18px, answer at 20px. No squinting mid-interview.
- **Auto-scroll.** New tokens append, view follows. Pause button freezes scroll.
- **Last Q button.** Jumps back to previous question/answer (for "can you repeat that?" moments).
- **Timer.** Elapsed session time. 1-hour session accounting (existing credit model).

### What it is NOT

- Not a desktop overlay (we're web-first; browser window side-by-side is the pattern).
- Not a transcription display (Whisper handles STT separately; focus mode shows Q&A, not raw transcript).
- Not auto-advance (user controls what's on screen).

## Implementation

- New route: `src/app/kompas/focus/page.tsx`
- Reuses: `/api/kompas/answer` (streaming), session management, dossier grounding
- New: minimal CSS, no dashboard chrome, wake-lock to prevent screen sleep

## Next

1. Build `/kompas/focus` route
2. Add "Focus mode" button to session UI
3. Test side-by-side with Zoom on desktop
4. Mobile web test (Parakeet strength: mobile build)
