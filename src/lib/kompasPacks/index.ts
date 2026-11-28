import { CATEGORY_PACKS } from "./categories.ts"
import { PACK_DEPTH, SUBJECT_TECH, WEB_ATTACK_DETECTION } from "./depth.ts"
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
  "Story: At Citi a privileged account opened a remote session outside the change window. The evidence was the CyberArk session, the Entra sign-in, and the CrowdStrike process tree. I decided it was real, I assigned the ServiceNow ticket to the identity owner, and the SOC lead took the host. We contained it and I tuned the notable so the same admin no longer woke the queue.",
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
    const both = /sql injection|sqli/i.test(question) && /\bxss\b|cross-site scripting/i.test(question)
    return `FRAME: This is a SOC detection answer, not a pentest. Use the WAF, the web logs, the database audit, a Splunk search, and EDR. Do not describe exploiting the flaw.${both ? " The question names both SQL injection and XSS: give each its own detection signals, searches, and correlation, XSS as fully as SQL injection." : ""}\n${WEB_ATTACK_DETECTION}`
  }
  return `FRAME: Answer as ${pack.title}. Use the tools, the playbook, the metrics, and the stories in this pack. Do not drift into a different specialty.`
}

export function packGrounding(pack: KompasPack, notes: PackNote[], audioUrl = ""): string {
  const audio = /^https?:\/\/\S+$/i.test(audioUrl) ? audioUrl : ""
  // A sample answer is the headline of a story. Copied alone it became a one-line answer to a story question.
  const probes = pack.probes.map((probe, index) => `Probe ${index + 1}: ${probe.question}\nStory headline (expand it into the full story; never answer with this line alone): ${probe.answer}`).join("\n\n")
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
    depthText(pack.id),
    `Checklist:\n${checks}`,
    `NotebookLM audio slot: ${audio || "empty"}. Do not pretend the audio was played.`,
    learned ? `Learned from earlier drills on this subject:\n${learned}` : "Learned from earlier drills on this subject: none yet.",
    "Speak in the first person and be fully confident. A realistic story inside Citi Bank or CVS Health is allowed. Never hedge, never refuse, and never append a resume summary.",
  ].filter(Boolean).join("\n\n").slice(0, 20000)
}

export function ownerResumeForPack(resume: string, packId: string): string {
  if (!getPack(packId)) return resume
  const text = String(resume || "")
  if (!text.trim() || /fortinet|fortigate|jayeshwar44/i.test(text)) return OWNER_RESUME
  return text
}

/** The subject's depth: design, stories, director view, terms, metrics, pitfalls. "" when the pack has none. */
export function depthText(id: string): string {
  const d = PACK_DEPTH[id]
  if (!d) return SUBJECT_TECH[id] || ""
  return [
    SUBJECT_TECH[id] || "",
    `How I designed and run it: ${d.design}`,
    d.stories.length ? `Stories I tell (pick the one that fits, tell it as it happened):\n${d.stories.map((story, i) => `Story ${i + 1}: ${story}`).join("\n")}` : "",
    d.director ? `Director view: ${d.director}` : "",
    d.terms.length ? `Terms I define in plain words:\n${d.terms.map((t) => `- ${t}`).join("\n")}` : "",
    d.metrics.length ? `Metrics I track: ${d.metrics.join("; ")}` : "",
    d.pitfalls.length ? `Mistakes I avoid: ${d.pitfalls.join("; ")}` : "",
  ].filter(Boolean).join("\n\n")
}

const LEVEL_SHAPE: Record<string, string> = {
  architect: "ARCHITECT SHAPE: open with the direct answer in one sentence, then walk the design I built end to end (sources, data flow, the controls, integrations, tuning, on-call, the trade-off I chose and why), then tell two stories from the pack in full (situation, evidence I pulled, decision, who got the ticket, outcome with the number), then the metrics I report. First-person ownership: I designed, I own, I run on-call, I help these teams. Keep adding concrete detail from the pack until the answer passes 1000 words. Never pad with opinions.",
  engineer: "TECHNICAL HR / ENGINEER SHAPE: open with the direct answer, then define every technical term I use in one plain sentence the way I would explain it to a recruiter, then walk one or two stories from the pack step by step (what I saw, what I checked, what I decided, who got the ticket, the outcome with the number). Warm and human, like a good salesperson. 700 to 800 words.",
  director: "DIRECTOR SHAPE: open with the business answer, then why it matters to the business, the risk I accepted versus escalated, who reports to me and which teams I lead, the cadence and metrics I report to leadership, and one story from the pack told as a decision I led. No deep tool walk. 400 to 600 words.",
}

/** Pack drill rules that outrank the generic no-invention and brevity rules for Role and Category sessions. */
export function packDrillRules(pack: KompasPack | null | undefined, level: string): string {
  if (!pack) return ""
  const shape = LEVEL_SHAPE[level] || LEVEL_SHAPE.engineer
  return [
    `PACK DRILL RULES (Role/Category session "${pack.title}"; these override any earlier rule about inventing, brevity, or stopping early):`,
    "- Answer every part of the question, in the order asked. A two-part question gets both parts answered fully.",
    "- Speak as lived experience in the past tense: what I did, at Citi Bank, CVS Health, the City of San Diego, Charter Communications, or Accenture. Realistic stories from the SUBJECT PACK are mine to tell. Never name any other employer.",
    "- Use the pack's own tools, design, stories, metrics, and terms by name. Do not answer with generic security talk.",
    "- Fully confident. Never say I believe, I think, I would, I might, ideally, or typically. Say what I did and what I do.",
    "- No closing summary: never start a sentence with Overall, In conclusion, Ultimately, or In summary, and never talk about staying up to date, being excited, being confident in my ability, or being a valuable asset.",
    "- No certifications, no resume summary, and no tool catalogue unless the question asks for them.",
    "- A story question (tell me about a time, walk me through the last time, describe a situation, give an example) gets ONE story told in full, 8 to 12 sentences: where I was and what I saw first, the evidence I pulled from named systems, what I ruled out, the decision and why, who got the ticket, how I verified it, the outcome with its number, and what I changed afterwards. Start from this subject's own story in the pack (its story headlines and Story lines) before any other. A one-line story is a failed answer.",
    ...(SUBJECT_TECH[pack.id] && /Story/.test(SUBJECT_TECH[pack.id]) ? ["- For a story question on this subject, tell the hand-written Story at the top of the pack depth first (for identity: the CVS Health AD group mover story), in full."] : []),
    "- Name the product's real components and mechanics when the subject is a product (for CyberArk: the Vault and Safes, PVWA, CPM rotation and reconcile, PSM session isolation and recording, PTA). Generic capability talk is a failed answer.",
    "- Plain spoken sentences only: no dashes, bullets, numbering, headings, or First/Second/Finally labels. Never repeat a sentence.",
    `- ${shape}`,
  ].join("\n")
}
