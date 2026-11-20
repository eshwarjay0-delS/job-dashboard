/**
 * Resume-grounded long answer used when a model lane times out, returns 429 or
 * 5xx, or streams nothing. The same text is the length-band repair when a long
 * answer is short, over the ceiling, or names a fact the resume does not show.
 * No model call. The Houston file is the default source.
 */
import { designBridge, honestySource, scopeAnswer, wentWrongAnswer } from "./kompasHonestyGate.ts"

export const LONG_FLOOR = 120
export const LONG_CEILING = 180

const EMPLOYERS = ["Cigna", "Citi", "McKesson", "Molina", "Valero", "Saint Louis", "Northern Trust", "Wells Fargo"]
const TOOLS = ["Dragos", "Qualys", "Splunk", "CrowdStrike", "Burp", "CyberArk", "Sentinel", "Wiz", "Zscaler", "Fortify", "Snyk", "OSCP", "Terraform", "Graviton", "Ansible", "Kubernetes", "Palo Alto", "Check Point", "CloudFormation"]
const BRIDGE = /have not|has not|haven't|not on (?:my |the )?resume|will not invent|less direct hands-on|do not have|did not|never (?:used|run|written|wrote)|does not name an outage|question names/i
const YES_LEAD = /^\s*(?:yes\b|yeah\b|yep\b|i personally led|i led that myself|i did lead|i led it myself)\b/i
const SAFE_LINE = "I will not add an employer, a tool, or a number the resume does not show."

export function wordCount(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length
}

function sentences(text: string): string[] {
  return String(text || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

function resumeLines(source: string): string[] {
  return String(source || "").split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length > 12 && !line.includes("@"))
}

function closest(source: string): string {
  return resumeLines(source).find((line) => /fortigate|migrat|deploy/i.test(line)) || resumeLines(source)[0] || ""
}

export function fitLong(core: string, resume?: string): string {
  const source = honestySource(resume)
  const pool = resumeLines(source)
  let parts = sentences(core)
  let text = parts.join(" ")
  let i = 0
  while (wordCount(text) < LONG_FLOOR && i < pool.length) {
    const next = pool[i++]
    if (!next || text.includes(next.slice(0, 48))) continue
    const spoken = /[.!?]$/.test(next) ? next : `${next}.`
    if (wordCount(text) + wordCount(spoken) > LONG_CEILING) continue
    parts.push(spoken)
    text = parts.join(" ")
  }
  while (wordCount(text) < LONG_FLOOR) {
    parts.push(SAFE_LINE)
    text = parts.join(" ")
  }
  while (wordCount(text) > LONG_CEILING && parts.length > 1) {
    const shorter = parts.slice(0, -1).join(" ")
    if (wordCount(shorter) < LONG_FLOOR) break
    parts = parts.slice(0, -1)
    text = parts.join(" ")
  }
  return text.replace(/\s+/g, " ").trim()
}

function ensureBand(text: string, resume?: string): string {
  const n = wordCount(text)
  if (n >= LONG_FLOOR && n <= LONG_CEILING) return text.replace(/\s+/g, " ").trim()
  return fitLong(text, resume)
}

export type InventedClaim = { kind: "employer" | "tool" | "number" | "incident"; value: string }

export function inventedClaims(question: string, answer: string, resume?: string): InventedClaim[] {
  const source = honestySource(resume)
  const bag = `${source}\n${question}`.toLowerCase()
  const hits: InventedClaim[] = []
  for (const sentence of sentences(answer)) {
    if (BRIDGE.test(sentence)) continue
    for (const name of EMPLOYERS) {
      if (new RegExp(`\\b${name}\\b`, "i").test(sentence) && !bag.includes(name.toLowerCase())) hits.push({ kind: "employer", value: name })
    }
    for (const tool of TOOLS) {
      if (new RegExp(`\\b${tool}\\b`, "i").test(sentence) && !bag.includes(tool.toLowerCase())) hits.push({ kind: "tool", value: tool })
    }
    for (const match of sentence.matchAll(/\b\d+(?:\.\d+)?\b/g)) {
      if (!bag.includes(match[0])) hits.push({ kind: "number", value: match[0] })
    }
    if (/\b(?:sev-?1|data loss|hours of downtime|we had an outage|the cutover failed)\b/i.test(sentence)) hits.push({ kind: "incident", value: "outage" })
  }
  const seen = new Set<string>()
  return hits.filter((hit) => {
    const key = `${hit.kind}:${hit.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function isGapQuestion(question: string, resume?: string): boolean {
  const source = honestySource(resume).toLowerCase()
  const q = String(question || "")
  if (/\b(?:went wrong|cutover that)\b/i.test(q)) return true
  return TOOLS.some((tool) => new RegExp(`\\b${tool}\\b`, "i").test(q) && !source.includes(tool.toLowerCase()))
}

export function hasHonestBridge(question: string, answer: string, resume?: string): boolean {
  if (!isGapQuestion(question, resume)) return true
  return BRIDGE.test(answer) || /failover testing|team effort/i.test(answer)
}

export function scopeHeld(question: string, answer: string): boolean {
  if (!/\bright\?\s*$/i.test(String(question || "").trim())) return true
  if (YES_LEAD.test(answer)) return false
  return /team effort|did not take that on alone|part I can speak to/i.test(answer)
}

function required(question: string): RegExp[] {
  const q = String(question || "")
  if (/\bright\?\s*$/i.test(q)) return [/team effort|did not take that on alone|part I can speak to/i]
  if (/\bgraviton\b/i.test(q)) return [/\bgraviton\b/i, BRIDGE]
  if (/\bterraform\b/i.test(q)) return [/\bterraform\b/i, BRIDGE]
  if (/\b(?:went wrong|cutover)\b/i.test(q)) return [/will not invent|does not name an outage|failover/i]
  if (/\bfortimanager\b|\bfortianalyzer\b/i.test(q)) return [/fortimanager/i, /fortianalyzer/i]
  if (/active\/active|active\/passive/i.test(q)) return [/active\/active/i, /active\/passive/i]
  if (/\bftd\b|21 cisco/i.test(q)) return [/\bftd\b/i, /six aws/i]
  if (/\bgwlb\b|gateway load balancer|inspection vpc/i.test(q)) return [/gateway load balancer|\bgwlb\b/i, /fortigate/i]
  if (/fortigate/i.test(q)) return [/fortigate/i, /gateway load balancer|transit gateway/i]
  if (/yourself/i.test(q)) return [/fortinet|fortigate/i, /9\+|nine years|\b9 years\b/i]
  return [/fortigate|fortinet/i]
}

export function factsHeld(question: string, answer: string): boolean {
  return required(question).every((re) => re.test(answer))
}

export function groundedLongAnswer(question: string, resume?: string): string {
  const source = honestySource(resume)
  const q = String(question || "").replace(/\s+/g, " ").trim()
  const near = closest(source)
  if (/\bright\?\s*$/i.test(q)) return ensureBand(scopeAnswer(source), source)
  if (/\bgraviton\b/i.test(q)) return fitLong(`I have not run workloads on Graviton. That detail is not on my resume, so I will not invent an instance family or a benchmark. ${near}`, source)
  if (/\bterraform\b/i.test(q)) return fitLong(`I have not written Terraform on this resume, so I will not invent a module count. That detail is not on my resume. ${near}`, source)
  if (/\b(?:went wrong|cutover)\b/i.test(q)) return ensureBand(wentWrongAnswer(source), source)
  if (/\bfortimanager\b|\bfortianalyzer\b/i.test(q)) return fitLong(`FortiManager and FortiAnalyzer supported those FortiGate-VM deployments. I can speak to that pair on the firewalls the resume already names. I will not add a policy count or a report count the resume does not show. ${near}`, source)
  if (/active\/active|active\/passive/i.test(q)) return fitLong(`Active/active and active/passive are both on the FortiGate-VM deployments. Active/passive is the HA mode I tie to the zero-downtime cutovers. Active/active is the other cluster mode on those same FortiGate-VM deployments, integrated with AWS Gateway Load Balancer and Transit Gateway. I will not add a failover count the resume does not show.`, source)
  if (/\bftd\b|21 cisco/i.test(q)) return fitLong(`The question names 21 Cisco FTDs. I will not treat that count as a result past the question. The resume shows Cisco FTD to Fortinet migrations across six AWS regions. Those FortiGate-VM deployments and the migrations were the part I can speak to.`, source)
  if (/\bgwlb\b|gateway load balancer|inspection vpc/i.test(q)) return ensureBand(designBridge(source), source)
  if (/fortigate/i.test(q)) return fitLong(`I deploy FortiGate-VM in AWS as end-to-end FortiGate-VM deployments. Those clusters are active/active and active/passive, integrated with AWS Gateway Load Balancer and Transit Gateway. I will not add a subnet count the resume does not show. ${near}`, source)
  if (/yourself/i.test(q)) return fitLong(`I am a Fortinet AWS Cloud Networking Engineer with 9+ years designing, deploying and migrating secure network infrastructures across multi-region AWS environments. I lead end-to-end FortiGate-VM deployments. The wider cutover beyond the FortiGate-VM clusters was a team effort. ${near}`, source)
  const lead = resumeLines(source)[0] || near || SAFE_LINE
  return fitLong(`I can speak to what this resume shows. ${lead}`, source)
}

/** Keep a long answer that is already in band and grounded. Otherwise the cached resume answer. */
export function enforceLongAnswer(question: string, answer: string, resume?: string): string {
  const source = honestySource(resume)
  const text = String(answer || "").replace(/\s+/g, " ").trim()
  const n = wordCount(text)
  if (
    text
    && n >= LONG_FLOOR
    && n <= LONG_CEILING
    && inventedClaims(question, text, source).length === 0
    && hasHonestBridge(question, text, source)
    && scopeHeld(question, text)
    && factsHeld(question, text)
  ) return text
  return groundedLongAnswer(question, source)
}
