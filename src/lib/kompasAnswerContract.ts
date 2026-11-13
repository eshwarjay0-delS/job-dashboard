// Answer-engine contract helpers (Nov 10 2026, from the Parakeet master report §4).
// Pure functions only, no imports, so the answer service and the tests share one implementation.
//   1. tailWindow           the transcript window is kept from the END (newest speech), never clipped silently at 4,000 chars
//   2. unpinStale           a pinned title yields to a newer interviewer ask in the heard window; placeholder titles never pin
//   3. derive in one hop    see answerForVerifiedUser: `derive: true` derives inside the answer request (helpers here: wantsInlineDerive)
//   4. answerFormat/toCard  Script + bullets is the default card layout, built from the guarded spoken text
//   5. resumeState          empty-resume hard path: knowledge vs personal, with a deterministic post-gate

// ---------- 1. transcript window ----------
export const TRANSCRIPT_MAX_CHARS = 20000

/** Keep the newest `max` characters, cut on a line boundary. `clipped` is reported, never silent. */
export function tailWindow(v: unknown, max = TRANSCRIPT_MAX_CHARS): { text: string; clipped: boolean } {
  if (typeof v !== "string") return { text: "", clipped: false }
  const t = v.trim()
  if (t.length <= max) return { text: t, clipped: false }
  let cut = t.slice(t.length - max)
  const nl = cut.indexOf("\n")
  if (nl >= 0 && nl < Math.min(400, cut.length - 1)) cut = cut.slice(nl + 1)
  return { text: cut.trim(), clipped: true }
}

// ---------- 2. stale / placeholder titles ----------
const PLACEHOLDER = /^(?:\u2026|\.{3}|preparing\b.*|ready\.?|cleared\.?|no question(?: yet)?\.?|listening\b.*|deriving the question\b.*|generating\b.*|waiting\b.*|question detected\.?|checking\b.*|thinking\b.*)$/i

export function isPlaceholderTitle(t: unknown): boolean {
  const s = String(t ?? "").replace(/\s+/g, " ").trim()
  return !s || PLACEHOLDER.test(s)
}

const ASK_START = /^(?:what|which|who|whom|why|how|where|when|can|could|would|will|do|does|did|have|has|are|is|tell|describe|explain|give|walk|share|suppose|imagine|assume|if|given|consider|talk)\b/i
const STOP = new Set("that this with what which when where your have about would could should there their them they then than into from were been being does tell describe explain walk give share over under just more some also like time thing things kind sort really okay yeah".split(" "))

function words(s: string): string[] {
  return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w))
}

/** The last interviewer ask in a speaker-labelled window ("Them:" lines, not "Them (earlier):"). "" when none. */
export function lastInterviewerAsk(heard: string): string {
  const lines = String(heard || "").split("\n").map((l) => l.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^Them:\s*(.+)$/i)
    if (!m) continue
    const sentences = m[1].split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean)
    for (let j = sentences.length - 1; j >= 0; j--) {
      const s = sentences[j]
      if (s.split(/\s+/).length >= 4 && (/\?$/.test(s) || ASK_START.test(s))) return s
    }
    return ""   // the newest interviewer line holds no ask: do not reach back past it
  }
  return ""
}

export type UnpinResult = { derived: string; pinned: boolean; unpinned: "" | "placeholder" | "newer-ask" }

/**
 * A title the client pinned (often the card's previous question) must not survive a newer, different interviewer ask.
 * Typed questions stay pinned. A re-ask ("again") stays pinned. Placeholder sentinels are never a title.
 */
export function unpinStale(o: { heard: string; derived: string; pinned: boolean; again?: boolean }): UnpinResult {
  const derived = String(o.derived || "").trim()
  if (derived && isPlaceholderTitle(derived)) return { derived: "", pinned: false, unpinned: "placeholder" }
  if (!o.pinned || o.again || !derived) return { derived, pinned: !!o.pinned && !!derived, unpinned: "" }
  const heard = String(o.heard || "")
  if (/(?:^|\n)\s*You \(typed\):/i.test(heard)) return { derived, pinned: true, unpinned: "" }
  const ask = lastInterviewerAsk(heard)
  if (!ask) return { derived, pinned: true, unpinned: "" }
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  if (key(derived).includes(key(ask))) return { derived, pinned: true, unpinned: "" }
  const a = words(ask)
  if (!a.length) return { derived, pinned: true, unpinned: "" }
  const d = new Set(words(derived))
  const overlap = a.filter((w) => d.has(w)).length / a.length
  if (overlap >= 0.34) return { derived, pinned: true, unpinned: "" }
  return { derived: "", pinned: false, unpinned: "newer-ask" }
}

// ---------- 3. one-hop derive ----------
/** The answer request derives its own question when asked to, or when it arrives with raw heard text and no title. */
export function wantsInlineDerive(body: Record<string, unknown>): boolean {
  if (body.deriveOnly || body.pinned === true) return false
  if (body.derive === true) return true
  return false
}

// ---------- 4. Script + bullets ----------
export type AnswerFormat = "script_bullets" | "full_script" | "bullets"
export type AnswerCard = { format: AnswerFormat; script: string; bullets: string[]; title?: string }

export function answerFormat(config: Record<string, unknown> | undefined): AnswerFormat {
  const v = String(config?.format ?? "").toLowerCase().replace(/[\s+_-]+/g, "")
  if (/^(?:full|fullscript|script|paragraph|paragraphs|prose)$/.test(v)) return "full_script"
  if (/^(?:bullets|bullet|bulletpoints|points)$/.test(v)) return "bullets"
  return "script_bullets"
}

/** Sentence split that leaves e.g., i.e., U.S., version numbers and decimals alone. */
export function spokenSentences(text: string): string[] {
  const t = String(text || "").replace(/\s+/g, " ").trim()
  if (!t) return []
  const guarded = t.replace(/\b(e\.g|i\.e|etc|vs|U\.S|Mr|Ms|Dr|approx)\./gi, (m) => m.replace(/\./g, "\u0000"))
  return guarded.split(/(?<=[.!?]["\u201d)]?)\s+(?=["\u201c(]?[A-Z0-9])/).map((s) => s.replace(/\u0000/g, ".").trim()).filter(Boolean)
}

function pack(items: string[], max: number): string[] {
  if (items.length <= max) return items
  const out: string[] = []
  const per = items.length / max
  for (let i = 0; i < max; i++) out.push(items.slice(Math.round(i * per), Math.round((i + 1) * per)).join(" "))
  return out.filter(Boolean)
}

/** Card layout from the final guarded spoken text. Code answers and full-script stay whole. */
export function toCard(text: string, format: AnswerFormat, length?: string): AnswerCard {
  const t = String(text || "").trim()
  if (!t) return { format, script: "", bullets: [] }
  if (/```/.test(t) || format === "full_script") return { format: /```/.test(t) ? "full_script" : format, script: t, bullets: [] }
  const short = /^short$/i.test(String(length || ""))
  const max = short ? 3 : 4
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean)
  const marked = lines.filter((l) => /^(?:[-*\u2022]|\d+[.)])\s+/.test(l))
  if (marked.length >= 2) {
    const items = marked.map((l) => l.replace(/^(?:[-*\u2022]|\d+[.)])\s+/, ""))
    const head = lines.filter((l) => !marked.includes(l)).join(" ")
    if (format === "bullets") return { format, script: "", bullets: pack(head ? [head, ...items] : items, max) }
    return head ? { format, script: head, bullets: pack(items, max) } : { format, script: items[0], bullets: pack(items.slice(1), max) }
  }
  const s = spokenSentences(t)
  if (format === "bullets") return { format, script: "", bullets: pack(s, max) }
  const [first, ...rest] = s
  return { format, script: first || "", bullets: pack(rest, max) }
}

// ---------- 5. empty resume ----------
export type ResumeState = "grounded" | "knowledge" | "personal-no-resume"

export function resumeState(o: { resume?: string; documents?: string; dossier?: string; personal: boolean }): ResumeState {
  if ((o.resume || "").trim() || (o.documents || "").trim() || (o.dossier || "").trim()) return "grounded"
  return o.personal ? "personal-no-resume" : "knowledge"
}

export const NO_RESUME_OPENER = "I don't have my resume loaded here, so hypothetically:"
export const NO_RESUME_REFUSAL = "I don't have my resume loaded here, so I won't make up a story. Load it and ask again, or ask how I'd approach it."

export function resumeStatePrompt(state: ResumeState): string {
  if (state === "knowledge") return "NO RESUME LOADED (hard rule): answer as knowledge. Say nothing about his own career: no employer, team, teammate, project, incident, tool rollout or result of his. Use present tense or \"I'd\"."
  if (state === "personal-no-resume") return `NO RESUME LOADED, PERSONAL QUESTION (hard rule): you have no history for him. Never invent an employer, teammate, project, tool trial, incident or metric. Begin with exactly "${NO_RESUME_OPENER}" and then say how he would handle it, in "I'd" form, in two to four sentences.`
  return ""
}

const CAREER_CLAIM = new RegExp([
  String.raw`\b(?:at|when I was at|while at|back at)\s+[A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)*\s*,?\s+(?:I|we)\b`,
  String.raw`\bin my (?:last|previous|current|old|first) (?:role|job|team|company|position)\b`,
  String.raw`\b(?:my|our) (?:team|manager|teammate|lead|company|employer|director|ciso|org)\b`,
  String.raw`\b(?:I|we) (?:led|built|ran|managed|owned|worked|handled|implemented|deployed|migrated|caught|found|fixed|rolled out|shipped|cut|reduced|trialed|trialled|piloted|inherited|discovered|noticed|pushed back|escalated|convinced|had a|once had)\b`,
  String.raw`\b(?:one time|once),?\s+(?:I|we|a teammate|my)\b`,
].join("|"), "i")
const HYPOTHETICAL = /\b(?:hypothetical(?:ly)?|don't have my resume|resume (?:isn't|is not) loaded)\b/i

/** Deterministic post-gate. Prompts are not a gate: invented career sentences are removed when no resume exists. */
export function enforceResumeState(text: string, state: ResumeState): { text: string; dropped: number } {
  const t = String(text || "").trim()
  if (state === "grounded" || !t || /```/.test(t)) return { text: t, dropped: 0 }
  const parts = spokenSentences(t)
  const kept = parts.filter((s) => !CAREER_CLAIM.test(s) || /\b(?:I'd|I would)\b/.test(s))
  const dropped = parts.length - kept.length
  if (state === "knowledge") return { text: kept.length ? kept.join(" ") : t, dropped: kept.length ? dropped : 0 }
  if (!kept.length) return { text: NO_RESUME_REFUSAL, dropped }
  const joined = kept.join(" ")
  if (HYPOTHETICAL.test(kept[0])) return { text: joined, dropped }
  const lead = /^(?:I\b|I'|[A-Z]{2,})/.test(joined) ? joined : joined.charAt(0).toLowerCase() + joined.slice(1)
  return { text: `${NO_RESUME_OPENER} ${lead}`, dropped }
}

// ---------- 6. mid-call controls (format, length, tone, STAR) ----------
// Read from `config` on EVERY request, so a change mid-call applies to the next card. Nothing is pinned at session start.
export type AnswerLength = "short" | "balanced" | "long"
export type AnswerTone = "simple" | "formal" | "professional"
export type AnswerControls = { format: AnswerFormat; length: AnswerLength; tone: AnswerTone; star: boolean }

export function answerControls(config: Record<string, unknown> | undefined): AnswerControls {
  const c = config || {}
  const len = String(c.length ?? "").toLowerCase()
  const tone = String(c.tone ?? "").toLowerCase()
  const star = c.star === true || /^(?:on|true|yes|1)$/i.test(String(c.star ?? ""))
  return {
    format: answerFormat(c),
    length: /^(?:short|brief|concise)$/.test(len) ? "short" : /^(?:long|detailed|deep)$/.test(len) ? "long" : "balanced",
    tone: /^formal$/.test(tone) ? "formal" : /^professional$/.test(tone) ? "professional" : "simple",
    star,
  }
}

export function controlsPrompt(k: AnswerControls): string {
  const lines = [`CARD CONTROLS (set by him for this card): format ${k.format.replace("_", " + ")}, length ${k.length}, tone ${k.tone}, STAR ${k.star ? "on" : "off"}.`]
  if (k.format === "script_bullets") lines.push("Sentence one is the opening line he says out loud; then two to four short sentences, one point each, that read as bullets.")
  if (k.format === "bullets") lines.push(k.length === "short" ? "Three terse points, one sentence each, no opening line." : "Three or four points, one sentence each, no opening line.")
  if (k.format === "full_script") lines.push("A short spoken paragraph.")
  if (k.length === "short") lines.push("Keep it short: the fewest words that answer it.")
  if (k.length === "long") lines.push("Go one level deeper than usual on the how, not on background.")
  lines.push(k.tone === "simple" ? "Tone: plain words, no jargon he would not say out loud." : k.tone === "formal" ? "Tone: formal and precise, still spoken, no slang." : "Tone: professional and direct.")
  lines.push(k.star ? "STAR is on: for a story, one sentence of situation and task, most of the words on his actions, one sentence on the result. Do not print the labels." : "STAR is off: do not structure it as situation-task-action-result and never print those labels.")
  return lines.join(" ")
}

// ---------- 7. semantic card title, same call ----------
export const TITLE_INSTRUCTION = "FIRST LINE: write `TITLE: ` and a 3-10 word title for this card in the interviewer's terms (a clean question or topic, pronouns resolved, no filler), then a newline, then the answer. The title line is never spoken."

/** Pulls a leading "TITLE: ..." line out of a streamed answer. Everything else passes through unchanged. */
export function createTitleSplitter() {
  let buf = ""
  let decided = false
  let title = ""
  return {
    get title() { return title },
    push(d: string): string {
      if (decided) return d
      buf += d
      const lead = buf.replace(/^\s+/, "")
      if (lead.length >= 6 && !/^title\s*:/i.test(lead)) { decided = true; const out = buf; buf = ""; return out }
      if (lead.length < 6 && "title:".startsWith(lead.toLowerCase().slice(0, 6))) return ""
      const nl = lead.indexOf("\n")
      if (nl < 0) { if (lead.length > 200) { decided = true; const out = buf; buf = ""; return out } return "" }
      title = cleanTitle(lead.slice(0, nl).replace(/^title\s*:\s*/i, ""))
      decided = true
      const rest = lead.slice(nl + 1).replace(/^\s+/, "")
      buf = ""
      return rest
    },
    flush(): string { if (decided) return ""; decided = true; const out = buf; buf = ""; return out },
  }
}

export function splitTitle(text: string): { title: string; body: string } {
  const s = createTitleSplitter()
  const body = s.push(String(text || "")) + s.flush()
  return { title: s.title, body }
}

function cleanTitle(t: string): string {
  return String(t || "").replace(/[*_`#"\u201c\u201d]/g, "").replace(/\s+/g, " ").trim().slice(0, 120)
}

/** Deterministic title when the model gave none: the asked question, tidied. Never a placeholder. */
export function fallbackTitle(question: string): string {
  const q = String(question || "").replace(/^\s*(?:(?:so|okay|ok|alright|um+|uh+|yeah|well)[,\s]+)+/i, "").replace(/\s+/g, " ").trim()
  if (!q) return ""
  const first = q.split(/(?<=[?])\s+/)[0]
  const words = first.split(" ")
  const t = words.length > 16 ? words.slice(0, 16).join(" ") + "\u2026" : first
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** The first complete sentence of what is already on screen, for an early partial card. "" until one exists. */
export function firstSentence(shown: string): string {
  const s = String(shown || "").replace(/\s+/g, " ").trimStart()
  const m = s.match(/^(.+?[.!?]["\u201d)]?)\s/)
  return m && m[1].split(" ").length >= 4 ? m[1].trim() : ""
}
