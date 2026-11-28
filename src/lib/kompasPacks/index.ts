import { CATEGORY_PACKS } from "./categories.ts"
import { OWNER_RESUME } from "./owner.ts"
import { ROLE_PACKS } from "./roles.ts"
import type { KompasPack, PackKind, PackNote } from "./types.ts"

export type { KompasPack, PackCheck, PackKind, PackNote, PackProbe } from "./types.ts"
export { OWNER_EMAIL, OWNER_RESUME } from "./owner.ts"

const PACKS: KompasPack[] = [...ROLE_PACKS, ...CATEGORY_PACKS]

export function listPacks(kind?: PackKind): KompasPack[] {
  return PACKS.filter((pack) => !kind || pack.kind === kind)
}

export function getPack(id: string): KompasPack | undefined {
  const key = String(id || "").trim()
  return PACKS.find((pack) => pack.id === key)
}

function words(item: string): string[] {
  return item.toLowerCase().split(/[^a-z0-9+]+/).filter((word) => word.length > 3)
}

export function missedMustMention(must: string[] | undefined, answer: string): string[] {
  const hay = String(answer || "").toLowerCase()
  return (must || []).filter((item) => {
    const parts = words(item)
    if (!parts.length) return false
    const hit = parts.filter((word) => hay.includes(word)).length
    return hit * 2 < parts.length
  }).slice(0, 6)
}

function keptLine(answer: string): string {
  const text = String(answer || "").replace(/\s+/g, " ").trim()
  const match = text.match(/^.{20,220}?[.!](?:\s|$)/)
  return (match ? match[0] : text.slice(0, 220)).trim()
}

/** Latest telling of the same question replaces the older note. Cap 12. */
export function learnFromAnswer(notes: PackNote[], input: { question?: string; answer?: string; level?: string; at?: number; must?: string[] }): PackNote[] {
  const list = Array.isArray(notes) ? notes.slice() : []
  const question = String(input?.question || "").replace(/\s+/g, " ").trim().slice(0, 400)
  const answer = String(input?.answer || "").trim()
  if (!question || answer.length < 40) return list
  const note: PackNote = {
    at: Number(input.at) || Date.now(),
    question,
    level: String(input.level || "engineer").slice(0, 40),
    kept: keptLine(answer),
    missed: missedMustMention(input.must, answer),
  }
  const key = question.toLowerCase()
  const next = list.filter((row) => String(row?.question || "").toLowerCase() !== key)
  next.push(note)
  return next.slice(-12)
}

export function sanitizePackNotes(raw: unknown): PackNote[] {
  if (!Array.isArray(raw)) return []
  const notes: PackNote[] = []
  for (const row of raw.slice(-12)) {
    if (!row || typeof row !== "object") continue
    const item = row as Record<string, unknown>
    const question = typeof item.question === "string" ? item.question.replace(/\s+/g, " ").trim().slice(0, 400) : ""
    const kept = typeof item.kept === "string" ? item.kept.replace(/\s+/g, " ").trim().slice(0, 280) : ""
    if (!question || !kept) continue
    const missed = Array.isArray(item.missed)
      ? item.missed.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.slice(0, 180)).slice(0, 6)
      : []
    notes.push({
      at: Number(item.at) || 0,
      question,
      level: typeof item.level === "string" ? item.level.slice(0, 40) : "engineer",
      kept,
      missed,
    })
  }
  return notes
}

export function packGrounding(pack: KompasPack, notes: PackNote[], audioUrl = ""): string {
  const audio = /^https?:\/\/\S+$/i.test(audioUrl) ? audioUrl : ""
  const probes = pack.probes.map((probe, index) => `Probe ${index + 1}: ${probe.question}\nSample answer: ${probe.answer}`).join("\n\n")
  const checks = pack.checklist.map((item) => `- ${item.item}: ${item.brief}`).join("\n")
  const learned = notes.slice(-8).map((note) => {
    const gap = note.missed.length ? `Still bring in: ${note.missed.join("; ")}.` : "The last telling covered the must-mention list."
    return `Q: ${note.question}\nKept: ${note.kept}\n${gap}`
  }).join("\n")
  return [
    `Subject: ${pack.title} (${pack.kind}).`,
    pack.dossier,
    `Must mention: ${pack.mustMention.join("; ")}.`,
    `Avoid: ${pack.avoid.join("; ")}.`,
    probes,
    `Checklist:\n${checks}`,
    `NotebookLM audio slot: ${audio || "empty"}. Do not pretend the audio was played.`,
    learned ? `Learned from earlier drills on this subject:\n${learned}` : "Learned from earlier drills on this subject: none yet.",
    "Speak in the first person. Be fully confident. Do not hedge. Do not add a canned closer. Use only the employers and tools in the resume.",
  ].filter(Boolean).join("\n\n").slice(0, 14000)
}

export function ownerResumeForPack(resume: string, packId: string): string {
  if (!getPack(packId)) return resume
  const text = String(resume || "")
  if (!text.trim() || /fortinet|fortigate|jayeshwar44/i.test(text)) return OWNER_RESUME
  return text
}
