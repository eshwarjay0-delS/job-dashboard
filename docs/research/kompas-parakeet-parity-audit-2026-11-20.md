# Kompas and Parakeet parity audit, 20 November 2026

Method: source walk of every Kompas screen in `public/kompas/index.html` and `public/kompas/app.js`, set beside the public Parakeet homepage and the existing REA notes in `docs/research/parakeet-recon.md` and `docs/research/rea-parakeet-home-a11y.txt`. Parakeet's signed-in session was not opened. Invisibility and undetectable-process claims are not implemented. No production polling.

| Area | Parakeet behavior (public) | Kompas behavior | Gap | Fix | Status |
|---|---|---|---|---|---|
| Start | Try for Free opens sign-in, then a session | Skip-login opens the dashboard. Create session, then Connect and Start | Wizard is more than one click | Connect and Start remains one click after the session exists | Open, ranked 6 |
| Start empty | Marketing page, no empty session list | "No sessions yet. Create one, then connect the call." | The old line did not say what to do | Copy updated | Fixed |
| Start error | Not observed on the public page | "Start timed out. No audio received." after 8 seconds | None | Kept | Matched |
| Start loading | Not observed | Button reads Checking, then Start session | None | Kept | Matched |
| Session timer | Public session display includes duration | Clock starts on the first heard line | Clock stays 00:00 until speech | Already the last-week rule | Open, ranked 8 |
| Session timeout | Public notes say Parakeet can time out while active | No idle cutoff. Stop, Back, or pause ends or holds the run | None. This is a defect to avoid | Kept | Matched |
| Session pause | Not on the public homepage | pauseRun keeps the transcript and clears endedAt | Pause is Back or leaving, not a labeled Pause button | A labeled Pause is not added | Open, ranked 7 |
| Answers stream | Answers appear while the call continues | Thesis is shown first, then the rest | Model tokens still use the answer path | Not a second socket | Open, ranked 2 |
| Answers length | Not published as a word table | Explain-how uses the design-later band (180/100/220) | It had fallen to the follow-up band (140/90/160) | lengthKind restored | Fixed |
| Clarifier | Not on the public homepage | Silent unless the ask is ambiguous. Need 1–4 | Silence can look like a blank panel | The panel stays empty on purpose | Open, ranked 9 |
| Chat send | Not shown on the homepage | Enter sends. The box clears on the success path | Placeholder was a long sentence | "Type a question, then press Enter" | Fixed |
| Chat follow-up | Not shown | A short "why that?" keeps the previous question. A full How question does not | Full How questions were swallowed | Subject check added | Fixed |
| Chat stream | Smooth first token | chatExchange grows word by word for the typed line | The model stream is separate | Documented | Open, ranked 2 |
| Screen picker | Not shown | Browser getDisplayMedia | Still the browser picker | Not replaced | Open, ranked 3 |
| Screen preview | Meeting window beside the call | In-page video titled "Live tab preview" | No second window | Kept in-page. Title added | Fixed |
| Screen stop/restart | Not shown | Stop tab audio, Change tab, then live again | None in the state machine | screenShareStep | Matched |
| Transcription labels | Fast speech recognition | You or Interviewer | Export used to say Them | speakerName | Fixed |
| Transcription lag | Claimed milliseconds | First-word budget 1.4s. Captions are synchronous | Not a measured live delay | Budget kept | Open, ranked 8 |
| Term repair | Not published | seem, SailPoint, syslog, Okta | Phrase list, not a full dictionary | Existing repairs kept | Open, ranked 4 |
| Transcript order | Post-call transcript | Sorted by time, duplicate line dropped | Was insertion order | orderedTranscript | Fixed |
| Transcript copy | Read the transcript after the call | Download plus clipboard write | Clipboard fails closed if blocked | copyableTranscript | Fixed, ranked 5 if the browser blocks it |
| Transcript empty | Not shown | "No transcripts yet. They appear here after your first session." | None | Kept | Matched |
| Settings model | User picks a model per session | Wizard model field and live depth arrows | Depth is not a model name | Model field stays in the wizard | Open, ranked 10 |
| Settings shortcuts | Not published | Ctrl+Enter, /, T, F, P, arrows, Escape, Ctrl+Shift+S | None | Kept | Matched |
| Empty answer | Not shown | "Nothing heard yet." and "No question yet" | None | Kept | Matched |
| Error sign-in | Sign-in link on the homepage | Skip-login stays on. Admin routes stay locked | None for this owner | Kept | Matched |
| Bundle | Desktop app plus web | No vendored weights. Models load when a session starts | None | Kept | Matched |
| Double tab | Overlay beside the meeting | One document. Preview is an aside | Fullscreen uses the same video | No window.open in the preview | Matched |
| Invisibility | Marketing claim: hidden from screen share, dock, and Activity Monitor | Not implemented | Do not copy that claim | Left undone on purpose | Open, refused |
