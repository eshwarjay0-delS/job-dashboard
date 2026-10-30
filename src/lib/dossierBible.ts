// Master dossier ("Bible") per user + a mini dossier per session, same sections, machine-readable items.
// Rules in plain English: /workspace/dossier-bot/merge-rules.md. Pure and offline: no model, no storage.
// A merge never writes new text: it only keeps, folds, ranks or rejects items that already carry a source.
import { createHash } from "node:crypto"
import { allowedNumbers, needsGuard } from "./kompasGuards.ts"

export const SECTION_IDS = [
  "evidence", "oneminute", "signals", "fixfirst", "positioning", "architecture",
  "stories", "qbank", "ladder", "failure", "jargon", "close",
] as const
export type SectionId = (typeof SECTION_IDS)[number]
export type ItemKind = "metric" | "story" | "answer" | "term"
export type SourceDoc = "resume" | "document" | "transcript" | "session" | "jd" | "legacy-dossier"
export type ItemSource = { doc: SourceDoc | string; session: string | null; span: string | null }

export type BibleItem = {
  id: string
  section: SectionId
  text: string
  kind: ItemKind
  source: ItemSource
  status: "sourced" | "hole"
  updatedAt: number
  /** every session this item was seen in (source.session first) */
  seenIn: string[]
  /** losing versions of a conflicting metric, kept, never deleted */
  alternates: BibleItem[]
  /** one speakable first-person sentence Kompas can say while the body is prepared (answer items) */
  opener?: Opener
  /** sha256 of the item's canonical JSON without updatedAt/hash (set by sealBible) */
  hash?: string
}
export type Opener = { text: string; source: ItemSource | null; status: "sourced" | "hole" }
export const OPENER_HOLE = "[ ___ confirm before the call: a one-sentence opener for this question ]"

export type Bible = { version: 1; session: string | null; updatedAt: number; sections: Record<SectionId, BibleItem[]>; contentHash?: string }
export type MergeLog = { rule: "added" | "duplicate" | "conflict" | "hole-kept-sourced" | "hole-filled" | "hole-duplicate"; id: string; session: string | null; detail?: string }

const HOLE_RE = /\[ ___ [^\]]*\]/g
const FIG_RE = /\b\d[\d,.]*\+?%?/g
const RANK: Record<string, number> = { resume: 5, document: 4, transcript: 3, session: 2, jd: 1, "legacy-dossier": 0 }

const plain = (t: string) => String(t || "").toLowerCase().replace(HOLE_RE, " ").replace(FIG_RE, " ").replace(/[^a-z]+/g, " ").trim()
const figures = (t: string) => (String(t || "").replace(HOLE_RE, " ").match(FIG_RE) || []).map((f) => f.replace(/[.,]+$/, "")).sort().join("|")
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}
const keyOf = (it: Pick<BibleItem, "section" | "kind" | "text">) => `${it.section}|${it.kind}|${plain(it.text)}`

export function emptyBible(session: string | null = null): Bible {
  const sections = {} as Record<SectionId, BibleItem[]>
  for (const id of SECTION_IDS) sections[id] = []
  return { version: 1, session, updatedAt: 0, sections }
}

export function makeItem(o: { section: SectionId; kind: ItemKind; text: string; source: ItemSource | null; status?: "sourced" | "hole"; updatedAt?: number }): BibleItem {
  const text = String(o.text || "").replace(/\s+/g, " ").trim()
  const status = o.status || (HOLE_RE.test(text) ? "hole" : "sourced")
  HOLE_RE.lastIndex = 0
  return {
    id: hash(`${o.section}|${o.kind}|${plain(text)}`), section: o.section, text, kind: o.kind,
    source: o.source as ItemSource, status, updatedAt: o.updatedAt ?? Date.now(),
    seenIn: o.source?.session ? [o.source.session] : [], alternates: [],
  }
}

/** Why an item may not enter the master, or "" when it may. */
export function rejectReason(it: BibleItem): string {
  if (!it || !SECTION_IDS.includes(it.section)) return "unknown section"
  if (!it.text) return "empty"
  if (!it.source || !it.source.doc) return "no source"
  if (it.status === "sourced" && it.kind === "metric") {
    if (!it.source.span) return "metric without a source span"
    const allowed = allowedNumbers(it.source.span)
    if (needsGuard(it.text, allowed)) return "metric figure not in its source span"
  }
  return ""
}

const better = (a: BibleItem, b: BibleItem) => {
  const ra = RANK[a.source.doc] ?? 0, rb = RANK[b.source.doc] ?? 0
  if (ra !== rb) return ra > rb
  if (!!a.source.span !== !!b.source.span) return !!a.source.span
  return a.updatedAt >= b.updatedAt
}
const union = (a: string[], b: string[]) => Array.from(new Set([...a, ...b]))

/** Fold a completed session's mini dossier into the master. Returns a new master; the input is not mutated. */
export function mergeMini(master: Bible, mini: Bible): { bible: Bible; log: MergeLog[]; rejected: Array<{ item: BibleItem; reason: string }> } {
  const bible: Bible = JSON.parse(JSON.stringify(master))
  for (const id of SECTION_IDS) bible.sections[id] ||= []
  const log: MergeLog[] = []
  const rejected: Array<{ item: BibleItem; reason: string }> = []
  for (const id of SECTION_IDS) {
    for (const raw of mini.sections[id] || []) {
      const it: BibleItem = { ...raw, section: id, seenIn: union(raw.seenIn || [], raw.source?.session ? [raw.source.session] : mini.session ? [mini.session] : []), alternates: raw.alternates || [] }
      const why = rejectReason(it)
      if (why) { rejected.push({ item: it, reason: why }); continue }
      const list = bible.sections[id]
      const at = list.findIndex((x) => keyOf(x) === keyOf(it))
      if (at < 0) { list.push(it); log.push({ rule: "added", id: it.id, session: it.source.session }); continue }
      const cur = list[at]
      const seenIn = union(cur.seenIn, it.seenIn)
      if (it.opener?.status === "sourced" && cur.opener?.status !== "sourced") cur.opener = it.opener
      if (cur.status === "sourced" && it.status === "hole") { cur.seenIn = seenIn; log.push({ rule: "hole-kept-sourced", id: cur.id, session: it.source.session }); continue }
      if (cur.status === "hole" && it.status === "sourced") { list[at] = { ...it, id: cur.id, seenIn, alternates: cur.alternates }; log.push({ rule: "hole-filled", id: cur.id, session: it.source.session }); continue }
      if (cur.status === "hole") { cur.seenIn = seenIn; log.push({ rule: "hole-duplicate", id: cur.id, session: it.source.session }); continue }
      if (figures(cur.text) === figures(it.text)) {
        const keep = better(it, cur) ? it : cur
        list[at] = { ...keep, id: cur.id, seenIn, alternates: union(cur.alternates.map((a) => JSON.stringify(a)), it.alternates.map((a) => JSON.stringify(a))).map((a) => JSON.parse(a)) }
        log.push({ rule: "duplicate", id: cur.id, session: it.source.session })
        continue
      }
      const [win, lose] = better(it, cur) ? [it, cur] : [cur, it]
      list[at] = { ...win, id: cur.id, seenIn, alternates: [...cur.alternates, ...it.alternates, { ...lose, alternates: [] }] }
      log.push({ rule: "conflict", id: cur.id, session: it.source.session, detail: `kept "${win.text}" (${win.source.doc}); alternate "${lose.text}" (${lose.source.doc})` })
    }
  }
  bible.updatedAt = Math.max(master.updatedAt || 0, mini.updatedAt || 0, Date.now())
  return { bible, log, rejected }
}

/** Load anything a dossier has ever been: a Bible JSON, an old {items:[{q,a}]} bank, or old persona/dossier markdown. */
export function loadBible(raw: unknown): Bible {
  if (raw && typeof raw === "object" && (raw as Bible).version === 1 && (raw as Bible).sections) {
    const b = emptyBible((raw as Bible).session)
    b.updatedAt = (raw as Bible).updatedAt
    for (const id of SECTION_IDS) b.sections[id] = ((raw as Bible).sections[id] || []).map((x) => ({ ...x }))
    return b
  }
  const legacy = { doc: "legacy-dossier", session: null, span: null }
  const b = emptyBible()
  const items: Array<{ q: string; a: string[] }> = []
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)) {
    for (const o of (raw as { items: Array<Record<string, unknown>> }).items) items.push({ q: String(o.q || ""), a: Array.isArray(o.a) ? o.a.map(String) : [String(o.a || "")] })
  } else if (typeof raw === "string") {
    for (const part of raw.split(/^###\s+/m).slice(1)) {
      const nl = part.indexOf("\n")
      const q = (nl < 0 ? part : part.slice(0, nl)).trim()
      const a = (nl < 0 ? "" : part.slice(nl + 1)).replace(/\*\*SAY THIS\*\*/gi, " ").replace(/\s+/g, " ").trim()
      items.push({ q, a: [a] })
    }
  }
  for (const { q, a } of items) {
    const text = `${q} — ${a.join(" ").replace(/\s+/g, " ").trim()}`.trim()
    if (q) b.sections.qbank.push(makeItem({ section: "qbank", kind: "answer", text, source: legacy, updatedAt: 0 }))
  }
  return b
}

/** A mini dossier from one saved session (dossier.ts DossierSession), read only. */
export function miniFromSession(s: { id: string; at: number; qa: Array<{ q: string; a: string }> }): Bible {
  const m = emptyBible(s.id)
  m.updatedAt = s.at
  for (const qa of s.qa || []) {
    if (!qa.q) continue
    m.sections.qbank.push(makeItem({ section: "qbank", kind: "answer", text: `${qa.q} — ${qa.a}`, source: { doc: "session", session: s.id, span: qa.q.slice(0, 200) }, updatedAt: s.at }))
  }
  return m
}

/** Feed for the speed index (/workspace/speed-work Sources): sourced items only; JD stays emphasis. */
export function toSpeedSources(b: Bible): { resume: string; documents: string; qa: string; jd: string } {
  const out = { resume: [] as string[], documents: [] as string[], qa: [] as string[], jd: [] as string[] }
  for (const id of SECTION_IDS) for (const it of b.sections[id]) {
    if (it.status !== "sourced") continue
    const d = it.source.doc
    if (d === "resume") out.resume.push(it.text)
    else if (d === "jd") out.jd.push(it.text)
    else if (d === "session" || d === "transcript" || d === "legacy-dossier") out.qa.push(it.text)
    else out.documents.push(it.text)
  }
  return { resume: out.resume.join("\n"), documents: out.documents.join("\n"), qa: out.qa.join("\n"), jd: out.jd.join("\n") }
}

/** The opener: first sentence only, first person, every figure in its source span; otherwise a marked hole. */
export function withOpener(item: BibleItem, text: string, source: ItemSource | null): BibleItem {
  const first = (String(text || "").replace(/\s+/g, " ").trim().match(/^.*?[.!?](?=\s|$)/) || [String(text || "").trim()])[0]
  const firstPerson = /(^|\s)(I|I'm|I'd|I've|I'll|my|My)\b/.test(first)
  const ok = !!first && !!source && !!source.doc && firstPerson && !(HOLE_RE.test(first)) && !needsGuard(first, allowedNumbers(source.span || ""))
  HOLE_RE.lastIndex = 0
  return { ...item, opener: ok ? { text: first, source, status: "sourced" } : { text: OPENER_HOLE, source: source || null, status: "hole" } }
}

/** Keys sorted at every depth, no whitespace: the same content always gives the same string. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`).join(",")}}`
  return JSON.stringify(v)
}
const sha = (t: string) => createHash("sha256").update(t).digest("hex")
function hashable(it: BibleItem): unknown {
  const { updatedAt: _u, hash: _h, alternates, ...rest } = it
  return { ...rest, alternates: (alternates || []).map(hashable) }
}

/** Stable ids are already on every item; this adds a per-item hash and a top-level contentHash for index caching. */
export function sealBible(b: Bible): Bible {
  const out: Bible = { ...b, sections: {} as Record<SectionId, BibleItem[]> }
  for (const id of SECTION_IDS) out.sections[id] = (b.sections[id] || []).map((it) => ({ ...it, hash: sha(canonicalJson(hashable(it))) }))
  out.contentHash = sha(canonicalJson(SECTION_IDS.map((id) => [id, out.sections[id].map((it) => it.hash)])))
  return out
}
