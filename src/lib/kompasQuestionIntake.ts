/**
 * Question intake for live speech, captions, and dictation chunks.
 *
 * Same-question fragments join into the whole ask. A later chunk that is a
 * different question stays its own ask. A keyword or a sentence with no
 * question syntax still becomes a question the answer engine can use.
 * Offline only: this does not measure a live microphone.
 */
import { repairDictation } from "./kompasDictation.ts"

const LEAD = /^(?:(?:um+|uh+|erm+|so|okay|ok|yeah|yes|right|well|now|then|alright|all right|and|but)[,.]?\s+)+/i
const FRESH = /^(?:what|why|how|when|where|which|who|can you|could you|would you|will you|do you|did you|have you|are you|is there|tell me|walk me|describe|explain|give me)\b/i
const CONT_WORD = /^(?:and|or|but|for|with|without|that|which|to|of|in|on|about|including|plus|then|because|if|when|where|while|until|from|into|by|using|across|during|after|before)\b/i
const DANGLING = /\b(?:a|an|the|to|of|for|with|and|or|but|about|on|in|into|from|by|at|as|your|my|our|their|between|would|could|should|me|us|you|how|what|why|when|where|which|who)\s*$/i
const STOP = new Set("what how why when where which who tell walk have has can could would will did does are the and but for you your yeah okay right great thanks this that those these about with from into our their them they been being just like really very also more most some any".split(" "))
const NOISE = /^(?:ok(?:ay)?|hi|hello|hey|thanks|thank you|yeah|yep|yes|no|nope|uh+|um+|hmm+|right|alright|all right|cool|sure|great|nice|bye|goodbye|good morning|good afternoon)[.!?]*$/i
const SHORT_FOLLOW = /^(?:(?:and|so|but|ok(?:ay)?|right|well|then|now|um+|uh+|yeah|yes)[, ]+)*(?:how come|how so|why not|why though|and why|and how|go deeper|dig deeper|explain that|explain this|explain it|say that again|why|how|walk me through that)(?:\s+though)?[.?!]*$/i

function bareLead(text: string): string {
  return String(text || "").replace(LEAD, "").replace(/\s+/g, " ").trim()
}

function contentWords(text: string): string[] {
  return bareLead(text).toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w))
}

function opensFresh(text: string): boolean {
  const raw = String(text || "").replace(/\s+/g, " ").trim()
  const t = bareLead(raw)
  if (!t || SHORT_FOLLOW.test(raw) || SHORT_FOLLOW.test(t)) return false
  if (CONT_WORD.test(t)) {
    const rest = t.replace(CONT_WORD, "").trim()
    if (!FRESH.test(rest)) return false
  }
  return FRESH.test(t) || /\?\s*$/.test(t)
}

function differentSubject(prev: string, next: string): boolean {
  const raw = String(next || "").replace(/\s+/g, " ").trim()
  if (SHORT_FOLLOW.test(raw) || SHORT_FOLLOW.test(bareLead(raw))) return false
  const bare = bareLead(raw)
  const pointed = /\b(?:that|it|those|these|there|the same)\b/i.test(bare) || (/\bthis\b/i.test(bare) && !/\bthis\s+[a-z0-9]{4,}/i.test(bare))
  if (pointed && contentWords(raw).length <= 1) return false
  const prevWords = new Set(contentWords(prev))
  const nextWords = contentWords(raw)
  if (!nextWords.length) return false
  return nextWords.every((w) => !prevWords.has(w))
}

const UNFINISHED_ASK = /^(?:how|what|why|when|where|which|who|can|could|would|will|do|does|did|tell|walk|give|explain)\b/i

function stillOpen(text: string): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t || /[?.!…]["']?\s*$/.test(t) || !DANGLING.test(t)) return false
  // "questions for us" is finished. "How would you" is not.
  const words = t.split(/\s+/)
  if (words.length <= 4 && !UNFINISHED_ASK.test(bareLead(t))) return false
  return true
}

function standaloneKeyword(text: string): boolean {
  const t = bareLead(text).replace(/[.?!]+$/g, "").trim()
  const n = t.split(/\s+/).filter(Boolean).length
  if (n < 1 || n > 4 || opensFresh(t) || CONT_WORD.test(t) || NOISE.test(t)) return false
  if (DANGLING.test(t) && UNFINISHED_ASK.test(t)) return false
  return true
}

const ASIDE = /\b(?:thanks for (?:making|taking)|thank you for (?:making|taking|your time)|happy to (?:talk|meet|be here)|nice to meet|good to meet|hiring team|hard stop|have a (?:great|good|nice) (?:day|evening|weekend))\b/i

/** A greeting, a sign-off, or the candidate's own reply. It is not a new interview question. */
function leaveUnanswered(text: string): boolean {
  const raw = String(text || "").replace(/\s+/g, " ").trim()
  const t = bareLead(raw)
  if (!t || NOISE.test(t) || NOISE.test(raw)) return true
  if (/\?/.test(raw) || FRESH.test(t) || /^(?:design|define|compare|explain|describe|tell|walk|give)\b/i.test(t)) return false
  if (ASIDE.test(raw)) return true
  if (/\bis when\b/i.test(t) && !/\b(?:question|ask|wanted to ask|wondering)\b/i.test(t)) return true
  if (/^(?:i|i'm|i've|i'd|i'll)\b/i.test(t) && !/\b(?:question|ask)\b/i.test(t)) return true
  if (/^(?:so|yeah|yes|um+|uh+|alright|okay|ok)\b/i.test(raw) && contentWords(raw).length <= 1) return true
  return false
}

/** True when the next chunk is more of the question already being said. */
export function continuesSameQuestion(previous: string, next: string): boolean {
  const prev = String(previous || "").replace(/\s+/g, " ").trim()
  const nxt = String(next || "").replace(/\s+/g, " ").trim()
  if (!prev || !nxt) return true
  if (leaveUnanswered(prev)) return false
  if (leaveUnanswered(nxt) && !NOISE.test(bareLead(nxt)) && !NOISE.test(nxt)) return false
  if (NOISE.test(bareLead(nxt)) || NOISE.test(nxt)) return true
  if (SHORT_FOLLOW.test(nxt) || SHORT_FOLLOW.test(bareLead(nxt))) return true
  const nb = bareLead(nxt)
  if (CONT_WORD.test(nb) && !opensFresh(nxt)) return true
  if (standaloneKeyword(prev) && standaloneKeyword(nxt) && differentSubject(prev, nxt)) return false
  if (stillOpen(prev) && !opensFresh(nxt)) return true
  if (stillOpen(prev) && opensFresh(nxt) && !differentSubject(prev, nxt)) return true
  // A finished statement in front of the ask is that question's setup, not an earlier question.
  const candidate = /^(?:i|i'm|i've|i'd|i'll|my)\b/i.test(bareLead(prev))
  if (!opensFresh(prev) && !candidate && !standaloneKeyword(prev) && opensFresh(nxt) && !/\?\s*$/.test(prev)) return true
  if (opensFresh(nxt) && differentSubject(prev, nxt)) return false
  if (!opensFresh(nxt)) {
    if (SHORT_FOLLOW.test(nxt) || SHORT_FOLLOW.test(bareLead(nxt)) || (CONT_WORD.test(bareLead(nxt)) && !leaveUnanswered(nxt)) || stillOpen(prev)) return true
    if (/[?]["']?\s*$/.test(prev)) return false
    return true
  }
  if (!opensFresh(prev) && opensFresh(nxt)) return true
  return false
}

function repairChunk(text: string): string {
  return repairDictation(String(text || "")).replace(/\s+/g, " ").trim()
}

/** Ordered chunks grouped so one question stays together and the next question does not. */
export function questionGroups(chunks: readonly string[]): string[][] {
  const groups: string[][] = []
  for (const raw of chunks) {
    const chunk = repairChunk(raw)
    if (!chunk) continue
    const prev = groups[groups.length - 1]
    if (!prev || !continuesSameQuestion(prev.join(" "), chunk)) groups.push([chunk])
    else prev.push(chunk)
  }
  return groups
}

function cap(text: string): string {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function stripSurrounding(text: string): string {
  let t = String(text || "").replace(/\s+/g, " ").trim()
  t = t.replace(LEAD, "")
  const sentences = t.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
  while (sentences.length > 1 && NOISE.test(bareLead(sentences[0]))) sentences.shift()
  while (sentences.length > 1 && NOISE.test(bareLead(sentences[sentences.length - 1]))) sentences.pop()
  return sentences.join(" ").replace(/\s+/g, " ").trim()
}

function isFormalQuestion(text: string): boolean {
  const t = bareLead(text)
  if (!t) return false
  if (/\?/.test(t) || FRESH.test(t)) return true
  if (/^(?:design|define|compare|explain|describe|tell|walk|give|outline|list|name|state|share)\b/i.test(t)) return true
  return /\b(?:how|what|why|when|where|which|who)\b(?!\s+to\b)/i.test(t) && t.split(/\s+/).length >= 4
}

function finishFormal(text: string): string {
  const t = cap(stripSurrounding(text))
  if (!t) return ""
  if (/[.?!]["']?$/.test(t)) return t
  if (FRESH.test(bareLead(t)) || /\b(?:how|what|why|when|where|which|who)\b/i.test(t)) return `${t.replace(/[,;:\s]+$/, "")}?`
  return `${t.replace(/[,;:\s]+$/, "")}.`
}

function cleanTail(tail: string): string {
  return String(tail || "").replace(/[.?!]+$/g, "").replace(/\s+/g, " ").trim()
}

function templateQuestion(text: string): string {
  const t = stripSurrounding(text).replace(/[.?!]+$/g, "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  const rules: Array<{ test: RegExp; build: (match: RegExpMatchArray) => string }> = [
    { test: /^(?:(?:a|the|my|your|quick|brief|short|self)\s+)?intro(?:duction)?$/i, build: () => "Tell me about yourself." },
    { test: /^(?:about yourself|who are you|your background|describe yourself)$/i, build: () => "Tell me about yourself." },
    { test: /^(?:(?:your|my|the)\s+)?(?:strengths?|strong points?)$/i, build: () => "What are your strengths?" },
    { test: /^(?:(?:your|my|a|the)\s+)?(?:weakness(?:es)?|areas? (?:to|for) improvement)$/i, build: () => "What is a weakness you are working on?" },
    { test: /^(?:why (?:this )?(?:role|job|company|position|us|here)|why do you want (?:this )?(?:role|job)|why (?:our|this) company)$/i, build: () => "Why do you want this role?" },
    { test: /^(?:experience(?:\s+with)?|worked with|work with)(?:\s+(.+))?$/i, build: (m) => m[1] ? `What is your experience with ${cleanTail(m[1])}?` : "What is your experience?" },
    { test: /^(?:walk(?:\s+me)?\s+through)(?:\s+(.+))?$/i, build: (m) => m[1] ? `Walk me through ${cleanTail(m[1])}.` : "Walk me through your background." },
    { test: /^(?:(?:tell me )?about a time|a time when|star(?:\s+method)?)(?:\s+(.+))?$/i, build: (m) => m[1] ? `Tell me about a time you ${cleanTail(m[1])}.` : "Tell me about a time you handled a difficult situation." },
    { test: /^(?:questions?(?:\s+for\s+(?:us|me|the team|the interviewer))?|any questions)$/i, build: () => "What questions do you have for us?" },
    { test: /^(?:scenario|how would you|what would you do)(?:\s+(.+))?$/i, build: (m) => m[1] ? `How would you handle ${cleanTail(m[1])}?` : "How would you handle this situation?" },
    { test: /^(?:conflict|failure|mistake|a time you failed)(?:\s+(.+))?$/i, build: () => "Tell me about a time something went wrong and what you did." },
    { test: /^(?:salary|compensation|pay(?:\s+expectations?)?)$/i, build: () => "What are your salary expectations?" },
    { test: /^(?:visa|sponsorship|h-?1b|work authorization)$/i, build: () => "What is your visa status?" },
    { test: /^(?:address|where do you live|where are you based)$/i, build: () => "What is your address?" },
    { test: /^(?:relocation|relocate|willing to relocate)$/i, build: () => "Are you open to relocation?" },
    { test: /^(?:availability|notice|notice period|start date)$/i, build: () => "What is your notice period?" },
  ]
  for (const rule of rules) {
    const match = t.match(rule.test)
    if (match) return rule.build(match)
  }
  return ""
}

function bestEffortQuestion(text: string): string {
  const t = cap(stripSurrounding(text)).replace(/[.?!]+$/g, "").trim()
  if (!t || NOISE.test(t)) return ""
  const words = t.split(/\s+/).filter(Boolean)
  if (/^(?:i|i'm|i've)\b/i.test(t) && words.length > 12 && !/\b(?:how|what|why|when|where|which|who|question)\b/i.test(t)) return ""
  if (words.length <= 3 && !/\b(?:is|are|was|were|have|has|do|does|did|failed|broke|happened)\b/i.test(t)) return `What is ${t}?`
  if (/\b(?:failed|broke|happened|outage|incident|was down|went down)\b/i.test(t)) {
    return `Tell me about a time when ${t.charAt(0).toLowerCase()}${t.slice(1)}.`
  }
  return `Can you speak to this: ${t}?`
}

/** A cleaned question, a stem template, or a best-effort question. "" only for pure noise. */
export function formQuestionFromHeard(text: string): string {
  const repaired = repairChunk(text)
  if (leaveUnanswered(repaired)) return ""
  const stripped = stripSurrounding(repaired)
  if (!stripped || NOISE.test(stripped) || NOISE.test(bareLead(stripped)) || leaveUnanswered(stripped)) return ""
  const templated = templateQuestion(stripped)
  const shortStem = stripped.split(/\s+/).length <= 5
  if (templated && (shortStem || !isFormalQuestion(stripped))) return templated
  if (isFormalQuestion(stripped)) return finishFormal(stripped).slice(0, 4000)
  return bestEffortQuestion(stripped).slice(0, 4000)
}

/** One formed question per distinct ask. Fragments of the same ask are already joined. */
export function intakeQuestions(chunks: readonly string[]): string[] {
  return questionGroups(chunks).map((group) => formQuestionFromHeard(group.join(" "))).filter(Boolean)
}
