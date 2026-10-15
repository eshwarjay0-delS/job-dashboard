// "My recruiters": the people who put the person's profile in front of others, kept as a list of the person's own.
//
// Asked on 13 Oct 2026, with a picture of two Overview cards telling him to nudge people who market his profile: "these
// recruiters, they are actually forwarding my profile and ... it matters whom they are forwarding the profile [to] and
// those guys are the ones that I have to let reach out and that is the connecting dot ... he's my recruiter so ... I
// don't have to follow up with him over the Gmail ... not ignore, like a recruiter list, my recruiter list specifically.
// So whoever these guys are emailing would be my loop guys and that's where you start the connecting dots from ... not
// just in the overview tab ... whenever there is an email, in whichever tab, if I say this is my recruiter, once I
// click that, it would be added. And also give me an option like: any person from this company is my recruiter."
//
// THE MISTAKE THIS PREVENTS. Overview treated a recruiter who works FOR him like anyone else who owed him an answer: it
// put "You wrote 14 days ago and Saanvi has not answered. A short, friendly nudge is due" on top. She does not owe him an
// answer; she sends his resume on without being asked. The person to watch is whoever she sent it to.
//
// This file is the list and its rules only (no storage, no network): one person by their address, or everyone at a
// company by what stands after the @. What Overview does with it is in mail-overview.ts.

export type RecruiterRule = { kind: "person" | "company"; value: string; name?: string; at: number }
export const MOST_RECRUITERS = 60

// An address at one of these says nothing about a company: "everyone at gmail.com" is everyone.
const NOT_A_COMPANY = /^(?:gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|aol|proton|protonmail|pm|zoho|gmx|google|microsoft|linkedin)\.[a-z.]+$/i
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i
const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i

export const domainOf = (email: string): string => String(email || "").trim().toLowerCase().split("@")[1] || ""
/** May "everyone at this address's company" be a rule? Not for a free mail service. */
export const companyDomainOf = (email: string): string => { const d = domainOf(email); return d && DOMAIN.test(d) && !NOT_A_COMPANY.test(d) ? d : "" }

/** One entry of the list as it is kept, or null when what was sent cannot be one. */
export function tidyRecruiter(input: unknown, now: number): RecruiterRule | null {
  const src = (input && typeof input === "object" ? input : {}) as Partial<RecruiterRule>
  const raw = typeof src.value === "string" ? src.value.trim().toLowerCase() : ""
  const name = typeof src.name === "string" ? src.name.replace(/\s+/g, " ").trim().slice(0, 80) : ""
  const at = typeof src.at === "number" && Number.isFinite(src.at) && src.at > 0 ? src.at : now
  if (src.kind === "person") return EMAIL.test(raw) && raw.length <= 200 ? { kind: "person", value: raw, ...(name ? { name } : {}), at } : null
  if (src.kind === "company") {
    // An address may be handed in for a company: what stands after its @ is the company.
    const domain = raw.includes("@") ? domainOf(raw) : raw
    return DOMAIN.test(domain) && domain.length <= 120 && !NOT_A_COMPANY.test(domain) ? { kind: "company", value: domain, ...(name ? { name } : {}), at } : null
  }
  return null
}

export function validRecruiters(raw: unknown): RecruiterRule[] {
  const seen = new Set<string>()
  return (Array.isArray(raw) ? raw : []).map(r => tidyRecruiter(r, 0)).filter((r): r is RecruiterRule => !!r && !seen.has(`${r.kind}:${r.value}`) && !!seen.add(`${r.kind}:${r.value}`)).slice(0, MOST_RECRUITERS)
}

/** The rule that makes this address one of the person's recruiters, if any: their own entry first, then their company's. */
export function recruiterRuleFor(rules: RecruiterRule[], email: string): RecruiterRule | undefined {
  const address = String(email || "").trim().toLowerCase()
  if (!address) return undefined
  const domain = domainOf(address)
  return rules.find(r => r.kind === "person" && r.value === address) || rules.find(r => r.kind === "company" && !!domain && (domain === r.value || domain.endsWith(`.${r.value}`)))
}
export const isMyRecruiter = (rules: RecruiterRule[], email: string): boolean => !!recruiterRuleFor(rules, email)

/** The list with one more entry. Nothing is added twice, and a full list says so instead of dropping someone. */
export function withRecruiter(rules: RecruiterRule[], rule: RecruiterRule): { rules: RecruiterRule[]; added: boolean; why?: "there" | "full" } {
  if (rules.some(r => r.kind === rule.kind && r.value === rule.value)) return { rules, added: false, why: "there" }
  if (rules.length >= MOST_RECRUITERS) return { rules, added: false, why: "full" }
  return { rules: [...rules, rule], added: true }
}
export const withoutRecruiter = (rules: RecruiterRule[], kind: string, value: string): RecruiterRule[] => rules.filter(r => !(r.kind === kind && r.value === String(value || "").trim().toLowerCase()))

/** The people a message was sent to, from its To or Cc line: "Priya Shah <priya@acme.example>, raj@acme.example". */
export function addressesIn(header: string): { name: string; email: string }[] {
  const out: { name: string; email: string }[] = []
  for (const part of String(header || "").split(/[,;](?![^<]*>)(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
    const found = /<?\s*([a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+)\s*>?/i.exec(part)
    if (!found) continue
    const email = found[1].toLowerCase()
    if (out.some(o => o.email === email)) continue
    const name = part.slice(0, found.index).replace(/["'<>]/g, " ").replace(/\s+/g, " ").trim()
    out.push({ name: name && !name.includes("@") ? name.slice(0, 80) : "", email })
  }
  return out.slice(0, 20)
}
