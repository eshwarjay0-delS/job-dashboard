// Local replay gate. Scores the stand-in on the 249-question set.
// The historical tag names come from qa.jsonl. This file does not call a model.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { draftSpokenAnswer, wordCount } from "./kompasDissection.ts"

export type ReplayRow = {
  id: string
  question: string
  kind?: string
  expected?: { length_band_words?: [number, number] }
}

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../scripts/fixtures/kompas-evaluation")
const FILLER = /\b(?:and then|from there|after that|great question|in conclusion|basically|delve|leverage|the way i look at it|at the end of the day|i check the evidence before i call it done)\b/i
const CHOPPY = /\b(?:and then|from there|after that)\b/gi
const PROFILE = /\b(?:houston|saint louis|st\. louis|jayeshwar44|eshwarjay05|eshwarjay06)\b/i

export function loadReplaySet(): ReplayRow[] {
  return readFileSync(join(DIR, "replay-set.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as ReplayRow)
}

export function historicalTagCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const line of readFileSync(join(DIR, "qa.jsonl"), "utf8").trim().split("\n")) {
    const row = JSON.parse(line) as { failure_tags?: string[] }
    for (const tag of row.failure_tags || []) counts[tag] = (counts[tag] || 0) + 1
  }
  return counts
}

export function replayTags(question: string, answer: string, band?: [number, number]): string[] {
  const tags: string[] = []
  const words = wordCount(answer)
  if (band && words < band[0]) tags.push("too-short")
  if (band && words > band[1]) tags.push("too-long")
  if (FILLER.test(answer)) tags.push("filler")
  const chops = answer.match(CHOPPY) || []
  if (chops.length >= 2 || /after that, i then/i.test(answer)) tags.push("choppy-flow")
  const distinctive = question.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 6)
  const hit = distinctive.filter((word) => answer.toLowerCase().includes(word)).length
  if (hit < 1 || /\b(?:robust|holistic|comprehensive framework)\b/i.test(answer)) tags.push("generic")
  if (PROFILE.test(answer)) tags.push("profile-mix")
  const first = answer.split(/(?<=[.!?])\s+/)[0] || ""
  if (distinctive.length && !distinctive.some((word) => first.toLowerCase().includes(word))) tags.push("first-sentence-miss")
  return tags
}

export type ReplayReport = {
  n: number
  counts: Record<string, number>
  ms: number
}

export function scoreReplay(resume: string, rows = loadReplaySet()): ReplayReport {
  const started = performance.now()
  const counts: Record<string, number> = { filler: 0, "choppy-flow": 0, generic: 0, "too-short": 0, "too-long": 0, "profile-mix": 0, "first-sentence-miss": 0 }
  for (const row of rows) {
    const answer = draftSpokenAnswer(row.question, "engineer", resume)
    for (const tag of replayTags(row.question, answer, row.expected?.length_band_words)) {
      counts[tag] = (counts[tag] || 0) + 1
    }
  }
  return { n: rows.length, counts, ms: performance.now() - started }
}
