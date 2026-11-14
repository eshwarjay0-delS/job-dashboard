// Context panel for the live answer (owner, 12 Nov 2026, 8:32 PM CT).
// Deterministic. Built from the resume already on the answer request.
// No second model call, no poll. The spoken answer is untouched.
import { clarifySeedLine } from "./kompasClarifyBank.ts"
import { validateStatement } from "./kompasGloss.ts"
import { lookupTerm } from "./kompasLexicon.ts"
import { extractClaims, longStatementCue, screenSuggestion } from "./kompasSessionMind.ts"
//
// Leads and touch points may name a team size, a title, an employer, a tool,
// or a stakeholder only when that string is in this resume. A second profile
// in the same text is dropped. Email, phone, city, visa, and pay are not spoken.

export type AsideMode = "questions" | "boosters"

export type AsideTrace = { line: string; why: string }

export type AnswerAside = {
  question: string
  /** What section 2 shows until the live transcript cue or a manual toggle says otherwise. */
  mode: AsideMode
  context: { leads: string[]; touchPoints: string[] }
  questions: string[]
  boosters: string[]
  /** One-line read of a long turn. Empty when the last line is short. */
  summary: string
  /** A line he can say now. Empty when nothing new finished. */
  sayNow: string
  /** Resume sentences for the question being heard. Empty fields stay empty. */
  breakdown: { claim: string; context: string; result: string }
  /** The newest heard line, shown before the debounced breakdown. */
  partial: string
  /** Spans he already said. The panel must not contradict these. */
  claims: string[]
  /** Internal only. Hover text, not a spoken line, not stored. */
  trace: AsideTrace[]
}

export type ShortFact = { text: string; booster: string }

const PROFILES = ["eshwarjay05", "jayeshwar44", "jayeshwar24", "eshwarjay06"] as const
const NUMBER_WORD = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve"
const TEAM = new RegExp(`\\b(?:a\\s+)?team of\\s+(${NUMBER_WORD}|\\d{1,2})\\b`, "i")
const TEAM_OF_PEOPLE = new RegExp(`\\b(${NUMBER_WORD}|\\d{1,2})[- ]person team\\b`, "i")
const OWNED = /\bowned\s+((?:the|a|an)\s+)?([a-z0-9][\w'/-]*(?:\s+[\w'/-]+){0,5})/i
const STAKE = /\b(users|customers|product owners|control owners|app owners|stakeholders|auditors|the ciso|legal)\b/i
const PRESSURE = /\b(audit|incident|on-call|outage|deadline|release)\b/i
const PERSONAL_LINE = /@|\b(?:\+?1[\s.-]*)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b|\b(?:visa|h-?1b|green card|salary|compensation(?!\s+controls?)|relocation|citizenship|notice period)\b|\b(?:houston|saint louis|st\.?\s*louis)\b/i
const OTHER_PROFILE = /\b(?:jayeshwar44|jayeshwar24|eshwarjay06|eshwarjay05|saint louis|st\.?\s*louis|houston|visa|h-?1b|green card|salary|gmail)\b/i
const STARTER = new Set("The So If Want Should Where What Is This That And But When Which Who How Did Are Was Were Can Could Would Will Have Has Not Just Keep Stay Yes Yeah Why".split(" "))
const STOP = new Set("that this with what which when where your have about would could should there their them they then than into from were been being does tell describe explain walk give share over under just more some also like time thing things kind sort really okay yeah want doesn does not the and for you how did can will are was who whom why many much long any been our into".split(" "))

function cleanResume(raw: string): string {
  const text = String(raw || "").replace(/\r/g, "")
  const lower = text.toLowerCase()
  const hits = PROFILES.map((id) => ({ id, at: lower.indexOf(id) })).filter((h) => h.at >= 0).sort((a, b) => a.at - b.at)
  let sliced = text
  if (hits.length >= 2) {
    const mine = hits.find((h) => h.id === "eshwarjay05") || hits[0]
    const next = hits.find((h) => h.at > mine.at)
    sliced = text.slice(mine.at, next ? next.at : text.length)
  }
  return sliced.split("\n").filter((line) => !PERSONAL_LINE.test(line)).join("\n")
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const sp = cut.lastIndexOf(" ")
  return (sp > 24 ? cut.slice(0, sp) : cut).replace(/[,\s]+$/, "")
}

function wordsOf(s: string): string[] {
  return String(s || "").toLowerCase().replace(/[^a-z0-9+#./-]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w))
}

type Facts = {
  title: string
  employer: string
  team: string
  owned: string
  stakeholder: string
  pressure: string
  phrases: string[]
}

const TITLEISH = /\b(?:developer|engineer|analyst|administrator|admin|architect|lead|manager|consultant|specialist)\b/i

function roleFrom(resume: string): { title: string; employer: string } {
  const line = resume.split("\n").map((l) => l.trim()).find((l) => TITLEISH.test(l) && /\b(?:19|20)\d{2}\b/.test(l) && !PERSONAL_LINE.test(l))
  if (!line) return { title: "", employer: "" }
  const bare = line.replace(/\s*\|.*$/, "").replace(/\s+[—–-]\s+(?:present|current).*$/i, "").trim()
  const dash = bare.split(/\s+[—–-]\s+/)
  if (dash.length < 2) return { title: "", employer: "" }
  const a = dash[0].trim()
  const b = dash.slice(1).join(" ").trim()
  if (!a || !b) return { title: "", employer: "" }
  if (TITLEISH.test(b) && !TITLEISH.test(a)) return { employer: a, title: b }
  if (TITLEISH.test(a) && !TITLEISH.test(b)) return { title: a, employer: b }
  return { title: "", employer: "" }
}

function factsFrom(resume: string, question: string): Facts {
  const role = roleFrom(resume)
  const title = role.title
  const employer = role.employer
  const teamMatch = resume.match(TEAM) || resume.match(TEAM_OF_PEOPLE)
  const team = teamMatch ? teamMatch[1].toLowerCase() : ""
  const ownedMatch = resume.match(OWNED)
  let owned = ownedMatch ? `${ownedMatch[1] || ""}${ownedMatch[2]}`.replace(/\s+/g, " ").trim() : ""
  owned = owned.replace(/\b(?:for|and|with|so|when|while|on|that|which)\b.*$/i, "").replace(/[.,;:]+$/, "").trim()
  if (owned.split(/\s+/).length < 2) owned = ""
  const stake = resume.match(STAKE)
  const pressure = resume.match(PRESSURE)
  const qWords = new Set(wordsOf(question))
  const phrases = resume.split(/\n/).map((l) => l.replace(/^[\s•▪●\-*]+/, "").trim()).filter((l) => l.length > 24 && l.length < 180 && !/\b(?:19|20)\d{2}\b/.test(l) && /\b(?:owned|built|worked|checked|led|ran|wrote|designed|handled|migrated|tuned|partnered|mentored|managed|deployed|monitored)\b/i.test(l))
    .map((l) => ({ l, s: wordsOf(l).filter((w) => qWords.has(w)).length }))
    .sort((a, b) => b.s - a.s || a.l.length - b.l.length)
    .slice(0, 3)
    .map((x) => clip(x.l, 72))
  return {
    title: title && resume.toLowerCase().includes(title.toLowerCase()) ? title : "",
    employer: employer && resume.toLowerCase().includes(employer.toLowerCase()) ? employer : "",
    team: team && resume.toLowerCase().includes(team) ? team : "",
    owned: owned && resume.toLowerCase().includes(owned.toLowerCase()) ? owned : "",
    stakeholder: stake ? stake[1].toLowerCase() : "",
    pressure: pressure ? pressure[1].toLowerCase() : "",
    phrases,
  }
}

const FILLER = /the reason that mattered|the pressure on it was|i'?d stay with|i would stay with|the part i'?d stay with|sat on that seat|so the way (?:we|i) approached it|yeah,?\s+\S[\s\S]{0,40}is the part/i
const DANGLING = /\b(?:using|via|with|for|and|to|of|the|a|an)\.?$/i
const CATEGORY = /^[^:]{0,56}:\s+\S/

function speakResumeLine(line: string): string {
  let text = line.replace(/\s+/g, " ").trim()
  if (/^(?:owned|built|worked|checked|led|ran|wrote|designed|handled|monitored|validated|reduced|chose|defined|expanded|secured)\b/i.test(text)) {
    text = `I ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  }
  text = text.replace(/[,:;]+$/, "")
  if (!/[.!?]$/.test(text)) text = `${text}.`
  return text
}

/** Complete resume sentences. Category labels and cut-off fragments stay out. */
export function resumeSentences(resume: string): string[] {
  const out: string[] = []
  for (const raw of String(resume || "").split("\n")) {
    const line = raw.replace(/^[\s•▪●\-*]+/, "").trim()
    if (!line || PERSONAL_LINE.test(line) || OTHER_PROFILE.test(line)) continue
    if (/\b(?:19|20)\d{2}\b/.test(line) || CATEGORY.test(line) || DANGLING.test(line)) continue
    if (line.split(/\s+/).length < 6) continue
    const spoken = speakResumeLine(line)
    if (FILLER.test(spoken) || !lineOk(spoken, resume)) continue
    if (!out.includes(spoken)) out.push(clip(spoken, 180))
  }
  return out
}

function rankLines(question: string, transcript: string, lines: string[]): string[] {
  const bag = new Set(wordsOf(`${question} ${lastHeardLine(transcript)}`))
  return [...lines].sort((a, b) => {
    const score = (line: string) => wordsOf(line).filter((word) => bag.has(word)).length
    return score(b) - score(a) || a.length - b.length
  })
}

function buildBreakdown(lines: string[]): { claim: string; context: string; result: string } {
  const claim = lines[0] || ""
  const context = lines.find((line) => line !== claim) || ""
  const result = lines.find((line) => line !== claim && line !== context && /\b(?:reduced|validated|stopped|improved|cut|dropped|checked)\b/i.test(line))
    || lines.find((line) => line !== claim && line !== context)
    || ""
  return { claim, context, result }
}

function touchFrom(line: string): string {
  const words = line.replace(/[.]+$/, "").split(/\s+/).slice(0, 10)
  while (words.length > 4 && DANGLING.test(words[words.length - 1])) words.pop()
  return words.join(" ")
}

function buildLeads(lines: string[]): string[] {
  return lines.filter((line) => !FILLER.test(line)).slice(0, 3)
}

function buildTouches(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const touch = touchFrom(line)
    if (!touch || FILLER.test(touch) || touch.split(/\s+/).length < 4 || out.includes(touch)) continue
    out.push(touch)
    if (out.length === 4) break
  }
  return out
}

type Kind = "design" | "story" | "compare" | "definition" | "follow" | "work"

function kindOf(question: string): Kind {
  const q = question.trim()
  if (/^(?:why|how come)\b|\bhow did you verify\b|\bwhat happened next\b|\bcan you expand\b|\bgo deeper\b/i.test(q) || q.split(/\s+/).length <= 4) return "follow"
  if (/\b(?:design|how would you (?:build|design|architect))\b/i.test(q)) return "design"
  if (/\b(?:tell me about a time|describe a (?:time|situation)|walk me through a time|a time you|incident you)\b/i.test(q)) return "story"
  if (/\b(?:difference|versus|vs\.?|compare|compared to)\b/i.test(q)) return "compare"
  if (/^(?:what is|what does|define|explain what)\b/i.test(q)) return "definition"
  return "work"
}

function groundedTopic(question: string, resume: string): string {
  const bag = resume.toLowerCase()
  const kept = wordsOf(question).filter((w) => bag.includes(w)).slice(0, 3)
  return kept.join(" ")
}

function buildQuestions(question: string, transcript: string, resume: string): string[] {
  if (PERSONAL_LINE.test(question) && !/\b(?:compensation controls?|experience)\b/i.test(question)) {
    return [
      "Should I leave that and talk about the work?",
      "Is there a technical part you want next?",
      "Want me to pick up the last work question?",
    ]
  }
  const topic = groundedTopic(question, resume)
  const onTopic = topic ? `Want me to stay on ${topic}, or go one step deeper?` : "Want me to go one step deeper?"
  const prior = /\bThem:\s*.{12,}/i.test(transcript) && !new RegExp(question.slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(transcript.slice(0, Math.max(0, transcript.length - question.length)))
  const connect = prior ? "Should I stay with the last question, or move to this one?" : ""
  const kind = kindOf(question)
  const bank: Record<Kind, string[]> = {
    design: [
      "What constraint should I treat as fixed here?",
      "Is the part that matters the first break, or what happens after?",
      onTopic,
    ],
    story: [
      "Want the decision, or what changed after?",
      "Should I stop at the moment, or the part that followed?",
      "Where should I cut this if it runs long?",
    ],
    compare: [
      "Which of the two sides matters more here?",
      "Should I stop at the difference, or say when I would pick one?",
      "Want me to keep this to those two, and nothing beside them?",
    ],
    definition: [
      "Want me to stay on the definition?",
      "Should I tie it back to the work, or leave it as the idea?",
      "Is one sentence enough, or do you want the edge case?",
    ],
    follow: [
      connect || "Should I stay on the last point, or open this one?",
      "Want the check I used, or the result?",
      "Where should I stop?",
    ],
    work: [
      "What part of this do you want first?",
      onTopic,
      connect || "Want me to keep this short and stop for you?",
    ],
  }
  const out: string[] = []
  for (const q of bank[kind]) {
    const line = q.replace(/\s+/g, " ").trim()
    if (!line || out.includes(line)) continue
    out.push(line.endsWith("?") ? line : `${line}?`)
    if (out.length === 3) break
  }
  while (out.length < 2) out.push("Where should I stop if this runs long?")
  return out.slice(0, 3)
}

function foreignTokens(line: string, resume: string): string[] {
  const corpus = resume.toLowerCase()
  const bad: string[] = []
  if (PERSONAL_LINE.test(line) || OTHER_PROFILE.test(line)) bad.push("personal")
  for (const n of line.match(/\d+(?:\.\d+)?/g) || []) if (!corpus.includes(n)) bad.push(n)
  const team = line.toLowerCase().match(new RegExp(`\\bteam of\\s+(${NUMBER_WORD}|\\d{1,2})\\b`))
  if (team && !corpus.includes(team[1])) bad.push(team[1])
  for (const w of line.match(/\b[A-Z][A-Za-z0-9]{2,}\b/g) || []) {
    if (STARTER.has(w)) continue
    if (!corpus.includes(w.toLowerCase())) bad.push(w)
  }
  return bad
}

function lineOk(line: string, resume: string): boolean {
  return !!line && foreignTokens(line, resume).length === 0
}

function fill(lines: string[], fallback: string[], resume: string, min: number, max: number): string[] {
  const out: string[] = []
  for (const line of [...lines, ...fallback]) {
    const t = clip(line, 220)
    if (!lineOk(t, resume) || out.includes(t)) continue
    out.push(t)
    if (out.length === max) break
  }
  return out.slice(0, Math.max(min, Math.min(max, out.length)))
}

const WRAP = /\b(?:any questions|to wrap up|that covers|does that make sense|moving on|that's all|in summary|we'll stop|last thing)\b/i
const LEAD_ASK = /^(?:so[, ]+)?(?:have you|did you|do you|are you|were you|can you|could you|would you|tell me|walk me through)\b/i

/** The newest heard line. A later caption wins over an older Them line. */
export function lastHeardLine(transcript: string): string {
  const lines = String(transcript || "").split("\n").map((l) => l.trim()).filter(Boolean)
  const last = lines[lines.length - 1] || ""
  return last.replace(/^(?:Them|You):\s*/i, "").trim()
}

/** Boosters while they are explaining. Questions after a question or a wrap-up. */
export function asideModeFromTranscript(transcript: string, question = ""): AsideMode {
  const line = lastHeardLine(transcript) || String(question || "").trim()
  if (!line) return "questions"
  if (WRAP.test(line) || /\?\s*$/.test(line) || LEAD_ASK.test(line)) return "questions"
  if (/^(?:what|why|how|who|when|where)\b/i.test(line) && !/\b(?:happens|we have|this is|there is|there are)\b/i.test(line)) return "questions"
  return "boosters"
}

function buildBoosters(transcript: string, lines: string[]): string[] {
  const bag = new Set(wordsOf(lastHeardLine(transcript)))
  const hit = lines.filter((line) => wordsOf(line).some((word) => bag.has(word)))
  const pool = (hit.length ? hit : lines).filter((line) => !FILLER.test(line)).slice(0, 3)
  return pool
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function askedName(question: string): string {
  const m = question.match(/\b(?:worked with|worked at|work at|work with|used|using|familiar with|experience with|been at|been with|know)\s+([A-Za-z][\w&.'-]*(?:\s+[A-Za-z][\w&.'-]*){0,3})/i)
  if (!m) return ""
  return m[1].replace(/\b(?:before|yet|already|there|here)\b/gi, "").replace(/[?.!,]+$/g, "").trim()
}

/** The resume's own spelling when the asked name is the same words, ignoring spaces. */
function surfaceInResume(name: string, resume: string): string {
  if (!name) return ""
  const exact = resume.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
  if (exact) return exact[0]
  const target = squash(name)
  if (target.length < 4) return ""
  const words = resume.split(/[^A-Za-z0-9&.-]+/).filter((w) => /[A-Za-z]/.test(w))
  for (let i = 0; i < words.length; i++) {
    let acc = ""
    const parts: string[] = []
    for (let j = i; j < Math.min(words.length, i + 4); j++) {
      acc += squash(words[j])
      parts.push(words[j])
      if (acc === target) return parts.join(" ")
      if (!target.startsWith(acc)) break
    }
  }
  return ""
}

/** Yes/no and short "have you worked with X" asks. Null means the long answer still runs. */
export function isShortFactAsk(question: string): boolean {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  if (!q || q.length > 160 || q.split(/\s+/).length > 18) return false
  if (/\b(?:how would|walk me|tell me about a time|design|difference between|compare|have you done)\b/i.test(q)) return false
  return /^(?:have you|did you|do you|are you|were you)\b/i.test(q) && /\b(?:worked|used|use|familiar|experience|been|done|know)\b/i.test(q)
}

/** One sentence from the resume only. A missing name stays "Not directly". */
export function shortFactAnswer(question: string, resumeRaw: string): ShortFact | null {
  if (!isShortFactAsk(question)) return null
  const resume = cleanResume(resumeRaw)
  const name = askedName(question)
  const surface = name ? surfaceInResume(name, resume) : ""
  const facts = factsFrom(resume, question)
  let text = ""
  if (surface) {
    text = facts.title && facts.employer && surface.toLowerCase() === facts.employer.toLowerCase()
      ? `Yes, that was ${facts.title} at ${facts.employer}.`
      : `Yes, ${surface} is on the resume.`
  } else if (name) {
    const known = lookupTerm("eshwarjay05", name)
    if (known) {
      text = `Yes, ${known.surface} is on the resume.`
    } else {
      const pivot = facts.title && facts.employer
        ? `I was the ${facts.title} at ${facts.employer}`
        : facts.owned
          ? `I owned ${facts.owned}`
          : "that name is not on the resume"
      text = `Not directly, but ${pivot}.`
    }
  } else {
    text = "Not directly. I won't add a name the resume doesn't have."
  }
  const knownSurface = name ? lookupTerm("eshwarjay05", name)?.surface || "" : ""
  if (!lineOk(text, knownSurface && text.includes(knownSurface) ? `${resume}\n${knownSurface}` : resume)) text = "Not directly. I won't add a name the resume doesn't have."
  const checked = validateStatement(text, resumeRaw)
  if (!checked.ok && !checked.line) return { text: "Not directly. I won't add a name the resume doesn't have.", booster: "" }
  text = checked.ok ? text : checked.line
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean)
  text = sentences[0] || text
  const booster = surface ? "Yeah, that's true." : ""
  return { text, booster }
}

function triggerSpan(transcript: string, question: string): string {
  const last = lastHeardLine(transcript)
  if (last) return `Them: ${last.slice(0, 140)}`
  if (question) return `Question: ${question.slice(0, 140)}`
  return "resume touch already on this answer"
}

function keepLine(line: string, transcript: string, said: string[], fallbackWhy: string, resume = ""): { line: string; why: string } | null {
  const screened = screenSuggestion(line, transcript, said)
  if (!screened.line) return null
  const checked = validateStatement(screened.line, resume)
  if (!checked.ok && !checked.line) return null
  return { line: checked.ok ? screened.line : checked.line, why: checked.ok ? screened.why || fallbackWhy : checked.reason }
}

/** Context, questions, and boosters. Pure. Same input, same panel. No model call. */
export function answerAside(input: { question?: string; transcript?: string; resume?: string; said?: string[]; nudge?: string; clarify?: string }): AnswerAside {
  const question = String(input.question || "").replace(/\s+/g, " ").trim()
  const transcript = String(input.transcript || "").slice(0, 12000)
  const said = (input.said || []).map((line) => String(line || "")).filter(Boolean)
  const resume = cleanResume(String(input.resume || ""))
  const why = triggerSpan(transcript, question)
  const spoken = rankLines(question, transcript, resumeSentences(resume))
  const breakdown = buildBreakdown(spoken)
  const leads = buildLeads(spoken)
  const touches = buildTouches(spoken)
  const curious = ["Why do you think that's happening?"]
  if (/control owners/i.test(`${transcript}\n${resume}`)) curious.push("Are there a lot of control owners there?")
  const seededQuestion = clarifySeedLine(question, "clarifying_question")
  const questions = fill([...curious, ...buildQuestions(question, transcript, resume)], [
    "What part of this do you want first?",
    "Want me to keep this short and stop for you?",
    "Where should I stop if this runs long?",
  ], resume, 2, 3)
  if (seededQuestion && !questions.includes(seededQuestion)) {
    if (questions.length >= 3) questions[2] = seededQuestion
    else questions.push(seededQuestion)
  }
  const boosters = buildBoosters(transcript, spoken).filter((line) => {
    if (!line || FILLER.test(line)) return false
    return !/handoff|bottleneck/i.test(line) || /handoff|bottleneck/i.test(transcript)
  }).slice(0, 3)
  const mode = asideModeFromTranscript(transcript, question)
  const cue = longStatementCue(lastHeardLine(transcript), mode)
  const trace: AsideTrace[] = []
  const take = (lines: string[], min: number, fallback: string[]) => {
    const out: string[] = []
    for (const line of lines) {
      const kept = keepLine(line, transcript, said, why, resume)
      if (!kept || out.includes(kept.line)) continue
      out.push(kept.line)
      trace.push(kept)
      if (out.length === 4) break
    }
    for (const line of fallback) {
      if (out.length >= min) break
      const kept = keepLine(line, transcript, said, why, resume)
      if (!kept || out.includes(kept.line)) continue
      out.push(kept.line)
      trace.push(kept)
    }
    return out
  }
  const nudgeKept = input.nudge ? keepLine(input.nudge, transcript, said, why, resume) : null
  const say = nudgeKept || (cue.sayNow ? keepLine(cue.sayNow, transcript, said, why, resume) : null)
  if (input.clarify) questions.unshift(input.clarify)
  const summary = cue.summary ? keepLine(cue.summary, transcript, said, why, resume) : null
  if (summary) trace.push(summary)
  if (say) trace.push(say)
  const claimSpans = extractClaims(transcript, said).map((claim) => claim.span)
  return {
    question,
    mode,
    context: {
      leads: take(leads, 0, []).filter((line) => !FILLER.test(line)).slice(0, 3),
      touchPoints: take(touches, 0, []).filter((line) => !FILLER.test(line)).slice(0, 4),
    },
    questions: take(questions.length >= 2 ? questions.slice(0, 3) : [
      "What part of this do you want first?",
      "Want me to keep this short and stop for you?",
    ], 2, ["What part of this do you want first?", "Want me to keep this short and stop for you?"]).slice(0, 3),
    boosters: take(boosters, 0, []).filter((line) => !FILLER.test(line)).slice(0, 3),
    summary: summary?.line && !FILLER.test(summary.line) ? summary.line : "",
    sayNow: say?.line && !FILLER.test(say.line) ? say.line : "",
    claims: claimSpans,
    breakdown,
    partial: lastHeardLine(transcript),
    trace,
  }
}

/** Names and numbers in the panel that the kept resume and the already-said claims do not contain. */
export function asideViolations(aside: AnswerAside, resume: string, transcript = ""): string[] {
  const kept = `${cleanResume(resume)}\n${transcript}\n${(aside.claims || []).join("\n")}`
  const lines = [...aside.context.leads, ...aside.context.touchPoints, ...aside.questions, ...(aside.boosters || []), aside.summary || "", aside.sayNow || ""]
  return lines.flatMap((line) => foreignTokens(line, kept))
}
