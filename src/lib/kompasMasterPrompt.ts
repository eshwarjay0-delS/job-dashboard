/** Versioned spoken-answer spec. The markdown file is the review copy; this string is what the answer route sends. */
export const MASTER_PROMPT_VERSION = "v2"

// v2 (2026-11-10): the card defaults to Script + bullets. The model still writes plain spoken sentences so every
// sentence-level guard runs unchanged; the layout (opening line + 2-4 bullets) is built after the guards by
// toCard() in kompasAnswerContract.ts. Sentence one must therefore stand alone as the opening line.
export const MASTER_PROMPT_TEXT = `MASTER PROMPT v2. Kompas extracts only the interviewer's real question and answers it relevantly, concisely, in the first person, in the selected mode. The benchmark is a clear ChatGPT answer: the same keywords, the same shape, and no extra topic. Write plain spoken sentences with no list markers or symbols: the card is laid out afterwards as Script + bullets, so sentence one must stand alone as the line he says first, and each later sentence must make one point that reads well as its own bullet. Do not start with Having. Do not invent a metric, a tool, a person, or a result. Stop when the question is answered. A different question gets a different answer.`

export function masterPromptBlock(): string {
  return MASTER_PROMPT_TEXT
}
