// Context panel for the live answer (owner, 12 Nov 2026, 8:32 PM CT).
// Deterministic. Built from the resume already on the answer request.
// No second model call, no poll. The spoken answer is untouched.
//
// Leads and touch points may name a team size, a title, an employer, a tool,
// or a stakeholder only when that string is in this resume. A second profile
// in the same text is dropped. Email, phone, city, visa, and pay are not spoken.

export type AsideMode = "questions" | "boosters"

export type AnswerAside = {
  question: string
  /** What section 2 shows until the live transcript cue or a manual toggle says otherwise. */
  mode: AsideMode
  context: { leads: string[]; touchPoints: string[] }
  questions: string[]
  boosters: string[]
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

function safeLeads(team: boolean): string[] {
  const way = team ? "So the way we approached it starts from what they just asked." : "So the way I approached it starts from what they just asked."
  return [
    way,
    "The reason that mattered is the part of the question I can actually answer.",
    "If I stall, I come back to the part they asked.",
  ]
}

function buildLeads(f: Facts): string[] {
  const out: string[] = []
  const way = f.team ? "we" : "I"
  if (f.team && f.owned && f.stakeholder) {
    out.push(`I was on a team of ${f.team} and owned ${f.owned}, so I was checking in with ${f.stakeholder} constantly.`)
  } else if (f.team && f.owned) {
    out.push(`I was on a team of ${f.team} and owned ${f.owned}, so the way we approached it started there.`)
  } else if (f.owned && f.stakeholder) {
    out.push(`I owned ${f.owned}, so I was checking in with ${f.stakeholder} as that moved.`)
  } else if (f.owned) {
    out.push(`I owned ${f.owned}, so the reason that mattered was keeping that piece honest.`)
  }
  if (f.title && f.employer) out.push(`I was the ${f.title} at ${f.employer}, so the reason that mattered sat on that seat.`)
  else if (f.title) out.push(`I was in the ${f.title} seat, so the way ${way === "we" ? "we" : "I"} approached it came from that work.`)
  if (f.pressure && out.length < 3) out.push(`The pressure on it was the ${f.pressure}, so the reason that mattered was getting that part right.`)
  if (f.phrases[0] && out.length < 3) {
    const phrase = f.phrases[0].replace(/[.]+$/, "")
    out.push(`So the way ${way} approached it was ${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}.`)
  }
  for (const s of safeLeads(!!f.team)) {
    if (out.length >= 2 && out.length >= 3) break
    if (out.length >= 3) break
    if (!out.includes(s)) out.push(s)
    if (out.length >= 3) break
  }
  return out.slice(0, 3)
}

function buildTouches(f: Facts): string[] {
  const out = [
    f.team ? "so the way we approached it" : "so the way I approached it",
    "the reason that mattered",
  ]
  if (f.owned) out.push("what I owned")
  else out.push("where I would start")
  const phrase = f.phrases[0] ? clip(f.phrases[0], 42) : ""
  if (phrase) out.push(phrase.charAt(0).toLowerCase() + phrase.slice(1))
  else out.push("the part they asked")
  return out.slice(0, 4)
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

function buildBoosters(transcript: string, resume: string): string[] {
  const last = lastHeardLine(transcript)
  const bag = resume.toLowerCase()
  const out = ["Yeah, that's true."]
  if (/\bhandoffs?\b/i.test(bag)) out.push("I've seen that bottleneck too, systems with a lot of handoffs.")
  const noun = wordsOf(last).find((w) => bag.includes(w) && w.length >= 5)
  if (noun) out.push(`I've seen that with ${noun} too.`)
  out.push("I'd stay with what you just said.")
  return out
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
  if (/\b(?:how would|walk me|tell me about a time|design|difference between|compare)\b/i.test(q)) return false
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
    const pivot = facts.title && facts.employer
      ? `I was the ${facts.title} at ${facts.employer}`
      : facts.owned
        ? `I owned ${facts.owned}`
        : "that name is not on the resume"
    text = `Not directly, but ${pivot}.`
  } else {
    text = "Not directly. I won't add a name the resume doesn't have."
  }
  if (!lineOk(text, resume)) text = "Not directly. I won't add a name the resume doesn't have."
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean)
  text = sentences[0] || text
  const booster = surface ? "Yeah, that's true." : ""
  return { text, booster }
}

/** Context, questions, and boosters. Pure. Same input, same panel. No model call. */
export function answerAside(input: { question?: string; transcript?: string; resume?: string }): AnswerAside {
  const question = String(input.question || "").replace(/\s+/g, " ").trim()
  const transcript = String(input.transcript || "").slice(0, 4000)
  const resume = cleanResume(String(input.resume || ""))
  const facts = factsFrom(resume, question)
  const leads = fill(buildLeads(facts), safeLeads(!!facts.team), resume, 2, 3)
  const touches = fill(buildTouches(facts), ["so the way I approached it", "the reason that mattered", "the part they asked", "where I would start"], resume, 3, 4)
  const curious = ["Why do you think that's happening?"]
  if (/control owners/i.test(`${transcript}\n${resume}`)) curious.push("Are there a lot of control owners there?")
  const questions = fill([...curious, ...buildQuestions(question, transcript, resume)], [
    "What part of this do you want first?",
    "Want me to keep this short and stop for you?",
    "Where should I stop if this runs long?",
  ], resume, 2, 3)
  const boosters = fill(buildBoosters(transcript, resume), [
    "Yeah, that's true.",
    "I'd stay with what you just said.",
    "That matches the part I can speak to.",
  ], resume, 2, 3)
  return {
    question,
    mode: asideModeFromTranscript(transcript, question),
    context: {
      leads: leads.length >= 2 ? leads : safeLeads(false).slice(0, 3),
      touchPoints: touches.length >= 3 ? touches : ["so the way I approached it", "the reason that mattered", "the part they asked"],
    },
    questions: questions.length >= 2 ? questions.slice(0, 3) : [
      "What part of this do you want first?",
      "Want me to keep this short and stop for you?",
    ],
    boosters: boosters.length >= 2 ? boosters.slice(0, 3) : ["Yeah, that's true.", "I'd stay with what you just said."],
  }
}

/** Names and numbers in the panel that the kept resume does not contain. */
export function asideViolations(aside: AnswerAside, resume: string): string[] {
  const kept = cleanResume(resume)
  const lines = [...aside.context.leads, ...aside.context.touchPoints, ...aside.questions, ...(aside.boosters || [])]
  return lines.flatMap((line) => foreignTokens(line, kept))
}
