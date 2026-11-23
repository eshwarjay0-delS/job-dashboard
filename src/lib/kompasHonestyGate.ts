/**
 * Post-generation honesty gate (Parakeet S5).
 * The currently loaded resume is the source of truth for personal claims.
 * The Fortinet Houston text is only a fallback when no non-empty resume was
 * supplied. It must never replace a different, already-loaded candidate file.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

export const HOUSTON_RESUME_PATH = join(typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : "", "src/lib/kompas-houston-resume.txt")

const FORTINET_FIXTURE = `eshwarjay05@gmail.com
Fortinet AWS Cloud Networking Engineer with 9+ years designing, deploying and migrating secure network infrastructures across multi-region AWS environments.
Lead end-to-end FortiGate-VM deployments, active/active and active/passive HA clusters integrated with AWS Gateway Load Balancer and Transit Gateway.
Cisco FTD to Fortinet migrations across six AWS regions.
FortiManager and FortiAnalyzer supported those FortiGate-VM deployments.
NERC CIP applied to the network change and the zero-downtime cutovers.
The wider cutover beyond the FortiGate-VM clusters was a team effort.
Those FortiGate-VM deployments and the Cisco FTD to Fortinet migrations across six AWS regions were the part I can speak to.
`

function readHoustonResume(): string {
  try {
    const text = readFileSync(HOUSTON_RESUME_PATH, "utf8")
    if (text.trim()) return text
  } catch { /* the answer-service test loader and some bundles have no sibling txt */ }
  return FORTINET_FIXTURE
}

export const HOUSTON_RESUME = readHoustonResume()

const LEADING_RIGHT = /,\s*right\??\s*$/i
const YES_LEAD = /^\s*(?:yes\b|yeah\b|yep\b|i personally led|i led that myself|i did lead|i led it myself)\b/i
const INCIDENT = /\b(?:sev-?1|sev\s*1|went down|data loss|hours of downtime|lost the vpc|(?:we|i) had (?:an? )?outage|the cutover failed)\b/i
const WENT_WRONG = /\b(?:went wrong|what went wrong|a time .{0,40}failed|cutover|outage|incident you led)\b/i

const DENY_TOOLS = ["Dragos", "Qualys", "Splunk", "CrowdStrike", "Burp", "CyberArk", "Industrial Defender", "Sentinel", "Wiz", "Zscaler", "Fortify", "Snyk", "OSCP"]

function words(text: string): string[] {
  return String(text || "").trim().split(/\s+/).filter(Boolean)
}

function count(text: string): number {
  return words(text).length
}

export function honestySource(resume: string | null | undefined): string {
  // Owner, 22 Nov 2026 (Round 6): this returned the hardcoded HOUSTON_RESUME
  // whenever the resume mentioned jayeshwar44 / Saint Louis — i.e. for the
  // user's CURRENT resume. The Houston resume is an old profile that lacks
  // NIST, CSPM, Okta and the current certifications, so the honesty gate
  // flagged every extended resume fact as "not on my resume" and replaced
  // it with a disclaimer, shrinking answers back to 22-40 words. The actual
  // resume is the source of truth; the Houston text is only a fallback
  // when no resume is provided at all.
  const text = String(resume || "")
  if (!text.trim()) return HOUSTON_RESUME
  return text
}

function sourceHas(source: string, token: string): boolean {
  return source.toLowerCase().includes(token.toLowerCase())
}

function personalNumber(sentence: string): string[] {
  const found: string[] = []
  const re = /\b\d+(?:\.\d+)?\s*(?:%|percent|hours|hrs|minutes|people|users|sites|servers|endpoints|tickets)\b|\b(?:about|around|nearly|over|under)\s+\d+\b/gi
  for (const match of sentence.matchAll(re)) found.push(match[0])
  return found
}

function resumeLines(source: string): string[] {
  // Contact details may exist in the source resume, but they are not spoken
  // experience evidence. Never append an email, URL or phone-only line to an
  // interview answer when a relevant evidence line is unavailable.
  return String(source || "").split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 12)
    .filter((line) => !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line))
    .filter((line) => !/(?:https?:\/\/|www\.)\S+/i.test(line))
    .filter((line) => !/^\+?[\d\s().-]{7,}$/.test(line))
}

function lineMatching(source: string, pattern: RegExp): string {
  return resumeLines(source).find((line) => pattern.test(line)) || resumeLines(source)[0] || ""
}

function fitSpoken(core: string, source: string): string {
  const pool = resumeLines(source)
  let parts = core.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  let text = parts.join(" ")
  let i = 0
  while (count(text) < 120 && i < pool.length) {
    const next = pool[i++]
    if (text.includes(next.slice(0, 48))) continue
    parts.push(next)
    text = parts.join(" ")
  }
  while (count(text) > 180 && parts.length > 1) {
    const shorter = parts.slice(0, -1).join(" ")
    if (count(shorter) < 120) break
    parts = parts.slice(0, -1)
    text = parts.join(" ")
  }
  return text
}

export function scopeAnswer(resume = HOUSTON_RESUME): string {
  const source = honestySource(resume)
  const lead = lineMatching(source, /fortigate|migrat|ftd/i)
  const ha = lineMatching(source, /active\/passive|failover|ha cluster/i)
  const owned = /fortigate-vm/i.test(source) ? "I led the FortiGate-VM deployments and the HA clusters." : ""
  return fitSpoken(`I did not take that on alone. ${lead} ${ha} ${owned} The wider cutover was a team effort. I will not add a name the resume does not show.`, source)
}

export function wentWrongAnswer(resume = HOUSTON_RESUME): string {
  const source = honestySource(resume)
  const cutover = lineMatching(source, /zero-downtime|cutover|active\/passive/i)
  const move = lineMatching(source, /ftd|six aws|fortinet migration/i)
  return fitSpoken(`The resume does not name an outage, so I will not invent one. The grounded situation is the active/passive failover testing during those cutovers. ${cutover} ${move} If the check failed, I would keep the old path up and write down what the test showed. The wider cutover was a team effort.`, source)
}

export function designBridge(resume = HOUSTON_RESUME): string {
  const source = honestySource(resume)
  const gw = lineMatching(source, /gateway load balancer|transit gateway|fortigate/i)
  return fitSpoken(`I have not invented a personal outage for this design. ${gw} The wider cutover was a team effort. I will not add a name the resume does not show.`, source)
}

export function bridgeTemplates(resume = HOUSTON_RESUME): string[] {
  const source = honestySource(resume)
  return [scopeAnswer(source), wentWrongAnswer(source), designBridge(source), ...resumeLines(source), gapBridge(undefined, source)]
}

function gapBridge(tool: string | undefined, source: string): string {
  const toolLine = tool ? `I have not used ${tool}. ` : ""
  return `${toolLine}That detail is not on my resume, so I will not invent it. ${lineMatching(source, /migrat|fortigate|deploy/i)}`
}

function employerHits(sentence: string, source: string): string[] {
  const hits: string[] = []
  const re = /\b(?:at|for|with|from)\s+([A-Z][A-Za-z0-9&.'-]+(?:\s+[A-Z][A-Za-z0-9&.'-]+){0,3})/g
  for (const match of sentence.matchAll(re)) {
    const name = match[1].replace(/[.,;:]+$/g, "").replace(/\s+(?:I|we|the|and|during|when)$/i, "").trim()
    if (name.length < 3) continue
    if (/^(?:I|We|The|ServiceNow|Gateway|HTTP|GENEVE)$/i.test(name)) continue
    if (!sourceHas(source, name)) hits.push(name)
  }
  if (/\bSaint Louis University\b/i.test(sentence) && !sourceHas(source, "Saint Louis University")) hits.push("Saint Louis University")
  for (const name of ["Cigna", "Citi", "McKesson", "Mckesson", "Molina", "Valero"]) {
    if (new RegExp(`\\b${name}\\b`, "i").test(sentence) && !sourceHas(source, name)) hits.push(name)
  }
  return hits
}

function toolHits(sentence: string, source: string): string[] {
  return DENY_TOOLS.filter((tool) => new RegExp(`\\b${tool}\\b`, "i").test(sentence) && !sourceHas(source, tool) && /\bI (?:used|ran|deployed|administered|built|owned|led)\b/i.test(sentence))
}

function numberHits(sentence: string, source: string, question: string): string[] {
  const bag = `${source}\n${question}`.toLowerCase()
  return personalNumber(sentence).filter((n) => !bag.includes(n.toLowerCase().replace(/\s+/g, " ")))
}

function claimsIncident(answer: string, source: string): boolean {
  if (/\b(?:i will not invent|the resume does not (?:show|name)|i have not run|will not name an outage)\b/i.test(answer)) return false
  return INCIDENT.test(answer) && !INCIDENT.test(source)
}

export type HonestyResult = { text: string; rewritten: boolean; reasons: string[] }

export function applyHonestyGate(input: { question: string; answer: string; resume?: string | null }): HonestyResult {
  const question = String(input.question || "").replace(/\s+/g, " ").trim()
  const answer = String(input.answer || "").trim()
  const source = honestySource(input.resume)
  if (!answer) return { text: answer, rewritten: false, reasons: [] }
  const reasons: string[] = []
  if (LEADING_RIGHT.test(question) && YES_LEAD.test(answer)) {
    reasons.push("leading-yes")
    return { text: scopeAnswer(source), rewritten: true, reasons }
  }
  if (WENT_WRONG.test(question) && claimsIncident(answer, source)) {
    reasons.push("invented-incident")
    return { text: wentWrongAnswer(source), rewritten: true, reasons }
  }
  const sentences = answer.split(/(?<=[.!?])\s+/).filter(Boolean)
  const joined = sentences.join(" ")
  if (/\bgateway load balancer|inspection vpc|gwlb\b/i.test(question) && (employerHits(joined, source).length || toolHits(joined, source).length || claimsIncident(joined, source))) {
    reasons.push("design-bridge")
    return { text: designBridge(source), rewritten: true, reasons }
  }
  let changed = false
  const kept = sentences.map((sentence) => {
    const employers = employerHits(sentence, source)
    const tools = toolHits(sentence, source)
    const numbers = numberHits(sentence, source, question)
    const incident = claimsIncident(sentence, source)
    if (!employers.length && !tools.length && !numbers.length && !incident) return sentence
    changed = true
    if (employers.length) reasons.push(`employer:${employers[0]}`)
    if (tools.length) reasons.push(`tool:${tools[0]}`)
    if (numbers.length) reasons.push(`number:${numbers[0]}`)
    if (incident) reasons.push("incident")
    if (WENT_WRONG.test(question) || incident) return wentWrongAnswer(source)
    if (LEADING_RIGHT.test(question)) return scopeAnswer(source)
    return gapBridge(tools[0], source)
  })
  if (!changed) return { text: answer, rewritten: false, reasons: [] }
  const text = kept.join(" ").replace(/\s+/g, " ").trim()
  return { text, rewritten: true, reasons }
}
