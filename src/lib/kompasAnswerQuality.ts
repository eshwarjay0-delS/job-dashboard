/**
 * Offline scores for a spoken Kompas answer. Each factor is 0 to 4.
 * The checks read the question and the draft. They do not call a model.
 */
import type { AnswerLevel } from "./kompasAnswer.ts"
import { dissectQuestion, questionKeywords, sameAnswerRatio, wordCount, vagueAsk } from "./kompasDissection.ts"

export type QualityFactor =
  | "relevance"
  | "voice"
  | "length"
  | "artifacts"
  | "psychology"
  | "consistency"
  | "elevation"

export type FoldKind =
  | "behavioral"
  | "technical"
  | "design"
  | "incident"
  | "strategy"
  | "blame"
  | "follow-up"
  | "interruption"
  | "vague"
  | "elevation"

export type QualityFold = {
  id: number
  kind: FoldKind
  level: AnswerLevel
  question: string
  previous?: string
}

export const QUALITY_FACTORS: QualityFactor[] = [
  "relevance", "voice", "length", "artifacts", "psychology", "consistency", "elevation",
]

const META = /\b(?:here is (?:the first thing I would do|what I do in practice|my answer from my own work)|great question|in conclusion|delve|tapestry|it is important to note)\b/i
const ARROGANCE = /\b(?:obviously everyone|as you should know|you people|not my fault|they screwed)\b/i
const BANNED_PROFILE = /\b(?:saint louis|st\. louis|jayeshwar44)\b/i

export function foreignProfileHit(answer: string): boolean {
  return BANNED_PROFILE.test(answer)
}

function hasKeyword(question: string, answer: string): boolean {
  const words = questionKeywords(question).flatMap((word) => word.toLowerCase().split(/\s+/)).filter((word) => word.length >= 4)
  const low = answer.toLowerCase()
  if (words.some((word) => low.includes(word))) return true
  const lead = question.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 5)
  return lead.some((word) => low.includes(word))
}

export function scoreSpokenAnswer(fold: QualityFold, answer: string): Record<QualityFactor, number> {
  const text = String(answer || "")
  const cut = dissectQuestion(fold.question)
  const words = wordCount(text)
  const ceiling = cut.modes[fold.level].maxWords
  const relevance = hasKeyword(fold.question, text) ? 4 : 0
  const voice = META.test(text) || ARROGANCE.test(text) ? 0 : /\bI\b/.test(text) ? 4 : 2
  const length = words > ceiling ? 0 : words >= 8 ? 4 : 2
  let artifacts = 2
  if (fold.kind === "design") artifacts = /want me to go deeper on|shall i keep sketching|out of scope/i.test(text) ? 4 : 0
  else if (fold.kind === "vague") artifacts = /assuming you mean/i.test(text) ? 4 : 0
  else if (fold.kind === "blame") artifacts = /pressure was real/i.test(text) && /miss was mine/i.test(text) ? 4 : 0
  else if (fold.kind === "incident" || fold.kind === "technical" || fold.kind === "behavioral") artifacts = /\b(?:check|evidence|log|batch|owner|step|test|example|reviewed|plan|control|finding|checklist|record)\b/i.test(text) ? 4 : 2
  else if (fold.kind === "strategy") artifacts = /\b(?:owner|decision|risk|boundary)\b/i.test(text) ? 4 : 0
  else artifacts = /\bI\b/.test(text) ? 4 : 2
  const psychology = fold.kind === "blame"
    ? (/pressure was real/i.test(text) && /miss was mine/i.test(text) && !ARROGANCE.test(text) ? 4 : 0)
    : (/\bI\b/.test(text) && !ARROGANCE.test(text) ? 4 : 0)
  let consistency = 4
  if (fold.previous) {
    const overlap = sameAnswerRatio(fold.previous, text)
    const shared = hasKeyword(fold.previous, text) || hasKeyword(fold.question, text)
    consistency = overlap < 0.7 && shared ? 4 : overlap < 0.7 ? 3 : 0
  }
  const elevation = fold.level === "director"
    ? (/\b(?:decision|decide|tradeoff|owner|risk|call)\b/i.test(text) ? 4 : 0)
    : fold.level === "architect"
      ? (/\b(?:boundary|fail|break|step|where)\b/i.test(text) ? 4 : 0)
      : (/\b(?:check|evidence|example|step|test|reviewed|mean|means)\b/i.test(text) ? 4 : 0)
  if (vagueAsk(fold.question) && fold.kind !== "vague") {
    /* a vague ask is scored by its own kind */
  }
  return { relevance, voice, length, artifacts, psychology, consistency, elevation }
}

export const AQ_FOLDS: QualityFold[] = [
  { id: 1, kind: "behavioral", level: "engineer", question: "Tell me about a time you challenged a weak remediation plan." },
  { id: 2, kind: "behavioral", level: "director", question: "Describe a situation where a fix did not hold." },
  { id: 3, kind: "behavioral", level: "architect", question: "Walk me through an incident you handled." },
  { id: 4, kind: "behavioral", level: "engineer", question: "Tell me about a time the rollout failed." },
  { id: 5, kind: "behavioral", level: "director", question: "Give me an example of a time you sent weak evidence back." },
  { id: 6, kind: "technical", level: "engineer", question: "How does the access review check fail closed?" },
  { id: 7, kind: "technical", level: "architect", question: "Explain how token validation works, step by step." },
  { id: 8, kind: "technical", level: "director", question: "How do you assess residual risk on an open finding?" },
  { id: 9, kind: "technical", level: "engineer", question: "Walk me through the sign-in log check." },
  { id: 10, kind: "technical", level: "architect", question: "What happens when the nightly batch misses a row?" },
  { id: 11, kind: "design", level: "engineer", question: "Design a rate limiter for the public API." },
  { id: 12, kind: "design", level: "director", question: "How would you design a rollback without downtime?" },
  { id: 13, kind: "design", level: "architect", question: "Design me a tenant isolation approach for the cache." },
  { id: 14, kind: "design", level: "engineer", question: "Design the storage layer for audit evidence." },
  { id: 15, kind: "design", level: "director", question: "How would you design the first check for a stale session?" },
  { id: 16, kind: "incident", level: "engineer", question: "The sign-in batch failed overnight. What do you check first?" },
  { id: 17, kind: "incident", level: "director", question: "We are in the war room. The service account still has access. What is the call?" },
  { id: 18, kind: "incident", level: "architect", question: "An alert says the audit evidence disagrees with the live setting. Where does it break?" },
  { id: 19, kind: "incident", level: "engineer", question: "The rollback left a duplicate row. How do you check for gaps?" },
  { id: 20, kind: "incident", level: "director", question: "Customers are waiting. Who owns the decision to keep the old path up?" },
  { id: 21, kind: "strategy", level: "director", question: "What is your strategy for access reviews across the whole company?" },
  { id: 22, kind: "strategy", level: "architect", question: "How should we govern exceptions that never expire?" },
  { id: 23, kind: "strategy", level: "engineer", question: "What control would you check first if the board asks about open findings?" },
  { id: 24, kind: "strategy", level: "director", question: "Which risk would you accept this quarter, and what would change your mind?" },
  { id: 25, kind: "strategy", level: "architect", question: "Where is the boundary between the audit pack and the live configuration?" },
  { id: 26, kind: "blame", level: "engineer", question: "Why did you miss the stale session?" },
  { id: 27, kind: "blame", level: "director", question: "Whose fault is the failed rollback?" },
  { id: 28, kind: "blame", level: "architect", question: "This is the post-mortem. What did you miss in the batch?" },
  { id: 29, kind: "blame", level: "engineer", question: "You dropped the check. Why did you fail the customer?" },
  { id: 30, kind: "blame", level: "director", question: "They want to blame you for the open finding. What do you own?" },
  { id: 31, kind: "follow-up", level: "engineer", question: "How did you verify that?", previous: "I checked the sign-in log and reran the affected batch." },
  { id: 32, kind: "follow-up", level: "director", question: "Who owned that call?", previous: "I held the finding until the owner signed the exception." },
  { id: 33, kind: "follow-up", level: "architect", question: "Where did that check fail?", previous: "The boundary I watched was the token check at the proxy." },
  { id: 34, kind: "follow-up", level: "engineer", question: "What happened next?", previous: "I sent the weak evidence back to the owner." },
  { id: 35, kind: "follow-up", level: "director", question: "Why that owner?", previous: "The decision sat with the control owner, not with me." },
  { id: 36, kind: "interruption", level: "engineer", question: "Tell me about the outage. Wait, forget that. What is least privilege?" },
  { id: 37, kind: "interruption", level: "director", question: "How was the quarter? Sorry, new question. Who owns residual risk?" },
  { id: 38, kind: "interruption", level: "architect", question: "Start with your background. Actually, how does the token check fail?" },
  { id: 39, kind: "interruption", level: "engineer", question: "Design the whole platform. Never mind. How do you check a stale session?" },
  { id: 40, kind: "interruption", level: "director", question: "Any logistics? Hold on. What is the decision on the open finding?" },
  { id: 41, kind: "vague", level: "engineer", question: "security?" },
  { id: 42, kind: "vague", level: "director", question: "thoughts?" },
  { id: 43, kind: "vague", level: "architect", question: "Any thoughts?" },
  { id: 44, kind: "vague", level: "engineer", question: "the usual?" },
  { id: 45, kind: "vague", level: "director", question: "Your take?" },
  { id: 46, kind: "elevation", level: "engineer", question: "How would you test the API check?" },
  { id: 47, kind: "elevation", level: "director", question: "How would you test the API check?" },
  { id: 48, kind: "elevation", level: "architect", question: "How would you test the API check?" },
  { id: 49, kind: "elevation", level: "director", question: "Design a rate limiter for the public API." },
  { id: 50, kind: "elevation", level: "architect", question: "Design a rate limiter for the public API." },
]
