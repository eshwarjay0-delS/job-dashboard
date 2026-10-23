# Kompas — Master Vision

## Desktop response calibration — 22 October 2026

Owner confirms authentication is fixed and scopes this change to desktop responses. Exactly three audiences: **Recruiter + Engineer**, **Architect + Developer**, **Director**. The audience determines explanation style; the current question determines depth. Definitions and comparisons remain concise at every level. A requested real vulnerability example explains supported actions, bottlenecks, validation and business consequence. Architect/developer implementation questions can cover setup and integration step by step. Director answers retain technical reasoning at the operational/business level, with supported achievements and clearly proposed measurement choices.

Desktop audience changes immediately cancel the old response and use a separate cache per audience, mode and answer length. A missing answer is generated directly for that audience. Desktop bypasses the historical two-anchor derivation and opening-book path, which could shorten a Director answer for Architect rather than generating the requested explanation. Existing web levels remain unchanged. The response calibration marker is sent only by the desktop bridge path. Release version: `kompas-20261022-desktop-three-levels`.

Validation: tests exercise all three question/audience combinations, legacy selection migration, exactly three displayed options, switching during a pending answer, isolated cached answers and shared continuity/focus regressions. No live model quality or real Windows rendering acceptance is claimed from these checks.


## Authentication continuity correction — 22 October 2026

Latest owner rule: a valid sign-in must last at least two to three days and should renew silently beyond that while the server continues to accept the session family. This supersedes the earlier client-side rule that forced a new login at 48 hours. Elapsed time, inactivity, a hidden window, wake from sleep, or a new deployment must never eject an active meeting.

The web dashboard and Kompas now renew on open, focus, visibility return and a 20-minute visible pulse. If the server ultimately rejects renewal because the user logged out, credentials were revoked, or an administrator time-box ended, the current screen stays intact and presents **Reconnect sign-in**; it does not navigate away automatically. A newly available build also presents an update button instead of reloading itself. `mf_login_at` remains only diagnostic evidence and no longer decides access.

This is a reliability boundary, not a promise that authentication can never expire. The server remains authoritative. Passing a 1,000-cycle policy test is not a three-day live soak, and a deployed web client is not a rebuilt Windows executable. Canonical native refresh-token rotation, installer publication and Windows sleep/network/multi-day acceptance remain separate until recorded with their own evidence.

## Desktop response focus — 20 October 2026

Approved owner correction: reduce the crowded desktop controls and persistent setup information; make the response the dominant reading surface while preserving reliability. Default desktop-only Focus view uses an opaque answer surface, restrained typography and secondary controls behind Details. Start/Stop, AI Answer, mic/system audio, Chat, status and native window controls remain available. Enabled Auto and Follow Along remain visible. Details restores audience, captions, dossier progress and auxiliary controls. Focus can be switched off, with the preference saved; the ordinary web interface stays unchanged. No session/audio/answer handlers are replaced, no programmatic answer scrolling is introduced, and no Windows-wide dimming is claimed.

Evidence: four DOM/CSS interaction checks plus ten session-continuity checks pass. Native Windows rendering and a long-session soak are pending. Browser visual inspection was blocked because no Chromium binary was installed and its download failed; do not describe this as visually verified. The abrupt native process exit remains the separate investigation in `docs/research/desktop-session-continuity.md`.

*Draft captured 2026-10-17 from the owner's existing product. Owner to review and correct — this is the starting point, not the final word.*

## The one-liner

Interview practice that listens. Kompas hears you talk and makes you undeniable.

## What Kompas is

A voice-first interview preparation app. The user speaks; Kompas listens, transcribes, answers, and coaches — grounded in the user's real project history, not generic internet advice.

## Pillars

### 1. Voice

- **Kompas Flow**: speak and get clean text — voice-to-text dictation tuned for interview speech.
- **Sessions**: full 1-hour mock interview sessions on paid models (OpenRouter). Transcription stays on Groq Whisper.
- Speech has a human voice: `[beat]` pauses before key insights, `[breath]` between ideas — answers are *heard*, not just read.

### 2. Answers grounded in reality

- **The dossier ("bible")**: a growing per-user store of every session's Q&A, every resume, keywords, and generated content. Every answer is grounded in the user's real project context — what they actually did, what went right, impact, learnings.
- **60/40 delivery**: 60% human narrative, 40% crisp technical, mentor tone. Realistic office peer-to-peer observations, never generalized content.
- Technical answers use exact versions, configs, and numbers from the user's real work — never invented.

### 3. Full-spectrum preparation

- Strong in cybersecurity today; the standing directive is to keep expanding into other specializations with research reports.
- The bar is **in-person readiness**: loop interviews, system-design and architectural rounds — not just phone screens.

## How it connects

- **Resume**: filed resumes feed the dossier; real history grounds every answer.
- **Apply**: interview prep per applied role, using the actual JD.
- **Gmail**: interview invites flow into prep scheduling.

## Standing rules (never break)

- Sessions run on paid models only. Transcription stays on Groq Whisper (OpenRouter has no STT).
- Nothing is "live" until verified. No remote-debugging promises that can't be kept.
- The user's real history is the ceiling of every claim — Kompas never invents experience.

## Non-goals

- Generic interview tips. If it's on the internet already, Kompas doesn't say it.
- Replacing real interviews. Kompas prepares; the user performs.


## ParakeetAI reference — 17 October 2026

Owner requested Parakeet.ai as an additional reference. See `docs/research/parakeet-reference.md` for verified public observations, MFit mapping, approval distinctions and acceptance checks. Prioritize existing owner commitments to combined resume/JD grounding, natural answers, speaker-aware turn handling, reusable session history and practice. New implementation details remain proposals until scoped; marketing accuracy/invisibility claims are not acceptance evidence. This reference complements the ongoing Kompas voice and archive workstreams.
# Session continuity correction — 20 October 2026

Owner now requires sessions to remain recoverable until explicit End, including 20–40 minutes of inactivity. The old 30-minute stopped/disconnected-session expiry is superseded. Historical ended records stay ended. The frontend fix and simulated-clock tests are recorded in `docs/research/desktop-session-continuity.md`; the reported native Windows disappearance is still unproven without its crash event/build evidence. Web deployment is not a desktop installer update or a completed Windows soak test. Preserve this correction when synchronizing upstream assets. This slice does not modify the separately owned voice/answer work.

## Question intake (21 Oct 2026)

The answered question is a concatenation of every source — the typed box, the computer audio (Them) and the mic — composed at AI Answer time in `composeIntake` (public/kompas/app.js). Auto fires that same button path and nothing else answers heard speech. Three rules: (1) with computer audio captured, the user's mic lines are him spelling out the on-screen answer — lines sharing half or more of their content words with the current answer are dropped as echo, and any other mic speech rides only as a context-keywords line, never as the question (mic-only sessions invert this: the mic is the question source, minus the same echo drop); (2) greetings and stray fragments from any source are noise and never become a card — a lone "HELLO" can no longer be answered; (3) when no source produced a real question but the fragments carry real keywords, AI Answer tackles them into the lane — the question already on screen is passed as the anchor and the engine derives a question from the fragments in that lane. A question counts as real when it carries a question cue, is a deliberate typed ask, or is one full spoken sentence; short fragments never add up into one. Tests: scripts/tests/kompas-question-intake.test.mjs (8/8, runs the shipped block in a vm).

## Otter-craft answers + dictation precision (21 Oct 2026)

Owner directive: the reference interview transcripts he supplied are the response style bar — detailing, connecting words, and the balance of depth and technicalities — and dictation must catch questions as precisely as the microphone allows.

Response craft lives in `RESPONSE_CRAFT_POLICY` (src/lib/kompasAnswer.ts), appended to the answer system prompt for every tier: direct answer first; then layers unfolded in working order, each tied to the last with plain connectives; a concept is meaning → parts in order → contrast with the neighbour concept → practical consequence; a comparison holds both sides to the same axes; an investigation runs source → evidence from several independent places, grouped → what the pattern means → immediate containment → long-term fix; technical specifics are named only with their plain meaning already established; the close is the implication or a one-line recap, never a new topic.

Dictation precision: every language now transcribes on the careful model (whisper-large-v3; `modelForLanguage` in src/lib/kompasSpeech.ts) — the cheaper turbo model's errors landed on accented speech and technical terms, which is where interview questions live. The session's configured language is sent with every transcription call (`x-speech-lang` in public/kompas/app.js), so Whisper no longer guesses the language chunk by chunk. Phrase segmentation keeps questions whole: a pause ends a phrase at 1100 ms (was 850) and a single phrase may run 28 s (was 14 s) before it is flushed. The speech route's hint budget matches the client's merge (560 chars), so vocabulary priming is not silently truncated.
