import { extractText, extractZones, calcYOE } from "./docx"

// A structured profile pulled from a resume — the data the Chrome extension uses
// to AUTOFILL job-application forms (name, contact, links, skills, experience).
// Read-only: never mutates the resume; just reads its content.
export interface Profile {
  name: string
  firstName: string
  lastName: string
  title: string
  email: string
  phone: string
  linkedin: string
  github: string
  website: string
  location: string
  yearsExperience: string
  skills: string[]
  experience: { role: string; bullets: string[]; current: boolean }[]
  education: string[]
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE_RE = /\+?\d?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9._/-]+/i
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9._/-]+/i
const SITE_RE = /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+\.(?:dev|io|me|com|net)\/[A-Za-z0-9._/-]*/i
// "City, ST" — the state must be a REAL US state code, so tech phrases like
// "AgentOps, AI" or "Landing Zones, Azure" never match.
const US_STATES = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC"
const LOCATION_RE = new RegExp(`\\b([A-Z][a-zA-Z.]+(?:\\s[A-Z][a-zA-Z.]+)?,\\s*(?:${US_STATES}))\\b`)

function cleanUrl(u: string): string {
  let s = u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[).,]+$/, "")
  // Profile slugs are lowercase-with-hyphens; cut at a camelCase boundary where a
  // following word (e.g. a tagline "AWS") got glued onto the URL with no space.
  s = s.replace(/([a-z0-9])([A-Z].*)$/, "$1")
  return s
}

export async function extractProfile(buf: Buffer): Promise<Profile> {
  const text = await extractText(buf)
  const zones = await extractZones(buf)
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
  // Contact details usually live in the first ~6 lines; scan those first, fall back to whole doc.
  const head = lines.slice(0, 6).join("  ")
  const grab = (re: RegExp, where = head) => (where.match(re) || text.match(re) || [""])[0]

  const name = (zones.header?.name || lines[0] || "").replace(/\s*[—–|].*$/, "").trim()
  const nameParts = name.split(/\s+/)
  const email = grab(EMAIL_RE)
  // Avoid matching a year range as a phone number: require a separator-y phone shape.
  const phoneRaw = grab(PHONE_RE)
  const phone = /\d{3}\D*\d{3}\D*\d{4}/.test(phoneRaw) ? phoneRaw.trim() : ""
  const linkedin = cleanUrl(grab(LINKEDIN_RE, text))
  const github = cleanUrl(grab(GITHUB_RE, text))
  const siteRaw = grab(SITE_RE, head)
  const website = siteRaw && !/linkedin|github/i.test(siteRaw) ? cleanUrl(siteRaw) : ""

  return {
    name,
    firstName: nameParts[0] || "",
    lastName: nameParts.length > 1 ? nameParts[nameParts.length - 1] : "",
    title: zones.header?.title || "",
    email,
    phone,
    linkedin,
    github,
    website,
    location: (head.match(LOCATION_RE) || [])[1] || "",
    yearsExperience: calcYOE(zones.roles),
    skills: zones.skills.map(s => s.text),
    experience: zones.roles.map(r => ({ role: r.role, bullets: r.bullets.map(b => b.text), current: !!r.current })),
    education: (zones.extras || [])
      .filter(e => /education|universit|college|bachelor|master|b\.?\s?s\.?|m\.?\s?s\.?|b\.?tech|degree/i.test(`${e.section} ${e.text}`))
      .map(e => e.text),
  }
}
