// Setting a new person up as a conversation, one question at a time.
//
// Updated 14 Oct 2026: verify the mobile number first, then offer resume-based profile setup.
// This file is the rules only (no storage, no network, no model): which question comes next, the kinds of work and
// their branches, what a resume points to, and reading contact details from the plain words of a PDF.

import { CATEGORY_FOLDERS, rankResumeCategories } from "./resumeOrganization.ts"

export type Domain = { id: string; label: string; branches: string[] }

// The branches of cybersecurity are the folders Files already sorts resumes into, by the same names: what a person
// ticks here is where their resumes are filed and what the library counts.
const NOT_SECURITY = new Set(["DevOps and Platform Engineering", "Data and Software Engineering", "Software Validation and Quality", "General Security"])
export const DOMAINS: Domain[] = [
  { id: "cybersecurity", label: "Cybersecurity", branches: CATEGORY_FOLDERS.filter(c => !NOT_SECURITY.has(c)) },
  { id: "cloud-devops", label: "Cloud and DevOps", branches: ["DevOps and Platform Engineering", "Site Reliability Engineering", "Cloud Architecture", "AWS Engineering", "Azure Engineering", "Google Cloud Engineering", "Kubernetes and Containers", "Infrastructure as Code", "CI/CD and Release Engineering", "Observability and Monitoring", "Cloud Cost and FinOps"] },
  { id: "software", label: "Software Engineering", branches: ["Backend Engineering", "Frontend Engineering", "Full Stack Engineering", "Mobile (iOS and Android)", "Java and Spring", ".NET and C#", "Python Engineering", "JavaScript, TypeScript and Node", "Embedded and Systems", "QA and Test Automation", "Software Validation and Quality", "Engineering Management"] },
  { id: "data-ai", label: "Data and AI", branches: ["Data Engineering", "Data Analysis and BI", "Data Science", "Machine Learning Engineering", "Generative AI and LLM Applications", "MLOps", "Analytics Engineering", "Database Administration"] },
  { id: "it-systems", label: "IT and Business Systems", branches: ["Systems Administration", "Network Engineering", "IT Support and Help Desk", "ServiceNow", "SAP", "Salesforce", "ERP and Business Systems", "Workday and HR Systems"] },
  { id: "product-project", label: "Product, Project and Analysis", branches: ["Product Management", "Project and Program Management", "Scrum Master and Agile Delivery", "Business Analysis", "UX and Product Design", "Technical Writing"] },
]
export const MOST_BRANCHES = 12

export const domainById = (id: string): Domain | undefined => DOMAINS.find(d => d.id === id)
/** Only branches that belong to the kind of work chosen, each once, at most MOST_BRANCHES. */
export function validBranches(domainId: string, branches: unknown): string[] {
  const domain = domainById(domainId)
  if (!domain || !Array.isArray(branches)) return []
  return [...new Set(branches.filter((b): b is string => typeof b === "string" && domain.branches.includes(b)))].slice(0, MOST_BRANCHES)
}

// Where a kind of resume belongs when it is not one of cybersecurity's own folders.
const ELSEWHERE: Record<string, { domain: string; branch: string }> = {
  "DevOps and Platform Engineering": { domain: "cloud-devops", branch: "DevOps and Platform Engineering" },
  "Data and Software Engineering": { domain: "software", branch: "Full Stack Engineering" },
  "Software Validation and Quality": { domain: "software", branch: "Software Validation and Quality" },
}

/** What the resume points to: the kind of work, and up to three of its branches. Empty when it points to nothing. */
export function suggestFromResume(text: string): { domain: string; branches: string[] } {
  const ranked = rankResumeCategories(String(text || "")).filter(r => r.score >= 3 && r.category !== "General Security")
  if (!ranked.length) return { domain: "", branches: [] }
  const place = (category: string) => ELSEWHERE[category] || { domain: "cybersecurity", branch: category }
  const domain = place(ranked[0].category).domain
  const branches = ranked.map(r => place(r.category)).filter(p => p.domain === domain).map(p => p.branch)
  return { domain, branches: validBranches(domain, branches).slice(0, 3) }
}

export type Contact = { name: string; title: string; email: string; phone: string; location: string; linkedin: string }
export const NO_CONTACT: Contact = { name: "", title: "", email: "", phone: "", location: "", linkedin: "" }

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/
const LINKEDIN = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9._-]+/i
const STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC"
const PLACE = new RegExp(`\\b([A-Z][a-zA-Z.]+(?:\\s[A-Z][a-zA-Z.]+)?,\\s*(?:${STATES}))\\b`)
const JOB_WORD = /\b(engineer|analyst|developer|architect|manager|administrator|consultant|specialist|scientist|designer|lead|director|officer|tester|responder|owner|writer|master)\b/i

/**
 * Contact details from the plain words of a resume (a PDF has no layout to read, only its words). The name is the first
 * line that looks like one; the title is the first short line near the top that names a job.
 */
export function readContact(text: string): Contact {
  const lines = String(text || "").split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean)
  const head = lines.slice(0, 8)
  const top = head.join("  ")
  const grab = (re: RegExp, where: string) => (where.match(re) || [""])[0]
  const bare = (line: string) => !EMAIL.test(line) && !PHONE.test(line) && !/linkedin\.com|github\.com|https?:/i.test(line)
  const nameLine = head.find(l => bare(l) && /^[\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){1,3}$/u.test(l.replace(/\s*[|,].*$/, "")) && !JOB_WORD.test(l)) || ""
  const titleLine = head.find(l => l !== nameLine && bare(l) && l.length <= 60 && JOB_WORD.test(l) && !/[.!?]$/.test(l)) || ""
  const phone = grab(PHONE, top) || grab(PHONE, lines.slice(0, 20).join("  "))
  return {
    name: nameLine.replace(/\s*[|,].*$/, "").trim(),
    title: titleLine.replace(/^[|\s-]+|[|\s-]+$/g, "").split(/\s*[|]\s*/)[0].trim(),
    email: (grab(EMAIL, top) || grab(EMAIL, String(text || "").slice(0, 4000))).toLowerCase(),
    phone: /\d{3}\D*\d{3}\D*\d{4}/.test(phone) ? phone.trim() : "",
    location: (top.match(PLACE) || [])[1] || "",
    linkedin: grab(LINKEDIN, String(text || "").slice(0, 6000)).replace(/^https?:\/\//i, "").replace(/^www\./i, ""),
  }
}

/** Trim and bound what is kept of a contact, whatever it was read from. */
export function tidyContact(raw: Partial<Contact> | null | undefined): Contact {
  const s = (v: unknown, most: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, most) : "")
  return { name: s(raw?.name, 80), title: s(raw?.title, 100), email: s(raw?.email, 120).toLowerCase(), phone: s(raw?.phone, 24), location: s(raw?.location, 80), linkedin: s(raw?.linkedin, 120) }
}
export const hasContact = (c: Contact): boolean => !!(c.name || c.title || c.email || c.phone)

/** What is known about a person's setup, on the server. Kept small: it is read on every step. */
export type Setup = {
  resumeName?: string
  /** Read from the resume. Shown to the person; used only after they say yes. */
  read?: Contact
  /** "yes": fill the profile from the resume. "no": they will fill it in themselves on the Profile page. */
  consent?: "yes" | "no"
  suggested?: { domain: string; branches: string[] }
  phoneLater?: boolean
  gmailDone?: boolean
  domain?: string
  branches?: string[]
}
export type Facts = { phoneVerified: boolean; phoneRequired: boolean; inboxes: number; complete: boolean }
export type Step = "resume" | "confirm" | "phone" | "gmail" | "roles" | "done"
export const STEPS: Step[] = ["phone", "resume", "confirm", "gmail", "roles", "done"]

/** The one question to ask now. Each answer is kept on the server, so a reload or a trip to Google comes back here. */
export function nextStep(setup: Setup, facts: Facts): Step {
  if (facts.complete) return "done"
  // Ask for the phone first. Later defers setup without claiming verification.
  if (!facts.phoneVerified && !setup.phoneLater) return "phone"
  if (!setup.consent) return setup.read && hasContact(setup.read) ? "confirm" : "resume"
  if (!setup.gmailDone) return "gmail"
  if (!setup.domain || !(setup.branches || []).length) return "roles"
  return "done"
}

/** A setup read back from storage, with anything it should not hold left out. */
export function validSetup(raw: unknown): Setup {
  const src = (raw && typeof raw === "object" ? raw : {}) as Setup
  const domain = typeof src.domain === "string" && domainById(src.domain) ? src.domain : ""
  const suggested = src.suggested && typeof src.suggested === "object" && domainById(String(src.suggested.domain)) ? { domain: String(src.suggested.domain), branches: validBranches(String(src.suggested.domain), src.suggested.branches) } : undefined
  return {
    ...(typeof src.resumeName === "string" && src.resumeName ? { resumeName: src.resumeName.slice(0, 160) } : {}),
    ...(src.read ? { read: tidyContact(src.read) } : {}),
    ...(src.consent === "yes" || src.consent === "no" ? { consent: src.consent } : {}),
    ...(suggested ? { suggested } : {}),
    ...(src.phoneLater === true ? { phoneLater: true } : {}),
    ...(src.gmailDone === true ? { gmailDone: true } : {}),
    ...(domain ? { domain, branches: validBranches(domain, src.branches) } : {}),
  }
}
