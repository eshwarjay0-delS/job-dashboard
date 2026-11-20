/**
 * Post-generation honesty gate (Parakeet S5).
 * Claims of an incident, employer, tool, or personal number that are not in
 * the Houston eshwarjay05 resume are rewritten into an honest bridge.
 * The Saint Louis / jayeshwar44 profile is never the source.
 * A leading "..., right?" question is answered with scope, not an automatic yes.
 * A "what went wrong" question uses a resume fact or an honest frame, never an invented outage.
 */

export const HOUSTON_RESUME = [
  "Eshwar Janjirala | eshwarjay05@gmail.com | Houston",
  "Having 10+ years of experience in Sr. ServiceNow Development and Administration.",
  "Client: Mckesson - TX Sept 2023 - Present Role: Senior ServiceNow Developer",
  "Assists with ServiceNow platform incident resolution.",
  "Takes ownership of complex business requirements and works them to completion.",
  "Tracking of Incidents from creation to closure, with timely communication to business.",
  "Developed KYC (Know Your Customer) workflows to automate customer verification, compliance reviews, risk assessments, and approval processes.",
  "Implemented role-based access controls, approval workflows, and segregation of duties controls.",
  "Implemented fraud investigation workflows for case tracking, evidence management, escalation handling, regulatory reporting, and audit documentation.",
  "Client: Molina Health Care – Long Beach, CA Dec 2022 - Jul 2023 Role: ServiceNow Developer/Administrator",
  "Client: Valero Energy, Texas Nov 2018 to Oct 2022 Role: ServiceNow Developer/Analyst",
  "Client: Qualcomm, Bangalore, India Sept 2015 - Aug 2018 Role: ServiceNow Developer/Admin",
  "Education: B.Tech, Computer Science — JNTUH, India, Jun 2011 – May 2015",
  "ServiceNow, ITSM, ITOM, CMDB, Discovery, Change Management, Active Directory, Flow Designer, IntegrationHub, JavaScript, REST, SOAP.",
].join("\n")

const SAINT_LOUIS = /jayeshwar44|jayeshwar24|eshwarjay06|saint louis university/i
const LEADING_RIGHT = /,\s*right\??\s*$/i
const YES_LEAD = /^\s*(?:yes\b|yeah\b|yep\b|i personally led|i led that myself|i did lead|i led it myself)\b/i
const INCIDENT = /\b(?:outage|sev-?1|sev\s*1|went down|data loss|hours of downtime|cutover (?:failed|went wrong)|lost the vpc)\b/i
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
  "At McKesson I assist with ServiceNow platform incident resolution, and I track an incident from creation to closure so the business hears the status before they hear a guess.",
  "I took ownership of complex requirements and worked them to completion, including KYC workflows, role-based access, and the fraud investigation case flow.",
  "The wider change sat with the team. I owned the ServiceNow piece, and other people owned the business call and the systems outside that platform.",
  "Before McKesson I did the same kind of ServiceNow work at Molina Health Care, Valero Energy, and Qualcomm.",
  "I have 10+ years on ServiceNow administration and development, and that is the experience I will speak from.",
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
  return fitSpoken("I led the ServiceNow workflow work at McKesson; the wider effort was the team's. I owned the KYC workflows, the role-based access controls, and the fraud investigation case flow, and I worked those requirements to completion. I did not personally lead every migration or every cutover. Other people owned the business decision and the systems outside ServiceNow. So the accurate answer is that I led my piece, and the team led the rest.")
}

export function wentWrongAnswer(): string {
  return fitSpoken("The resume does not show a cutover that went wrong, so I will not invent an outage. What I have done is assist with ServiceNow platform incident resolution at McKesson. When a platform issue comes in, I track it from creation to closure and keep the business updated, and I watch the ticket so it does not sit. The closest miss I can speak to is a workflow that needed another pass: the catalog step was right and the approval path was wrong. I owned the ServiceNow workflow, the team owned the business decision, and we closed it by fixing the approval and the evidence on the ticket. I would treat a cutover the same way: name what failed, keep the old path up until the new one is proven, and write the incident down instead of narrating a story that is not mine.")
}

export function designBridge(): string {
  return fitSpoken("A Gateway Load Balancer inspection VPC sits on the path you want to inspect. The load balancer type is gateway, not network, and the appliances behind it speak GENEVE on port 6081, not HTTP. Consumer VPCs send traffic through a GWLB endpoint, the inspection VPC sees the original packet, and the packet goes back the same way after the appliance decides. I have not run that design as a personal outage story. At McKesson I assist with ServiceNow platform incident resolution and I track those tickets from creation to closure. If I were putting this in, I would set the target type to gateway and the protocol to GENEVE, and I would not say I personally led a cutover the resume does not show.")
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
  for (const name of ["Cigna", "Citi"]) {
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
  if (/\b(?:i will not invent|the resume does not show|i have not run)\b/i.test(answer)) return false
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
    if (WENT_WRONG.test(question) || incident) return "The resume does not show that outage, so I will not invent it. I assist with ServiceNow platform incident resolution at McKesson."
    if (LEADING_RIGHT.test(question)) return scopeAnswer()
    const tool = tools[0]
    const bridge = tool
      ? `I have not used ${tool}. I assist with ServiceNow platform incident resolution at McKesson.`
      : "That detail is not on my resume, so I will not invent it. I assist with ServiceNow platform incident resolution at McKesson."
    return bridge
  })
  if (!changed) return { text: answer, rewritten: false, reasons: [] }
  const text = kept.join(" ").replace(/\s+/g, " ").trim()
  return { text, rewritten: true, reasons }
}
