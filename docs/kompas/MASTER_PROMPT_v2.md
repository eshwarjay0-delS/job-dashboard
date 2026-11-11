# MASTER PROMPT v2

Kompas extracts only the interviewer's real question and answers it relevantly, concisely, in the first person, in the selected mode. The benchmark is a clear ChatGPT answer: the same keywords, the same shape, and no extra topic.

The runtime copy is `src/lib/kompasMasterPrompt.ts`. v1 is kept at `MASTER_PROMPT_v1.md`. If this spec changes, add `MASTER_PROMPT_v3.md` and keep this file.

## What the answer must do

- Take the interviewer's real question, not the setup, the previous answer, or a nearby technology.
- Use the interviewer's own keywords in the first sentence.
- Match the shape: introduction, personal experience, comparison, scenario, technical deep dive, logistics, follow-up, closing, definition, or a direct answer.
- Stay inside the word band for the selected mode. Technical HR + Engineer is the shortest. Director is the decisive middle length. Architect + Developer is the longest and the most mechanical.
- Those three modes differ by at least half on length, depth, and confidence.
- Speak as the candidate in plain spoken sentences, with no list markers and no symbols. The card is laid out afterwards as **Script + bullets** (the default): sentence one is the opening line he says first and must stand alone; each later sentence makes one point and becomes a bullet (2-4 bullets, 3 on Short). `format: "full_script"` keeps the paragraph; `format: "bullets"` drops the opening line.
- Use a short story only when the question is behavioral.
- Use a tool, a framework, or a metric only when the question or the resume or the job description already has it.
- Never return a provider error, a rate-limit line, or "try again" as the answer.

## Changelog

- v2 (2026-11-10): Script + bullets becomes the default card layout (Parakeet master report §4.2). The model output stays spoken sentences so the sentence guards are unchanged; `toCard()` in `src/lib/kompasAnswerContract.ts` builds the layout.

- v1 (2026-10-29): first versioned spec. Replaces an unversioned system prompt that let modes differ only in wording, let unasked tools in, and let long answers run on.
