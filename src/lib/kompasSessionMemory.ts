// Compact session memory for follow-ups. Last six turns plus stated facts.
// Facts may come from the eshwarjay05 resume or from something already said.

export type MemoryTurn = { q: string; a: string }
export type SessionMemory = { id: string; turns: MemoryTurn[]; facts: string[] }
export type MemoryStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

const FOLLOW = /^(?:why did you|what happened next|and the second|how big was|what about (?:that|it)|and then|can you expand)\b|\b(?:that|it|those|the second one)\b/i
const META = /\b(?:that (?:part|detail) is not in the sources|not in the (?:sources|resume))\b/i
const NAME = /\b[A-Z][A-Za-z0-9&]{2,}(?:\s+[A-Z][A-Za-z0-9&]{2,})*\b/g
const SKIP_NAME = new Set("The This That First Then Next Finally What When Where How Why Yes Not And For With From They Them Their Result General Teams".split(" "))

export function readSessionMemory(value: unknown): SessionMemory {
  if (!value || typeof value !== "object") return emptyMemory("")
  const row = value as { id?: string; recent?: MemoryTurn[]; turns?: MemoryTurn[]; facts?: unknown }
  const turns = Array.isArray(row.recent) ? row.recent : Array.isArray(row.turns) ? row.turns : []
  return {
    id: String(row.id || ""),
    turns: turns.slice(-6).map((turn) => ({ q: String(turn?.q || ""), a: String(turn?.a || "") })),
    facts: Array.isArray(row.facts) ? row.facts.map((fact) => String(fact || "")).filter(Boolean).slice(-24) : [],
  }
}

export function emptyMemory(id = ""): SessionMemory {
  return { id, turns: [], facts: [] }
}

export function memoryKey(id: string): string {
  return `kompas-memory:${id || "live"}`
}

export function compactMemory(memory: SessionMemory): { recent: MemoryTurn[]; facts: string[] } {
  const recent = (memory.turns || []).slice(-6).map((turn) => ({
    q: String(turn.q || "").replace(/\s+/g, " ").trim().slice(0, 180),
    a: String(turn.a || "").replace(/\s+/g, " ").trim().slice(0, 280),
  })).filter((turn) => turn.q || turn.a)
  const facts = [...new Set((memory.facts || []).map((fact) => String(fact || "").replace(/\s+/g, " ").trim()).filter(Boolean))].slice(-24)
  return { recent, facts }
}

export function memoryPrompt(memory: SessionMemory): string {
  const packed = compactMemory(memory)
  if (!packed.recent.length && !packed.facts.length) return ""
  const turns = packed.recent.map((turn, i) => `${i + 1}. Q: ${turn.q}\nA: ${turn.a}`).join("\n")
  const facts = packed.facts.length ? `Already stated: ${packed.facts.join("; ")}` : ""
  return ["SESSION MEMORY (use this for that/it/follow-ups; do not contradict it):", facts, turns].filter(Boolean).join("\n")
}

function listedTurn(memory: SessionMemory): MemoryTurn | undefined {
  return [...(memory.turns || [])].reverse().find((turn) => /\b(?:also|second|and)\b/i.test(turn.a) && turn.a.split(/\s+/).length >= 8)
}

/** Bind a short follow-up to the previous turn. A fresh question is unchanged. */
export function expandFollowUp(question: string, memory: SessionMemory): string {
  const q = String(question || "").replace(/\s+/g, " ").trim()
  const prev = memory.turns[memory.turns.length - 1]
  if (!q || !prev) return q
  const short = q.split(/\s+/).length <= 14
  if (!short || !FOLLOW.test(q)) return q
  if (/\bsecond\b/i.test(q)) {
    const listed = listedTurn(memory) || prev
    return `${q}\nThat points at the later item in this answer: ${listed.a.slice(0, 320)}`
  }
  return `${q}\nThe previous question was: ${prev.q.slice(0, 180)}\nThe previous answer was: ${prev.a.slice(0, 320)}`
}

export function remember(memory: SessionMemory, question: string, answer: string, resume = ""): SessionMemory {
  const q = String(question || "").replace(/\s+/g, " ").trim().slice(0, 240)
  const a = String(answer || "").replace(/\s+/g, " ").trim().slice(0, 500)
  if (!q && !a) return memory
  const turns = [...memory.turns, { q, a }].slice(-12)
  const facts = new Set(memory.facts)
  const resumeBag = resume.toLowerCase()
  for (const name of a.match(NAME) || []) {
    if (SKIP_NAME.has(name)) continue
    if (resumeBag.includes(name.toLowerCase())) facts.add(name)
  }
  for (const n of a.match(/\b\d[\d,]*(?:\.\d+)?\b/g) || []) {
    if (resume.includes(n)) facts.add(n)
  }
  const first = a.split(/(?<=[.!?])\s+/)[0]
  if (first && first.split(/\s+/).length >= 6 && !META.test(first)) facts.add(first.slice(0, 180))
  return { id: memory.id, turns, facts: [...facts].slice(-24) }
}

function allowBag(resume: string, memory: SessionMemory, question: string): string {
  return [resume, question, ...memory.facts, ...memory.turns.flatMap((turn) => [turn.q, turn.a])].join("\n").toLowerCase()
}

function unsupported(sentence: string, bag: string): boolean {
  const names = (sentence.match(NAME) || []).filter((name) => !SKIP_NAME.has(name))
  if (names.some((name) => !bag.includes(name.toLowerCase()))) return true
  const numbers = sentence.match(/\b\d[\d,]*(?:\.\d+)?\b/g) || []
  return numbers.some((n) => !bag.includes(n) && !bag.includes(n.replace(/,/g, "")))
}

/** Drop employers, tools, certifications, and numbers that are not on the profile or already said. */
export function groundToProfile(question: string, answer: string, resume: string, memory: SessionMemory = emptyMemory("")): string {
  const bag = allowBag(resume, memory, question)
  const kept = String(answer || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s && !META.test(s) && !unsupported(s, bag))
  if (kept.length) return kept.join(" ")
  return "Not directly, but I can speak to the work on the resume."
}

export function saveMemory(storage: MemoryStorage, memory: SessionMemory): void {
  storage.setItem(memoryKey(memory.id), JSON.stringify({ ...memory, ...compactMemory(memory), turns: memory.turns.slice(-12) }))
}

export function loadMemory(storage: MemoryStorage, id: string): SessionMemory {
  try {
    const raw = storage.getItem(memoryKey(id))
    if (!raw) return emptyMemory(id)
    const parsed = JSON.parse(raw) as SessionMemory
    return {
      id,
      turns: Array.isArray(parsed.turns) ? parsed.turns.slice(-12) : [],
      facts: Array.isArray(parsed.facts) ? parsed.facts.slice(-24) : [],
    }
  } catch {
    return emptyMemory(id)
  }
}

export function clearMemory(storage: MemoryStorage, id: string): void {
  storage.removeItem(memoryKey(id))
}

/** Drop a repeated shouty caption token. Ordinary words stay. */
export function dedupeCaptionTokens(text: string): string {
  const seen: string[] = []
  const out: string[] = []
  for (const part of String(text || "").split(/(\s+)/)) {
    const letters = part.replace(/[^A-Za-z]/g, "")
    const shouty = letters.length >= 4 && letters === letters.toUpperCase()
    const key = letters.toLowerCase()
    if (shouty && seen.includes(key)) continue
    if (shouty) seen.push(key)
    out.push(part)
  }
  return out.join("").replace(/[,\s]{2,}/g, (gap) => gap.includes("\n") ? gap : (gap.trim().startsWith(",") ? ", " : " ")).replace(/,\s*(?=,|$)/g, "").replace(/\s+,/g, ",").replace(/,\s*$/g, "").replace(/\s{2,}/g, " ").trim()
}
