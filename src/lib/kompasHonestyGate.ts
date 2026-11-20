/**
 * Post-generation honesty gate (Parakeet S5).
 * The source file is the eshwarjay05 platform resume. Bridges may use only
 * lines from that file. ServiceNow is a tool in that resume, not a role the
 * speaker led. A leading "right?" answer scopes the real migration and
 * failover lines and says which part was the team's, without a new name.
 * A "went wrong" answer uses failover testing during those migrations.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const HOUSTON_RESUME_PATH = join(dirname(fileURLToPath(import.meta.url)), "kompas-houston-resume.txt")
export const HOUSTON_RESUME = readFileSync(HOUSTON_RESUME_PATH, "utf8")

const LINE = {
  migrate: "Migrated apps using Terraform, Ansible, CloudFormation; standardized VPC, subnets, NAT, TGW.",
  provision: "Provisioned cloud infrastructure via Terraform and CloudFormation, integrating with ServiceNow Change Management and enforcing policy-as-code with OPA and AWS Config Rules.",
  regions: "Proven ability to design HA/DR solutions, optimize cloud cost/performance, and manage multi-region deployments.",
  failover: "Performed SQL Server administration tasks including failover clustering, mirroring, version upgrades, patching in high-availability (HA) environments.",
  firewall: "Secured infrastructure by auditing firewall policies, ensuring compliance and integrity across segmented environments.",
  teams: "Collaborated with security and application teams to embed change control via ServiceNow and audit evidence into deployment pipelines.",
} as const

const SAINT_LOUIS = /jayeshwar44|jayeshwar24|eshwarjay06|saint louis university/i
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
  const text = String(resume || "")
  if (!text.trim() || SAINT_LOUIS.test(text)) return HOUSTON_RESUME
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

const POOL = [
  LINE.migrate,
  LINE.provision,
  LINE.regions,
  LINE.failover,
  LINE.firewall,
  LINE.teams,
  "The automation was the part I can speak to. The wider cutover was a team effort, and I will not invent a name for that team.",
]

function fitSpoken(core: string): string {
  let parts = core.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  let text = parts.join(" ")
  let i = 0
  while (count(text) < 120 && i < POOL.length) {
    parts.push(POOL[i++].replace(/\s+/g, " ").trim())
    text = parts.join(" ")
  }
  while (count(text) > 180 && parts.length > 1) {
    const next = parts.slice(0, -1).join(" ")
    if (count(next) < 120) break
    parts = parts.slice(0, -1)
    text = parts.join(" ")
  }
  return text
}

export function scopeAnswer(): string {
  return fitSpoken("I did not take that migration on alone. I migrated apps using Terraform, Ansible, and CloudFormation, and I standardized VPC, subnets, NAT, and TGW. I provisioned that infrastructure with Terraform and CloudFormation, and the resume also shows multi-region deployments. The failover work I can point to is failover clustering, mirroring, version upgrades, and patching in high-availability environments, plus auditing firewall policies. I collaborated with security and application teams. Those teams owned the cutover decisions outside the automation. ServiceNow on this resume is only the change-management tool. I will not add a name the resume does not show.")
}

export function wentWrongAnswer(): string {
  return fitSpoken("The resume does not name an outage, so I will not invent one. The grounded situation is the failover testing and validation during those migration cutovers. I migrated apps using Terraform, Ansible, and CloudFormation. The resume shows failover clustering, mirroring, version upgrades, and patching in high-availability environments, and it shows firewall policies being audited. If a cutover went wrong, I would say the failover check failed before the new path was trusted, keep the old path up, and write down what the test showed. I collaborated with security and application teams. The call on the wider cutover was a team effort. I will not name an outage or an employer that is not in the resume.")
}

export function designBridge(): string {
  return fitSpoken("I have not run that design as a personal story, so I will not invent one. The infrastructure work on the resume is Terraform and CloudFormation, including multi-region deployments, plus failover clustering and firewall policy audits. I collaborated with security and application teams. The wider cutover was a team effort. I will not name an employer the resume does not show.")
}

export function bridgeTemplates(): string[] {
  return [scopeAnswer(), wentWrongAnswer(), designBridge(), ...POOL, gapBridge()]
}

function gapBridge(tool?: string): string {
  const toolLine = tool ? `I have not used ${tool}. ` : ""
  return `${toolLine}That detail is not on my resume, so I will not invent it. ${LINE.migrate}`
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
    return { text: scopeAnswer(), rewritten: true, reasons }
  }
  if (WENT_WRONG.test(question) && claimsIncident(answer, source)) {
    reasons.push("invented-incident")
    return { text: wentWrongAnswer(), rewritten: true, reasons }
  }
  const sentences = answer.split(/(?<=[.!?])\s+/).filter(Boolean)
  const joined = sentences.join(" ")
  if (/\bgateway load balancer|inspection vpc|gwlb\b/i.test(question) && (employerHits(joined, source).length || toolHits(joined, source).length || claimsIncident(joined, source))) {
    reasons.push("design-bridge")
    return { text: designBridge(), rewritten: true, reasons }
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
    if (WENT_WRONG.test(question) || incident) return wentWrongAnswer()
    if (LEADING_RIGHT.test(question)) return scopeAnswer()
    return gapBridge(tools[0])
  })
  if (!changed) return { text: answer, rewritten: false, reasons: [] }
  const text = kept.join(" ").replace(/\s+/g, " ").trim()
  return { text, rewritten: true, reasons }
}
