// Double-submit guardrail: two filings on one req = automatic disqualification.
// Before any apply, check past submissions for the same company + similar role.
// Warn, don't block — the user makes the final call.

export type SubmittedEvent = {
  title: string
  company: string
  url: string
  at: number
  resume?: string
  location?: string
}

// Normalize company names for comparison: lowercase, strip suffixes/punctuation
function normCompany(s: string): string {
  return s.toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|technologies|technology|tech|solutions|services|group|partners)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

// Extract the core role words from a title (drop seniority, contract-type noise)
function roleKeywords(title: string): string[] {
  const stop = new Set(["senior", "sr", "junior", "jr", "lead", "principal", "staff", "contract", "contractor", "temporary", "temp", "full", "time", "part", "remote", "hybrid", "onsite", "i", "ii", "iii", "iv", "v", "1", "2", "3", "4", "5"])
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w))
}

function companiesMatch(a: string, b: string): boolean {
  const na = normCompany(a), nb = normCompany(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // One contains the other (handles "Blue Star" vs "Blue Star Partners")
  return na.includes(nb) || nb.includes(na)
}

function titlesMatch(a: string, b: string): boolean {
  const ka = new Set(roleKeywords(a)), kb = new Set(roleKeywords(b))
  if (ka.size === 0 || kb.size === 0) return false
  let overlap = 0
  for (const w of ka) if (kb.has(w)) overlap++
  const minSize = Math.min(ka.size, kb.size)
  // At least half the keywords overlap, minimum 2
  return overlap >= 2 && overlap / minSize >= 0.5
}

// V2: location matching for cross-vendor same-req detection.
// Ace vs Vyze filing the same Richmond VA req have different company names
// but the same role + same city. Normalize: lowercase, strip state/zip.
function normLocation(s: string): string {
  return s.toLowerCase()
    .replace(/\b\d{5}(-\d{4})?\b/g, "")  // zip codes
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2)
    .sort()
    .join(" ")
}

function locationsMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const na = normLocation(a), nb = normLocation(b)
  if (!na || !nb) return false
  return na === nb
}

export type DuplicateHit = {
  event: SubmittedEvent
  reason: string
}

// Check a job against past submissions. Returns hits (usually 0 or 1).
export function findDuplicates(
  job: { title: string; company: string; location?: string },
  submitted: SubmittedEvent[]
): DuplicateHit[] {
  const hits: DuplicateHit[] = []
  for (const ev of submitted) {
    if (!ev.company || !ev.title) continue
    const sameCompany = companiesMatch(job.company, ev.company)
    const sameRole = titlesMatch(job.title, ev.title)
    if (sameCompany && sameRole) {
      const date = new Date(ev.at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
      hits.push({
        event: ev,
        reason: `Submitted "${ev.title}" at ${ev.company} on ${date}${ev.resume ? ` with ${ev.resume}` : ""}`,
      })
    } else if (sameRole && locationsMatch(job.location, ev.location)) {
      // V2: same role + same location, different vendor = likely same end-client req
      const date = new Date(ev.at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
      hits.push({
        event: ev,
        reason: `Possible same req via different vendor: "${ev.title}" in ${ev.location} via ${ev.company} on ${date} — verify end client before submitting`,
      })
    }
  }
  // Most recent first
  return hits.sort((a, b) => b.event.at - a.event.at)
}
