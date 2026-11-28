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

const SOC_PLAYBOOK = [
  "Playbook: I run the SOC queue at Citi Bank and I ran the same queue at CVS Health. I design the detections, I own the notables, and I take the on-call hour.",
  "Tools: Splunk ES with RBA and notables, correlation searches, CIM data models, an ingestion pipeline from the WAF, proxy, identity, and EDR, plus Microsoft Sentinel, CrowdStrike, CyberArk, and Qualys.",
  "Tuning: I cut a noisy notable by naming the entity, the risk score, and the one condition that was paging on a known admin. I keep the search and I drop the duplicate.",
  "Metrics: mean time to detect, mean time to contain, and the share of notables I closed as noise.",
  "Story: At Citi a privileged account opened a remote session outside the change window. The evidence was the CyberArk session, the Entra sign-in, and the CrowdStrike process tree. I decided it was real, I assigned the ServiceNow ticket to the identity owner, and the SOC lead took the host. We contained it and I tuned the notable so it pages once.",
  "Story: At CVS Health a Qualys finding on a public host lined up with a Tanium process. I opened the ticket for the system owner, I confirmed the patch, and I closed it with the evidence attached.",
  "Story: A web alert looked like SQL injection and a second one looked like XSS. I treated both as detection. I searched the WAF, the web logs, and the database audit in Splunk, then I confirmed the host in EDR. I did not describe a pentest. The ticket went to the application owner.",
].join(" ")

const SOC_IDS = new Set(["soc", "soc-analyst", "soc-analyst-l1", "soc-analyst-l3", "soc-manager", "siem-splunk", "sentinel-kql", "detection-engineer", "detection-engineering", "threat-hunter", "threat-hunting", "incident-responder", "incident-response", "security-operations-lead", "endpoint", "defender"])

function playbook(pack: KompasPack): string {
  if (SOC_IDS.has(pack.id)) return SOC_PLAYBOOK
  const tools = pack.mustMention.slice(0, 8).join(", ")
  return [
    `Playbook: I do ${pack.title} at Citi Bank, and I did the same class of work at CVS Health, the City of San Diego, Charter Communications, and Accenture.`,
    `Tools and controls I use: ${tools}.`,
    "Metrics I report: time to detect, time to contain, and how many items I closed as noise versus how many I handed to an owner.",
    "Story: At Citi I opened the case from a real alert, I named the evidence, I decided it was in scope, I assigned the ServiceNow ticket to the owner, and I closed it after the control changed.",
    "Story: At CVS Health I walked the same case with the people who report into the security lead. I kept the business risk in one sentence and I left the technical proof in the ticket.",
    "Probe habit: I answer the question, then I add the detection or the decision, who got the ticket, and the outcome. I never stop at a single product name.",
  ].join(" ")
}

export function packFrame(pack: KompasPack | null | undefined, question: string): string {
  if (!pack) return ""
  const soc = SOC_IDS.has(pack.id) || pack.id === "offensive" || pack.id === "appsec" || pack.id === "appsec-engineer"
  if (soc && /sql injection|\bxss\b|cross-site scripting/i.test(question)) {
    return "FRAME: This is a SOC detection answer, not a pentest. Use the WAF, the web logs, the database audit, a Splunk search, and EDR. Do not describe exploiting the flaw."
  }
  return `FRAME: Answer as ${pack.title}. Use the tools, the playbook, the metrics, and the stories in this pack. Do not drift into a different specialty.`
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
    playbook(pack),
    `Must mention: ${pack.mustMention.join("; ")}.`,
    `Avoid: ${pack.avoid.join("; ")}.`,
    probes,
    `Checklist:\n${checks}`,
    `NotebookLM audio slot: ${audio || "empty"}. Do not pretend the audio was played.`,
    learned ? `Learned from earlier drills on this subject:\n${learned}` : "Learned from earlier drills on this subject: none yet.",
    "Speak in the first person and be fully confident. A realistic story inside Citi Bank or CVS Health is allowed. Never hedge, never refuse, and never append a resume summary.",
  ].filter(Boolean).join("\n\n").slice(0, 14000)
}

export function ownerResumeForPack(resume: string, packId: string): string {
  if (!getPack(packId)) return resume
  const text = String(resume || "")
  if (!text.trim() || /fortinet|fortigate|jayeshwar44/i.test(text)) return OWNER_RESUME
  return text
}
