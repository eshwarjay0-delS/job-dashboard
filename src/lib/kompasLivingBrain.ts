// One living brain for every Kompas answer path.
// The document is Markdown. Each chunk is a tagged block. The five older
// stores are read into it and left in place. Nothing here calls a model.

import { HOUSTON_RESUME } from "./kompasHonestyGate.ts"

export const BRAIN_SECTIONS = [
  "Identity & Personality",
  "What I Know",
  "Talents & Signature Stories",
  "How I Answer",
  "Category Knowledge",
  "Role Lenses",
  "Learned From Sessions",
  "Feedback Log",
  "What I'm Working On",
] as const

export type BrainSection = (typeof BRAIN_SECTIONS)[number]

export type BrainChunk = {
  id: string
  section: BrainSection
  tags: string[]
  weight: number
  enabled: boolean
  source: string
  body: string
}

export type BrainDocument = {
  revision: number
  updatedAt: string
  chunks: BrainChunk[]
}

export type BrainTrace = { id: string; section: string; why: string }

export type BrainSources = {
  houston: string
  persona?: string
  books?: { q: string; a: string }[]
  dossierSessions?: { id?: string; field?: string; qa?: { q: string; a: string }[] }[]
  masterChunks?: { title?: string; text: string }[]
  preparedChunks?: { title?: string; text: string }[]
}

export type FeedbackNote = {
  question: string
  answer: string
  before: string
  note: string
  at?: string
}

const ALWAYS = new Set<BrainSection>([
  "Identity & Personality",
  "What I Know",
  "How I Answer",
  "Role Lenses",
])

const HOUSTON_TOOLS = [
  "FortiGate-VM",
  "FortiGate",
  "FortiManager",
  "FortiAnalyzer",
  "AWS Gateway Load Balancer",
  "Transit Gateway",
  "Cisco FTD",
  "NERC CIP",
  "AWS",
]

const HOW_I_ANSWER = `Every resume claim is true. Build an illustrative, realistic story inside a real Houston role and employer. Do not borrow another profile.

Use structure, psychology, narrative, emotion, and maturity. Treat every question as a chance to pitch, define, compare, and go comprehensive.

A design question, or a "tell me about a time you set up X from scratch" question, is a human walkthrough. First assess the existing setup, the integrations, the databases, and the user base. Meet the stakeholders and scope the change. Then the design, a phased build, verification, and the results. It should be detailed enough to talk through in a loop interview, with a verbal system-design illustration. If the named tool is not on the Houston resume, walk the same stages through the closest real Houston system and do not claim the missing tool.

Draft the answer, check it against what was already said in this session and against this brain, then revise once. The listener hears only the revision. No quick bullet-list answer. Do not add coaching, tips, or a follow-up after the answer.`

export function forbiddenProfile(text: string): boolean {
  return /jayeshwar44/i.test(String(text || ""))
}

export function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.round(Math.min(5, Math.max(0.25, value)) * 100) / 100
}

function wordsOf(text: string): string[] {
  return String(text || "").trim().split(/\s+/).filter(Boolean)
}

function chunkId(section: string, body: string): string {
  let h = 0x811c9dc5
  const s = `${section}\n${body.slice(0, 180)}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `c${h.toString(36)}`
}

function chunk(section: BrainSection, body: string, tags: string[], source: string, weight = 1): BrainChunk | null {
  const clean = String(body || "").replace(/\s+\n/g, "\n").trim()
  if (!clean || forbiddenProfile(clean)) return null
  return {
    id: chunkId(section, clean),
    section,
    tags: [...new Set(tags.map((tag) => tag.toLowerCase()).filter(Boolean))].slice(0, 12),
    weight: clampWeight(weight),
    enabled: true,
    source,
    body: clean.slice(0, 4000),
  }
}

function push(out: BrainChunk[], item: BrainChunk | null) {
  if (item && !out.some((had) => had.id === item.id)) out.push(item)
}

export function houstonRole(text: string): string {
  const line = String(text || "").split(/\n+/).map((row) => row.trim()).find((row) => /engineer|architect|analyst|developer|administrator/i.test(row))
  if (!line) return "Houston role"
  const named = line.match(/([A-Z][A-Za-z0-9/+-][A-Za-z0-9/+\- ]{8,80}(?:Engineer|Architect|Analyst|Developer|Administrator))/)
  return (named ? named[1] : line).replace(/\s+/g, " ").trim().slice(0, 80)
}

export function houstonTools(text: string): string[] {
  const hay = String(text || "")
  return HOUSTON_TOOLS.filter((tool) => hay.toLowerCase().includes(tool.toLowerCase()))
}

export function projectBrain(sources: BrainSources, now = new Date().toISOString()): BrainDocument {
  const houston = forbiddenProfile(sources.houston) ? "" : String(sources.houston || "").trim()
  const role = houstonRole(houston)
  const tools = houstonTools(houston)
  const out: BrainChunk[] = []
  push(out, chunk("Identity & Personality", [
    "Houston profile. The canonical email is eshwarjay05. Speak in the first person, direct and mature.",
    houston.split(/\n+/).map((row) => row.trim()).filter(Boolean).slice(0, 2).join(" "),
    safeExcerpt(sources.persona, 900) ? `Persona notes already on this account: ${safeExcerpt(sources.persona, 900)}` : "",
  ].filter(Boolean).join("\n\n"), ["identity", "houston", "persona"], "projection"))
  push(out, chunk("What I Know", tools.length
    ? `Role: ${role}\nTools and technologies: ${tools.join(", ")}.`
    : `Role: ${role}\nTools and technologies come from the Houston resume only.`, ["tools", role.toLowerCase(), "houston"], "houston-resume", 1.4))
  const stories = houston.split(/\n+/).map((row) => row.trim()).filter((row) => /migrat|cluster|cutover|deploy/i.test(row)).slice(0, 4)
  push(out, chunk("Talents & Signature Stories", stories.length
    ? stories.join("\n")
    : "Signature work stays inside the Houston resume: the deployments and migrations that resume names.", ["stories", "houston"], "houston-resume"))
  push(out, chunk("How I Answer", HOW_I_ANSWER, ["answer", "walkthrough", "story"], "owner-2026-11-27", 1.6))
  for (const prepared of (sources.preparedChunks || []).slice(0, 6)) {
    const text = safeExcerpt(prepared.text, 500)
    if (!text) continue
    push(out, chunk("Category Knowledge", `${prepared.title || "Prepared note"}\n${text}`, ["prepared", "category"], "prepared-manuscript"))
  }
  if (!(sources.preparedChunks || []).length) {
    push(out, chunk("Category Knowledge", "No category notes have been projected yet.", ["category"], "projection", 0.5))
  }
  push(out, chunk("Role Lenses", `When the session is for ${role}, answer from that role's tools and the employers on the Houston resume. Do not switch profiles mid-answer.`, ["role", role.toLowerCase()], "houston-resume"))
  for (const book of sources.books || []) push(out, learningChunk(book.q, book.a, "session-book"))
  for (const session of sources.dossierSessions || []) {
    for (const row of session.qa || []) push(out, learningChunk(row.q, row.a, "dossier-bible"))
  }
  for (const row of sources.masterChunks || []) {
    const text = safeExcerpt(row.text, 500)
    if (!text) continue
    push(out, chunk("Learned From Sessions", `${row.title || "Earlier session"}\n${text}`, ["rehearsal", "master-bible"], "master-bible"))
  }
  push(out, chunk("Feedback Log", "No feedback notes yet.", ["feedback"], "projection", 0.5))
  push(out, chunk("What I'm Working On", "Nothing noted yet.", ["working"], "projection", 0.5))
  return { revision: 1, updatedAt: now, chunks: out }
}

function safeExcerpt(text: string | undefined, max: number): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim()
  if (!clean || forbiddenProfile(clean)) return ""
  return clean.slice(0, max)
}

export function questionAskTag(channel: string): "mic" | "captions" | "computer-audio" | "typed" | "" {
  const raw = String(channel || "").trim().toLowerCase().replace(/[_\s]+/g, "-")
  if (raw === "typed" || raw === "you-(typed)" || raw === "type") return "typed"
  if (raw === "captions" || raw === "caption" || raw === "caption-window") return "captions"
  if (raw === "mic" || raw === "microphone" || raw === "you") return "mic"
  if (raw === "computer-audio" || raw === "computer" || raw === "system" || raw === "them" || raw === "loopback") return "computer-audio"
  return ""
}

function learningChunk(question: string, answer: string, source: string, askSource = ""): BrainChunk | null {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  const a = String(answer || "").replace(/\s+/g, " ").trim()
  const tag = questionAskTag(askSource)
  if (wordsOf(q).length < 3 || wordsOf(a).length < 8) return null
  if (forbiddenProfile(`${q}\n${a}`)) return null
  const label = tag ? `Q [${tag}]: ` : "Q: "
  return chunk("Learned From Sessions", `${label}${q.slice(0, 400)}\nA: ${a.slice(0, 900)}`, ["rehearsal", "session", tag].filter(Boolean), source)
}

export function renderBrain(doc: BrainDocument): string {
  const parts = ["# Kompas brain", ""]
  for (const section of BRAIN_SECTIONS) {
    parts.push(`## ${section}`, "")
    for (const item of doc.chunks.filter((row) => row.section === section)) {
      const tags = item.tags.join(",")
      parts.push(`<!-- chunk id=${item.id} tags="${tags}" weight=${item.weight} enabled=${item.enabled ? "yes" : "no"} source=${item.source} -->`)
      parts.push(item.body)
      parts.push("<!-- /chunk -->", "")
    }
  }
  return parts.join("\n").trim() + "\n"
}

export function parseBrain(markdown: string): BrainDocument {
  const chunks: BrainChunk[] = []
  const re = /<!-- chunk ([^>]+) -->\n([\s\S]*?)\n<!-- \/chunk -->/g
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown))) {
    const attrs = parseAttrs(match[1])
    const named = sectionFor(markdown, match.index)
    const body = match[2].trim()
    if (!body || forbiddenProfile(body)) continue
    chunks.push({
      id: attrs.id || chunkId(named, body),
      section: named,
      tags: (attrs.tags || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      weight: clampWeight(Number(attrs.weight || 1)),
      enabled: attrs.enabled !== "no",
      source: attrs.source || "document",
      body,
    })
  }
  return { revision: 1, updatedAt: "", chunks }
}

function sectionFor(markdown: string, index: number): BrainSection {
  const before = markdown.slice(0, index)
  let found: BrainSection = BRAIN_SECTIONS[0]
  for (const section of BRAIN_SECTIONS) {
    if (before.lastIndexOf(`## ${section}`) >= 0) found = section
  }
  return found
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /(\w+)=(?:"([^"]*)"|(\S+))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) out[match[1]] = match[2] ?? match[3] ?? ""
  return out
}

function tokens(text: string): string[] {
  return String(text || "").toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []
}

export function selectChunks(doc: BrainDocument, question: string, budget = 6500): BrainChunk[] {
  const ask = new Set(tokens(question))
  const ranked = doc.chunks.filter((item) => item.enabled).map((item) => {
    const overlap = tokens(`${item.tags.join(" ")} ${item.body}`).filter((word) => ask.has(word)).length
    const always = ALWAYS.has(item.section)
    const score = always ? 100 + item.weight : overlap * item.weight
    return { item, score, always, overlap }
  }).filter((row) => row.always || row.overlap > 0)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
  const picked: BrainChunk[] = []
  let used = 0
  for (const row of ranked) {
    if (picked.length >= 16) break
    if (used >= budget && !row.always) break
    if (used + row.item.body.length > budget && picked.length && !row.always) continue
    picked.push(row.item)
    used += row.item.body.length
  }
  return picked
}

export function traceChunks(doc: BrainDocument, question: string): BrainTrace[] {
  const ask = new Set(tokens(question))
  return selectChunks(doc, question).map((item) => {
    const hit = tokens(`${item.tags.join(" ")} ${item.body}`).find((word) => ask.has(word))
    const why = ALWAYS.has(item.section)
      ? `always loaded: ${item.section}`
      : hit
        ? `tag overlap with the question (${hit}), weight ${item.weight}`
        : `weight ${item.weight}`
    return { id: item.id, section: item.section, why }
  })
}

export function brainPrompt(doc: BrainDocument, question: string): string {
  const picked = selectChunks(doc, question)
  if (!picked.length) return ""
  const body = picked.map((item) => `## ${item.section}\n${item.body}`).join("\n\n")
  return `KOMPAS BRAIN\nFollow this on every answer. Hear only the revised answer. Do not add a coaching tail.\n\n${body}`
}

export function wordsBefore(transcript: string, max = 40): string {
  const words = wordsOf(transcript)
  if (!words.length) return ""
  return words.slice(-Math.min(max, words.length)).join(" ")
}

export function editChunk(doc: BrainDocument, id: string, patch: { body?: string; enabled?: boolean; weight?: number }, now = new Date().toISOString()): { doc: BrainDocument; log: string } {
  const next = doc.chunks.map((item) => ({ ...item, tags: item.tags.slice() }))
  const item = next.find((row) => row.id === id)
  if (!item) throw new Error("Unknown brain chunk")
  const notes: string[] = []
  if (typeof patch.body === "string") {
    const body = patch.body.replace(/\u0000/g, "").trim().slice(0, 4000)
    if (forbiddenProfile(body)) throw new Error("That profile is not the Houston brain")
    item.body = body
    notes.push("edited the text")
  }
  if (typeof patch.enabled === "boolean" && patch.enabled !== item.enabled) {
    item.enabled = patch.enabled
    notes.push(patch.enabled ? "switched on" : "switched off")
  }
  if (typeof patch.weight === "number" && clampWeight(patch.weight) !== item.weight) {
    item.weight = clampWeight(patch.weight)
    notes.push(`weight ${item.weight}`)
  }
  if (!notes.length) return { doc, log: "" }
  return {
    doc: { revision: doc.revision + 1, updatedAt: now, chunks: next },
    log: `${now} ${item.section} (${item.id}): ${notes.join(", ")}.`,
  }
}

export function appendSession(doc: BrainDocument, input: { qa?: { q: string; a: string; source?: string }[]; transcript?: string; notes?: FeedbackNote[] }, now = new Date().toISOString()): { doc: BrainDocument; addedLearnings: number; addedNotes: number; log: string } {
  const chunks = doc.chunks.map((item) => ({ ...item, tags: item.tags.slice() }))
  let addedLearnings = 0
  let addedNotes = 0
  const learned = () => chunks.filter((item) => item.section === "Learned From Sessions").length
  for (const row of input.qa || []) {
    if (learned() >= 60) break
    const item = learningChunk(row.q, row.a, "session-end", row.source || "")
    if (!item || chunks.some((had) => had.id === item.id || sameText(had.body, item.body))) continue
    chunks.push(item)
    addedLearnings += 1
  }
  for (const line of transcriptLearnings(input.transcript || "", input.qa || [])) {
    if (learned() >= 60) break
    const item = chunk("Learned From Sessions", line, ["rehearsal", "transcript"], "session-end")
    if (!item || chunks.some((had) => had.id === item.id)) continue
    chunks.push(item)
    addedLearnings += 1
  }
  for (const note of input.notes || []) {
    const item = feedbackChunk(note)
    if (!item || chunks.some((had) => had.section === "Feedback Log" && sameText(had.body, item.body))) continue
    chunks.push(item)
    addedNotes += 1
  }
  if (!addedLearnings && !addedNotes) return { doc, addedLearnings, addedNotes, log: "" }
  const log = `${now} session end: ${addedLearnings} learning${addedLearnings === 1 ? "" : "s"}, ${addedNotes} feedback note${addedNotes === 1 ? "" : "s"}.`
  return { doc: { revision: doc.revision + 1, updatedAt: now, chunks }, addedLearnings, addedNotes, log }
}

function sameText(a: string, b: string): boolean {
  const left = a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 160)
  const right = b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 160)
  return !!left && left === right
}

function transcriptLearnings(transcript: string, qa: { q: string; a: string }[]): string[] {
  const seen = qa.map((row) => row.a.toLowerCase())
  const out: string[] = []
  for (const line of transcript.split(/\n+/)) {
    const text = line.replace(/^(?:You|Candidate)\s*:\s*/i, "").replace(/\s+/g, " ").trim()
    if (!/^You\b|^Candidate\b|\bI\b/i.test(line) && !/^I\b/.test(text)) continue
    if (wordsOf(text).length < 12 || wordsOf(text).length > 40) continue
    if (forbiddenProfile(text) || seen.some((answer) => answer.includes(text.toLowerCase().slice(0, 40)))) continue
    out.push(text)
    if (out.length >= 3) break
  }
  return out
}

function feedbackChunk(note: FeedbackNote): BrainChunk | null {
  const question = String(note.question || "").replace(/\s+/g, " ").trim().slice(0, 400)
  const answer = String(note.answer || "").replace(/\s+/g, " ").trim().slice(0, 700)
  const before = wordsBefore(note.before || "", 40)
  const said = String(note.note || "").replace(/\s+/g, " ").trim().slice(0, 600)
  if (!said || forbiddenProfile(`${question}\n${answer}\n${before}\n${said}`)) return null
  const body = `Question: ${question}\nAnswer: ${answer}\nBefore: ${before}\nNote: ${said}`
  const built = chunk("Feedback Log", body, ["feedback"], "feedback", 1.3)
  if (!built) return null
  return { ...built, id: chunkId("Feedback Log", body) }
}

export function mergeProjection(doc: BrainDocument, incoming: BrainDocument): BrainDocument {
  const chunks = doc.chunks.map((item) => ({ ...item, tags: item.tags.slice() }))
  for (const item of incoming.chunks) {
    if (item.source === "projection" && item.body.startsWith("No ")) continue
    if (!chunks.some((had) => had.id === item.id)) chunks.push({ ...item, tags: item.tags.slice() })
  }
  return { ...doc, chunks }
}

export function isDesignWalkthrough(question: string): boolean {
  return /\b(?:from (?:the )?scratch|from the ground up|set up|setup|stand up|design|architect|walk me through)\b/i.test(String(question || ""))
}

function hasWalkthrough(text: string): boolean {
  return /assess/i.test(text) && /stakeholder/i.test(text) && /verif/i.test(text)
}

function toolInBrain(question: string, brain: string): string {
  const asked = String(question || "").match(/\b([A-Z][A-Za-z0-9+][A-Za-z0-9+.-]{2,})\b/g) || []
  return asked.find((tool) => tool.length > 2 && brain.toLowerCase().includes(tool.toLowerCase()) && !/^(Tell|How|What|When|Where|Would|Could|Walk|Design|From|The|And)$/.test(tool)) || ""
}

/** One revision of a draft. No second model call. */
export function reviseLivingAnswer(question: string, draft: string, ctx: { earlier?: string; brain?: string } = {}): { text: string; revised: boolean; notes: string[] } {
  const notes: string[] = []
  let raw = String(draft || "").replace(/\r/g, "")
  const keptLines = raw.split("\n").filter((line) => !forbiddenProfile(line))
  if (keptLines.length !== raw.split("\n").length) notes.push("dropped the other profile")
  raw = keptLines.join("\n").trim()
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean)
  const bullets = lines.filter((line) => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
  if (bullets.length >= 2 && bullets.length >= lines.length - 1) {
    raw = bullets.map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "")).map((line) => /[.!?]$/.test(line) ? line : `${line}.`).join(" ")
    notes.push("rewrote the bullet list as prose")
  }
  const bag = `${ctx.earlier || ""}\n${ctx.brain || ""}`
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean)
  const checked = sentences.filter((sentence) => {
    const deny = sentence.match(/\b(?:have not|haven't|never)\s+(?:used|worked with|set up|built)\s+([A-Za-z][\w.+-]{2,})/i)
    if (!deny) return true
    const tool = deny[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(tool, "i").test(bag)) {
      notes.push("dropped a denial that contradicts the brain")
      return false
    }
    return true
  })
  raw = checked.join(" ").trim()
  if (isDesignWalkthrough(question) && !hasWalkthrough(raw)) {
    const subject = toolInBrain(question, ctx.brain || "") || houstonRole(ctx.brain || "") || "the Houston role"
    const walk = `I start by assessing the existing setup, the integrations, the databases, and the user base. I meet the stakeholders and scope the change. Then the design, a phased build, verification, and the results. The story stays inside ${subject} on the Houston resume.`
    const parts = raw.split(/(?<=[.!?])\s+/).filter(Boolean)
    raw = [parts[0], walk, parts.slice(1).join(" ")].filter(Boolean).join(" ")
    notes.push("added the design walkthrough")
  }
  if (!notes.length) return { text: String(draft || "").trim(), revised: false, notes }
  return { text: raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), revised: true, notes }
}

export type BrainBackend = {
  getText(key: string): Promise<string | null>
  putText(key: string, text: string, contentType: string): Promise<void>
}

const cache = new Map<string, BrainDocument>()
let testBackend: BrainBackend | null = null
let clock: () => string = () => new Date().toISOString()

export function setBrainBackendForTests(backend: BrainBackend | null): void {
  testBackend = backend
  cache.clear()
}

export function setBrainClockForTests(next: (() => string) | null): void {
  clock = next || (() => new Date().toISOString())
}

export function clearBrainCacheForTests(): void {
  cache.clear()
}

export function rememberBrainForTests(owner: string, doc: BrainDocument): void {
  cache.set(owner, doc)
}

function ownerKey(owner: string): string {
  if (!/^[a-f0-9]{16,64}$/.test(owner)) throw new Error("Invalid owner")
  return owner
}

function documentKey(owner: string): string {
  return `kompas/brain/${owner}/document.md`
}

function versionsKey(owner: string): string {
  return `kompas/brain/${owner}/versions.md`
}

async function backend(): Promise<BrainBackend> {
  if (testBackend) return testBackend
  const env = process.env
  if (String(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID || env.KOMPAS_BLOB_STORE_ID || "").trim()) {
    return {
      async getText(key) {
        const { get } = await import("@vercel/blob")
        const result = await get(key, { access: "private", useCache: false })
        if (!result || result.statusCode !== 200 || !result.stream) return null
        return await new Response(result.stream).text()
      },
      async putText(key, text, contentType) {
        const { put } = await import("@vercel/blob")
        await put(key, text, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType,
          cacheControlMaxAge: 0,
        })
      },
    }
  }
  const { blob } = await import("./storage.ts")
  return {
    getText: (key) => blob.getText(key),
    putText: (key, text) => blob.put(key, text),
  }
}

async function readDoc(owner: string): Promise<BrainDocument | null> {
  const store = await backend()
  const raw = await store.getText(documentKey(owner))
  if (!raw) return null
  const parsed = parseBrain(raw)
  if (!parsed.chunks.length) return null
  return parsed
}

async function writeDoc(owner: string, doc: BrainDocument, logLine: string): Promise<void> {
  const store = await backend()
  await store.putText(documentKey(owner), renderBrain(doc), "text/markdown")
  if (!logLine) return
  const prior = (await store.getText(versionsKey(owner))) || "# Version log\n"
  await store.putText(versionsKey(owner), `${prior.trim()}\n\n${logLine}\n`, "text/markdown")
}

export async function readBrain(owner: string): Promise<{ doc: BrainDocument; markdown: string; versions: string }> {
  const key = ownerKey(owner)
  const cached = cache.get(key)
  const doc = cached || await readDoc(key) || projectBrain({ houston: HOUSTON_RESUME }, clock())
  if (!cached) cache.set(key, doc)
  const store = await backend()
  const versions = (await store.getText(versionsKey(key)).catch(() => "")) || ""
  return { doc, markdown: renderBrain(doc), versions }
}

/** Load the brain for an answer. Memory after the first read. No timeout race. */
export async function ensureAnswerBrain(owner: string, opts: { question?: string; earlier?: string } = {}): Promise<{ prompt: string; text: string; trace: BrainTrace[]; doc: BrainDocument }> {
  const key = ownerKey(owner)
  let doc = cache.get(key)
  if (!doc) {
    try { doc = await readDoc(key) || undefined } catch { doc = undefined }
    if (!doc) {
      doc = projectBrain({ houston: HOUSTON_RESUME }, clock())
      try { await writeDoc(key, doc, `${clock()} seeded the Houston brain. The older stores were left in place.`) } catch { /* the in-memory brain still answers */ }
    }
    cache.set(key, doc)
  }
  const question = opts.question || ""
  const picked = selectChunks(doc, question)
  return {
    prompt: brainPrompt(doc, question),
    text: picked.map((item) => item.body).join("\n\n"),
    trace: traceChunks(doc, question),
    doc,
  }
}

export async function seedBrain(owner: string, sources: BrainSources): Promise<BrainDocument> {
  const key = ownerKey(owner)
  const current = cache.get(key) || await readDoc(key)
  const projected = projectBrain({ ...sources, houston: forbiddenProfile(sources.houston) ? HOUSTON_RESUME : (sources.houston || HOUSTON_RESUME) }, clock())
  const doc = current ? mergeProjection(current, projected) : projected
  cache.set(key, doc)
  await writeDoc(key, doc, current ? "" : `${clock()} seeded the Houston brain from the existing stores. Nothing was deleted.`)
  return doc
}

export async function saveChunkEdit(owner: string, id: string, patch: { body?: string; enabled?: boolean; weight?: number }): Promise<BrainDocument> {
  const key = ownerKey(owner)
  const { doc } = await readBrain(key)
  const edited = editChunk(doc, id, patch, clock())
  if (!edited.log) return doc
  cache.set(key, edited.doc)
  await writeDoc(key, edited.doc, edited.log)
  return edited.doc
}

export async function writeSessionBack(owner: string, input: { qa?: { q: string; a: string; source?: string }[]; transcript?: string; notes?: FeedbackNote[] }): Promise<{ addedLearnings: number; addedNotes: number }> {
  const key = ownerKey(owner)
  const { doc } = await readBrain(key)
  const appended = appendSession(doc, input, clock())
  if (!appended.log) return { addedLearnings: 0, addedNotes: 0 }
  cache.set(key, appended.doc)
  await writeDoc(key, appended.doc, appended.log)
  return { addedLearnings: appended.addedLearnings, addedNotes: appended.addedNotes }
}
