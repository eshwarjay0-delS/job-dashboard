// Clarify seed. Slots are phrasing, not a biography. A line that states
// someone else's job, city, or years is not offered to the candidate.

import { readFileSync } from "node:fs"
import { join } from "node:path"

export type ClarifySeed = {
  text: string
  kind: string
  question_types?: string[]
}

function bankFile(): string {
  const cwd = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ""
  return cwd ? join(cwd, "scripts/fixtures/kompas-evaluation/clarify-bank.jsonl") : ""
}

const EXPERIENCE = /\b(?:I (?:worked|spent|started my career|was working|lived|was able to move)|years? in|Cincinnati|Seattle|QNXT|DVLA|unloader|packer|back in India)\b/i

export function assertsCandidateExperience(text: string): boolean {
  const bare = String(text || "").replace(/\{[^}]+\}/g, " ")
  return EXPERIENCE.test(bare)
}

export function loadClarifyBank(raw?: string): ClarifySeed[] {
  let text = raw
  if (text == null) {
    const file = bankFile()
    if (!file) return []
    try { text = readFileSync(file, "utf8") } catch { return [] }
  }
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as ClarifySeed)
}

/** Lines the panel may say. Experience claims from other speakers are dropped. */
export function usableClarifyBank(rows: ClarifySeed[] = loadClarifyBank()): ClarifySeed[] {
  return rows.filter((row) => row && row.text && !assertsCandidateExperience(row.text))
}

const SLOT = /\{([a-z0-9_]+)\}/gi

function fillSlots(text: string, topic: string): string | null {
  let blocked = false
  const filled = text.replace(SLOT, (_all, name: string) => {
    const key = name.toLowerCase()
    if (key === "employer" || key === "project" || key === "metric" || key === "client") {
      blocked = true
      return ""
    }
    if (key === "term" || key === "angle_a") return topic || "that"
    if (key === "angle_b" || key === "interpretation") return "the check"
    if (key === "check" || key === "first_check" || key === "action" || key === "failure") return "the first check"
    if (key === "reason" || key === "constraint" || key === "residual" || key === "decision" || key === "review") return "the residual"
    blocked = true
    return ""
  })
  if (blocked || /\{[a-z0-9_]+\}/i.test(filled)) return null
  const line = filled.replace(/\s+/g, " ").trim()
  if (!line || assertsCandidateExperience(line)) return null
  return line
}

export function clarifySeedLine(question: string, kind: ClarifySeed["kind"], rows = usableClarifyBank()): string {
  const topic = String(question || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 5).slice(0, 2).join(" ") || "that"
  for (const row of rows) {
    if (row.kind !== kind) continue
    const line = fillSlots(row.text, topic)
    if (!line) continue
    if (kind === "clarifying_question" && !line.endsWith("?")) continue
    if (line.split(/\s+/).length > 18) continue
    return line
  }
  return ""
}
