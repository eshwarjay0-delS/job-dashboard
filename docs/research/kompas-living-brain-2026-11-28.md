# Kompas living brain — 28 Nov 2026

Owner Eshwar, 27 Nov 2026, 6:01 PM CT, asked for one brain document. At 6:05 PM CT he corrected the Feedback tab: it must not appear in a live interview. It shows only in a category session or a role session.

## What was read

The five stores stay where they are. The brain is a projection.

- In-session persona and session book, sent by the page from IndexedDB at session start.
- `dossier/{hash}/` profile and session lines, read through the existing dossier helpers.
- Master-bible revision text, read when the owner key is a 64-hex digest. The answer path's 16-hex account hash does not match that digest, so that read is skipped and the revision files stay.
- Prepared manuscript FastChunk text, read from the active pointer when it exists.

Tools and technologies in What I Know come from `src/lib/kompas-houston-resume.txt` (eshwarjay05). A source containing jayeshwar44 is not copied in.

## What the answer path does

`ensureAnswerBrain` loads the Markdown once and keeps it in memory. It is not inside the 110ms or 300ms dossier races. Those races still drop a late dossier read. The brain does not.

`BRAIN_POLICY` is an empty string and is not added to the answer prompt. How I Answer lives in the brain document.

A design or from-scratch question is revised once, in code, after the model draft. That revision is not a second model call. If the named tool is not on the Houston resume, the walkthrough stays inside the Houston role and does not claim the missing tool.

## Feedback

`public/kompas/brain-gate.js` returns true only for session type `category` or `role`. Live, mock, and chat hide the tab and the mic. The regression asserts the live case.

## Not verified

No production page check, no live microphone, and no model answer. Those wait for the one check after the ship.
