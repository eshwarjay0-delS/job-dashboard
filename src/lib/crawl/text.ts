// Reading job listings out of what a portal sends: HTML text, and the JobPosting records (schema.org JSON-LD) most
// job pages carry for search engines. Shared by every portal adapter; imported with its ".ts" so tests can load it.
import type { RawJob } from "./types"

export const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ")
// The punctuation WordPress and the ATS portals write by name (INSPYR's feed has "&ndash;" and "&rsquo;" in its titles).
const NAMED: Record<string, string> = {
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", bull: "•", middot: "·", reg: "®", trade: "™", copy: "©",
}
export const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&([a-z]+);/gi, (whole, name: string) => NAMED[name.toLowerCase()] ?? whole)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
export const clean = (s: string) => decodeEntities(stripTags(String(s ?? ""))).replace(/\s+/g, " ").trim()

/** The page split at each occurrence of `marker`, without what comes before the first. */
export function splitCards(html: string, marker: RegExp): string[] {
  const parts = html.split(marker)
  parts.shift()
  return parts
}

/** A link made absolute against the page it was found on. */
export function absolute(href: string, base: string): string {
  try { return new URL(decodeEntities(href), base).toString() } catch { return href }
}

type Place = { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } }
const placeOf = (loc: unknown, remote: boolean): string | undefined => {
  const all = (Array.isArray(loc) ? loc : loc ? [loc] : []) as Place[]
  const names = all.map(p => {
    const a = p?.address || {}
    const country = typeof a.addressCountry === "string" ? a.addressCountry : a.addressCountry?.name
    return [a.addressLocality, a.addressRegion, all.length === 1 && !a.addressLocality ? country : ""].filter(Boolean).join(", ")
  }).filter(Boolean)
  const place = [...new Set(names)].join("; ")
  return remote ? (place ? `Remote (${place})` : "Remote") : place || undefined
}

type Salary = { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } }
const payOf = (s: unknown): string | undefined => {
  const v = (s as Salary)?.value
  if (!v) return undefined
  const cur = (s as Salary).currency === "USD" || !(s as Salary).currency ? "$" : `${(s as Salary).currency} `
  const amount = (n?: number) => (typeof n === "number" ? `${cur}${n.toLocaleString("en-US")}` : "")
  const range = v.minValue || v.maxValue ? [amount(v.minValue), amount(v.maxValue)].filter(Boolean).join(" - ") : amount(v.value)
  return range ? `${range}${v.unitText ? ` per ${String(v.unitText).toLowerCase()}` : ""}` : undefined
}

/** Every JobPosting record (JSON-LD) on a page, as jobs. `pageUrl` stands in when a record names no address. */
export function jobPostingsIn(html: string, pageUrl: string): RawJob[] {
  const out: RawJob[] = []
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try { data = JSON.parse(m[1].trim()) } catch { continue }
    const items: unknown[] = Array.isArray(data) ? data : (data as { "@graph"?: unknown[] })?.["@graph"] || [data]
    for (const it of items as Record<string, unknown>[]) {
      const type = it?.["@type"]
      if (!(type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting")))) continue
      const title = clean(String(it.title || ""))
      if (!title) continue
      const kinds = ([] as unknown[]).concat(it.employmentType || []).map(String).filter(Boolean)
      out.push({
        title,
        url: absolute(String(it.url || pageUrl), pageUrl),
        location: placeOf(it.jobLocation, it.jobLocationType === "TELECOMMUTE"),
        engagement: kinds.length ? kinds.join(", ") : undefined,
        payRange: payOf(it.baseSalary),
        postedAt: typeof it.datePosted === "string" ? it.datePosted : undefined,
        description: clean(String(it.description || "")).slice(0, 8000) || undefined,
      })
    }
  }
  return out
}

/** The page addresses a sitemap lists (`<loc>`), optionally only those matching `keep`. */
export function sitemapUrls(xml: string, keep?: RegExp): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => decodeEntities(m[1]))
  return keep ? urls.filter(u => keep.test(u)) : urls
}

const IT_TITLE = /\b(?:engineer|engineering|developer|analyst|architect|administrator|admin|security|cyber|cloud|network|devops|data|software|sql|java|python|\.net|sap|salesforce|servicenow|workday|oracle|infrastructure|database|dba|qa|tester|testing|help ?desk|desktop|technician|scrum|product owner|project manager|program manager|systems?|it|ai|ml|tableau|power bi|api|web|mobile|full ?stack|front ?end|back ?end|ux|ui|devsecops|sre|site reliability|etl|linux|unix|aws|azure|gcp|kubernetes|siem|iam|pentest|penetration|firewall|vulnerability|programmer|configuration management)\b/i

/** Does a job title name technology work? For portals that list every kind of job and give no category. */
export const isTechTitle = (title: string): boolean => {
  const t = String(title || "")
  return IT_TITLE.test(t) && !NOT_TECH.test(t) && !(OTHER_FIELD.test(t) && !STRONG_TECH.test(t))
}

// "Security Officer" is a guard, not a cyber role; a nurse or a driver can hold a title that names "systems" or "data".
const NOT_TECH = /\bsecurity (?:officer|guard)\b|\b(?:nurse|driver|warehouse|janitor|custodian)\b/i
// An engineer, manager, technician or clerk of another field (21 Oct 2026: "Electrical Engineer", "Structural Project
// Manager", "Admin Support Clerk", "Pharmacy Fulfillment Technician" read as technology work) unless the title also names
// software, data, systems or the like ("Electrical Engineer - SCADA Software" stays).
const OTHER_FIELD = /\b(?:electrical|mechanical|civil|structural|chemical|manufacturing|locum|pharmacy|pharmacist|clerk|payroll|accounts (?:payable|receivable)|procurement|sourcing|construction|hvac|plumbing|facilities|fulfillment)\b/i
const STRONG_TECH = /\b(?:software|developer|programmer|data|cloud|cyber|network|it|systems?|sap|oracle|salesforce|servicenow|workday|devops|database|sql|python|java|scada|plc|automation)\b/i

const PAY = /\$\s?\d[\d,]*(?:\.\d+)?\s?k?(?:\s?(?:\/|per\s)\s?(?:hr|hour|yr|year)\b\.?)?(?:\s?(?:-|\u2013|\u2014|to)\s?\$?\s?\d[\d,]*(?:\.\d+)?\s?k?(?:\s?(?:\/|per\s)\s?(?:hr|hour|yr|year)\b\.?)?)?/i
// A lone "$5" in "a $5 billion company" is not pay: it needs a unit, a range, a "k" or a whole-dollar figure.
const LOOKS_LIKE_PAY = /\d{4,}|\/|\bper\b|[-\u2013\u2014]|\bto\b|\dk\b/i

/** An HTML description as its lines (paragraphs, line breaks and list items each end a line), cleaned, empty ones dropped. */
export function linesOf(html: string): string[] {
  return String(html || "").replace(/<br\s*\/?>|<\/(?:p|li|div|h\d|tr)>/gi, "\n").split("\n").map(clean).filter(Boolean)
}

/** What a description writes after a label at the start of a line ("Location: Austin, TX"), or nothing. */
export function labelled(html: string, label: RegExp): string | undefined {
  for (const line of linesOf(html)) {
    const m = line.match(new RegExp(`^(?:${label.source})\\s*:\\s*(.+)$`, "i"))
    if (m) return m[1].trim()
  }
  return undefined
}

// A recruiter's own address or number written into a job description: not kept (no recruiter's personal details are stored).
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g

/** A description with every email address and phone number taken out. */
export const scrubContacts = (text: string): string => String(text || "").replace(EMAIL, "[email removed]").replace(PHONE, "[phone removed]")

/** The first pay figure a recruiter wrote near the top of a description ("Compensation: $62 - $82/hr"), or nothing. */
export function payIn(text: string): string | undefined {
  const found = String(text || "").slice(0, 1500).match(PAY)?.[0]?.replace(/\s+/g, " ").trim()
  return found && LOOKS_LIKE_PAY.test(found.replace(/,/g, "")) ? found : undefined
}
