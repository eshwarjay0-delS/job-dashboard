import { SKILL_ALIASES } from "@/lib/matching/computeMatchScore"

// ── Experience level ─────────────────────────────────────────────────────────
export const EXPERIENCE_LEVELS = [
  { key: "all",    label: "All levels" },
  { key: "entry",  label: "Entry" },
  { key: "mid",    label: "Mid" },
  { key: "senior", label: "Senior" },
  { key: "lead",   label: "Lead+" },
] as const
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]["key"]

/** Best-effort seniority guess from a job title alone (no level field exists
 * in any of the 3 job sources) — same detector every board uses, so "Senior"
 * means the same thing on the Full-Time Board, Live Board, and Contract Board. */
export function detectExpLevel(title: string): Exclude<ExperienceLevel, "all"> {
  const t = (title || "").toLowerCase()
  if (/\b(intern|junior|jr\.?|entry|associate|new grad|graduate)\b/.test(t)) return "entry"
  if (/\b(senior|sr\.?|iii|level [345]|l[345])\b/.test(t)) return "senior"
  if (/\b(lead|principal|staff|head|director|manager|vp|architect)\b/.test(t)) return "lead"
  return "mid"
}

// ── Salary ───────────────────────────────────────────────────────────────────
/** Pulls the first dollar figure out of a free-text salary/rate string
 * ("$120k – $150k", "$65/hr", "95,000") — 0 if none found. */
export function extractSalaryNumber(raw: string | null | undefined): number {
  if (!raw) return 0
  const m = raw.match(/[\d,]+/)
  return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0
}

// ── Date posted ──────────────────────────────────────────────────────────────
export const DATE_FILTERS = [
  { key: "any", label: "Any time", hours: Infinity },
  { key: "24h", label: "Past 24h", hours: 24 },
  { key: "3d", label: "Past 3 days", hours: 72 },
  { key: "7d", label: "Past week", hours: 24 * 7 },
  { key: "30d", label: "Past month", hours: 24 * 30 },
] as const
export type DateFilterKey = (typeof DATE_FILTERS)[number]["key"]

/** `posted` may be an ISO datetime (Full-Time board) or a short relative
 * label like "8h" / "2d" (Contract board's pre-generated data). Handles both. */
export function postedHoursAgo(posted: string): number | null {
  if (!posted) return null
  const iso = new Date(posted)
  if (!isNaN(iso.getTime())) return (Date.now() - iso.getTime()) / 3600000
  const m = posted.match(/^(\d+)\s*([hdw])/i)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  return unit === "h" ? n : unit === "d" ? n * 24 : n * 24 * 7
}

export function matchesDatePosted(posted: string, key: DateFilterKey): boolean {
  if (key === "any") return true
  const hoursAgo = postedHoursAgo(posted)
  if (hoursAgo === null) return true // unknown age — don't exclude it
  const filter = DATE_FILTERS.find(f => f.key === key)!
  return hoursAgo <= filter.hours
}

// ── Distance ─────────────────────────────────────────────────────────────────
// Approximate coordinates for major US tech hubs — enough for a useful
// "near me" radius filter without a geocoding API.
export const METRO_COORDS: Record<string, [number, number]> = {
  "san francisco": [37.7749, -122.4194], "san jose": [37.3382, -121.8863],
  "sunnyvale": [37.3688, -122.0363], "santa clara": [37.3541, -121.9552],
  "mountain view": [37.3861, -122.0839], "palo alto": [37.4419, -122.1430],
  "menlo park": [37.4538, -122.1822], "oakland": [37.8044, -122.2712],
  "seattle": [47.6062, -122.3321], "bellevue": [47.6101, -122.2015],
  "new york": [40.7128, -74.0060], "brooklyn": [40.6782, -73.9442],
  "boston": [42.3601, -71.0589], "cambridge": [42.3736, -71.1097],
  "austin": [30.2672, -97.7431], "dallas": [32.7767, -96.7970],
  "houston": [29.7604, -95.3698], "chicago": [41.8781, -87.6298],
  "denver": [39.7392, -104.9903], "boulder": [40.0150, -105.2705],
  "atlanta": [33.7490, -84.3880], "washington": [38.9072, -77.0369],
  "arlington": [38.8816, -77.0910], "reston": [38.9586, -77.3570],
  "los angeles": [34.0522, -118.2437], "san diego": [32.7157, -117.1611],
  "irvine": [33.6846, -117.8265], "phoenix": [33.4484, -112.0740],
  "salt lake city": [40.7608, -111.8910], "miami": [25.7617, -80.1918],
  "raleigh": [35.7796, -78.6382], "durham": [35.9940, -78.8986],
  "charlotte": [35.2271, -80.8431], "minneapolis": [44.9778, -93.2650],
  "detroit": [42.3314, -83.0458], "pittsburgh": [40.4406, -79.9959],
  "philadelphia": [39.9526, -75.1652], "portland": [45.5051, -122.6750],
  "columbus": [39.9612, -82.9988], "st louis": [38.6270, -90.1994],
  "st. louis": [38.6270, -90.1994], "nashville": [36.1627, -86.7816],
  "tampa": [27.9506, -82.4572], "orlando": [28.5383, -81.3792],
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const R = 3958.8
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Extracts the city name from a "City, ST" / "City, State" location string. */
function cityKeyOf(location: string): string | null {
  const city = (location || "").split(",")[0].trim().toLowerCase()
  return city in METRO_COORDS ? city : null
}

export const DISTANCE_OPTIONS = [
  { key: "any", label: "Any distance", miles: Infinity },
  { key: "25", label: "Within 25 mi", miles: 25 },
  { key: "50", label: "Within 50 mi", miles: 50 },
  { key: "100", label: "Within 100 mi", miles: 100 },
] as const
export type DistanceKey = (typeof DISTANCE_OPTIONS)[number]["key"]

/** True if the job passes the distance filter. Remote jobs always pass —
 * "near me" is about commute distance, which doesn't apply to remote work.
 * If either city can't be resolved to known coordinates, don't exclude it
 * (a missing hub in the table shouldn't silently hide real jobs). */
export function matchesDistance(jobLocation: string, remote: boolean, originKey: string, distanceKey: DistanceKey): boolean {
  if (distanceKey === "any" || !originKey) return true
  if (remote) return true
  const origin = METRO_COORDS[originKey]
  const dest = cityKeyOf(jobLocation)
  if (!origin || !dest) return true
  const miles = DISTANCE_OPTIONS.find(d => d.key === distanceKey)!.miles
  return haversineMiles(origin, METRO_COORDS[dest]) <= miles
}

export const METRO_OPTIONS = Object.keys(METRO_COORDS).map(key => ({
  key, label: key.replace(/\b\w/g, c => c.toUpperCase()),
}))

// ── Skills ───────────────────────────────────────────────────────────────────
// Reuses the same skill vocabulary the resume↔JD matcher uses, so "Python"
// means the same thing everywhere in the app.
const SKILL_KEYS = Object.keys(SKILL_ALIASES)

/** Returns the canonical skill keys mentioned in free text (title+description). */
export function extractSkills(text: string): string[] {
  const lower = (text || "").toLowerCase()
  const found: string[] = []
  for (const key of SKILL_KEYS) {
    const variants = [key, ...(SKILL_ALIASES[key] || [])]
    if (variants.some(v => new RegExp(`(?:^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(lower))) {
      found.push(key)
    }
  }
  return found
}

/** Top skills across a job list, ranked by how many postings mention them —
 * used to populate the skill-filter chip row with what's actually relevant
 * to the current result set (not a fixed, often-irrelevant list). */
export function topSkills<T>(items: T[], getText: (item: T) => string, limit = 12): { skill: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const skill of extractSkills(getText(item))) {
      counts.set(skill, (counts.get(skill) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([skill, count]) => ({ skill, count }))
}

// ── Company facets ───────────────────────────────────────────────────────────
export function companyFacets<T>(items: T[], getCompany: (item: T) => string, limit = 30): { company: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const c = getCompany(item)?.trim()
    if (!c) continue
    counts.set(c, (counts.get(c) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([company, count]) => ({ company, count }))
}

// ── Staffing/recruiting-agency detector ───────────────────────────────────────
// Jobright/Simplify both offer a "hide staffing agencies" toggle — recruiters
// re-posting the same req under a different name. Name-pattern heuristic only
// (no dataset of agencies exists); intentionally narrow to avoid false-hits on
// real employers whose name happens to contain "resource" or "group".
const STAFFING_AGENCY_PATTERN = /\b(staffing|consulting group|technologies inc|solutions inc|infotech|infosys bpm|technosoft|systems? group|resource[s]? group|talent (acquisition|solutions)|recruiting|recruiters?|corp[\s-]?to[\s-]?corp)\b/i
export function isStaffingAgency(companyName: string): boolean {
  return STAFFING_AGENCY_PATTERN.test(companyName || "")
}
