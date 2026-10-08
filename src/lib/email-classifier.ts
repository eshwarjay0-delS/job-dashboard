// ── Email classifier ────────────────────────────────────────────────────────
// Priority-ordered keyword rules over subject + snippet + sender.
// Ported from the 5,679-email classification spider (Oct 8, 2026).
// Runs on subject/snippet only — no full-body fetch needed for triage.

export type EmailCategory =
  | "RTR Request"
  | "Rate Confirmation"
  | "Job Description"
  | "Interview Request"
  | "Document Request"
  | "Submission Confirmation"
  | "Rejection"
  | "Follow-up"
  | "Offer"
  | "Sales Pitch"
  | "General Correspondence"

export type Confidence = "high" | "medium" | "low"

export interface Classification {
  category: EmailCategory
  confidence: Confidence
  jobTitle: string
  rate: string
  client: string
  vendor: string
  vendorDomain: string
}

export interface ClassifiableEmail {
  subject: string
  snippet: string
  from: string
}

// ── Marketing firms: never follow-up targets ────────────────────────────────
export const MARKETING_FIRM_DOMAINS = [
  "tekblu.us",
  "cloudquestit.com",
  "teksolveit.com",
] as const

export function isMarketingFirmDomain(domain: string): boolean {
  const d = domain.toLowerCase()
  return (MARKETING_FIRM_DOMAINS as readonly string[]).some(m => d === m || d.endsWith("." + m))
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractDomain(from: string): string {
  const m = from.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  return m ? m[1].toLowerCase() : ""
}

function extractVendor(from: string): string {
  // "Jane Doe <jane@vyzeinc.com>" → "Jane Doe"; "jane@vyzeinc.com" → "jane"
  const nameMatch = from.match(/^([^<]+)</)
  if (nameMatch) return nameMatch[1].trim()
  const emailMatch = from.match(/^([^@\s]+)@/)
  return emailMatch ? emailMatch[1] : from.slice(0, 40)
}

function extractRate(text: string): string {
  const m = text.match(/\$(\d{2,3})(?:\s*[-–]\s*\$?\d{2,3})?\s*\/\s*hr/i)
  return m ? `$${m[1]}/hr` : ""
}

function extractJobTitle(subject: string): string {
  // Strip common prefixes, then take the meaningful core
  let t = subject
    .replace(/^(re|fw|fwd)\s*:\s*/gi, "")
    .replace(/^(rtr|rate confirmation)\s*[:|-]\s*/gi, "")
    .trim()
  // Cut at common separators that start metadata
  t = t.split(/\s*[|–—]\s*(remote|onsite|hybrid|location|rate|duration)/i)[0]
  return t.slice(0, 120).trim()
}

// ── Priority-ordered rules ──────────────────────────────────────────────────
// Order matters: first match wins. More specific categories come first.

interface Rule {
  category: EmailCategory
  confidence: Confidence
  test: (text: string, from: string) => boolean
}

const RULES: Rule[] = [
  {
    category: "Rejection",
    confidence: "high",
    test: t =>
      /not moving forward|position (has been )?filled|unfortunately.*(?:role|position|application)|we will not be proceeding|regret to inform|decided to (move|go) with (another|other)/i.test(t),
  },
  {
    category: "Offer",
    confidence: "high",
    test: t => /offer letter|we are pleased to extend|formal offer|offer of employment/i.test(t),
  },
  {
    category: "Interview Request",
    confidence: "high",
    test: t =>
      /interview (invitation|invite|request|scheduled|slot)|screening call|technical (round|interview|screen)|client interview|panel interview|video interview|teams (meeting|invite).*interview|interview.*teams|schedule.*interview/i.test(t),
  },
  {
    category: "RTR Request",
    confidence: "high",
    test: t =>
      /\brtr\b|right to represent|exclusive representation|authorization to represent|representation form|sign.*rtr/i.test(t),
  },
  {
    category: "Rate Confirmation",
    confidence: "high",
    test: t =>
      /rate confirmation|\brate (confirmation|confirmed|agreed)|confirm.*\$\d+.*\/hr|\$\d+\/hr.*confirm|c2c rate/i.test(t),
  },
  {
    category: "Document Request",
    confidence: "high",
    test: t =>
      /send.*(resume|dl|driver'?s license|passport|ssn|visa|i-9|w-2|work authorization|photo id|government id)|need.*(documents|resume|dl copy)|share.*(resume|documents)|updated resume/i.test(t),
  },
  {
    category: "Submission Confirmation",
    confidence: "high",
    test: (t) =>
      /profile (submitted|has been submitted)|submitted (your|the) profile|submission confirm|shortlisted|you have been submitted/i.test(t) &&
      !/interview/i.test(t),
  },
  {
    category: "Job Description",
    confidence: "medium",
    test: t =>
      /job description|\bjd\b.{0,20}(attached|below)|requirement|opening for|we are hiring|looking for.{0,40}(engineer|analyst|developer|architect|consultant)|position.{0,30}(remote|onsite|hybrid)/i.test(t),
  },
  {
    category: "Follow-up",
    confidence: "medium",
    test: t =>
      /following up|follow.?up|just checking in|any update|status update|touching base|circling back|bumping this/i.test(t),
  },
  {
    category: "Sales Pitch",
    confidence: "medium",
    test: (t, from) =>
      /bench sales|hotlist|available (immediately|for new)|marketing (my|our) (profile|candidate)|candidate (available|for sale)/i.test(t) ||
      /@(benchinfo|bench\.info)/i.test(from),
  },
]

// Job-board / aggregator noise — always General, never actionable
const NOISE_SENDERS = [
  "linkedin.com", "indeed.com", "dice.com", "glassdoor.com",
  "hays.", "lensa.com", "ziprecruiter", "monster.com",
  "remotehunter", "tsenta", "google.com", // google.com = calendar notifications
]

function isNoise(from: string, subject: string): boolean {
  const f = from.toLowerCase()
  if (NOISE_SENDERS.some(n => f.includes(n))) return true
  if (/job alert|new jobs match|daily digest|unsubscribe/i.test(subject)) return true
  return false
}

// ── Main entry ──────────────────────────────────────────────────────────────

export function classifyEmail(email: ClassifiableEmail): Classification {
  const { subject, snippet, from } = email
  const text = `${subject} ${snippet}`
  const domain = extractDomain(from)

  if (isNoise(from, subject)) {
    return {
      category: "General Correspondence",
      confidence: "high",
      jobTitle: "",
      rate: "",
      client: "",
      vendor: extractVendor(from),
      vendorDomain: domain,
    }
  }

  for (const rule of RULES) {
    if (rule.test(text, from)) {
      return {
        category: rule.category,
        confidence: rule.confidence,
        jobTitle: extractJobTitle(subject),
        rate: extractRate(text),
        client: "",
        vendor: extractVendor(from),
        vendorDomain: domain,
      }
    }
  }

  return {
    category: "General Correspondence",
    confidence: "low",
    jobTitle: "",
    rate: "",
    client: "",
    vendor: extractVendor(from),
    vendorDomain: domain,
  }
}

// ── Phone extraction (Quickies tab) ──────────────────────────────────────────

export function extractPhones(text: string): string[] {
  const matches = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?:\s*(?:ext|x|extension)\.?\s*\d+)?/gi) || []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of matches) {
    const digits = m.replace(/\D/g, "")
    if (digits.length >= 10 && digits.length <= 12 && !seen.has(digits)) {
      seen.add(digits)
      out.push(m.trim())
    }
  }
  return out.slice(0, 3)
}

// ── Tab mapping ─────────────────────────────────────────────────────────────

export const CATEGORY_TABS = [
  "All",
  "RTR Request",
  "Rate Confirmation",
  "Interview Request",
  "Job Description",
  "Follow-up",
  "Unreplied",
] as const

export type CategoryTab = (typeof CATEGORY_TABS)[number]
