// Motion Recruitment: motionrecruitment.com/tech-jobs is a Next.js page (job data from Bullhorn). The cards drawn on the
// page are capped at 20 whatever the "count" parameter says, but the page's own server-rendered data (React Server
// Components "flight" data, in the self.__next_f.push script tags) holds every job asked for. Verified 2026-10-20:
// /tech-jobs/contract?start=0&count=500 returns all 388 contract jobs in one request (about 1 s).
// robots.txt (Cloudflare-managed) allows /tech-jobs and the start and count parameters, and carries the content signal
// "search=yes, ai-train=no, use=reference": jobs are listed with a link back, and their descriptions are NOT kept here.
// The records also name the recruiter who owns each job (name, email, phone); only the job's own fields are read, never that.
import type { PortalAdapter, RawJob } from "../types"

const BASE = "https://motionrecruitment.com/tech-jobs/contract"
const PAGE = 500
const MOST_PAGES = 4

type Row = {
  title?: string; url?: string; dateAdded?: string; remote?: string; payMin?: number; payMax?: number; isPayHourly?: boolean
  address?: { city?: string; state?: string }
  employmentType?: { name?: string }
  categories?: { data?: { key?: string }[] }
}

/** The text the page's script tags hand to React, in one piece (each push is a JSON string literal). */
export function flightText(html: string): string {
  let out = ""
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try { out += JSON.parse(m[1]) as string } catch { /* a piece that is not text */ }
  }
  return out
}

/** The object that starts at `from` in `text`, found by counting braces (strings and their escapes are skipped). */
function objectAt(text: string, from: number): string {
  let depth = 0, inString = false, escaped = false
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue }
    if (c === '"') inString = true
    else if (c === "{") depth++
    else if (c === "}" && --depth === 0) return text.slice(from, i + 1)
  }
  return ""
}

/** One page of the board: its jobs (technology ones only) and how many the board holds. */
export function readPage(html: string): { jobs: RawJob[]; total: number; count: number } {
  const text = flightText(html)
  const at = text.indexOf('"dataSet":{')
  const set = at < 0 ? "" : objectAt(text, at + '"dataSet":'.length)
  if (!set) return { jobs: [], total: 0, count: 0 }
  const data = JSON.parse(set) as { total?: number; data?: Row[] }
  const rows = data.data || []
  const jobs = rows.flatMap((r): RawJob[] => {
    if (!r.title || !r.url || !/^https:\/\/motionrecruitment\.com\//.test(r.url)) return []
    if (!(r.categories?.data || []).some(c => c.key === "technology")) return []
    const place = [r.address?.city, r.address?.state].filter(Boolean).join(", ")
    const how = r.remote === "Remote Only" ? "Remote" : r.remote && r.remote !== "Onsite" && r.remote !== "Local Only" ? r.remote : ""
    const money = (n: number) => `$${n.toLocaleString("en-US")}`
    const pay = r.payMin || r.payMax
      ? `${r.payMin && r.payMax && r.payMin !== r.payMax ? `${money(r.payMin)} - ${money(r.payMax)}` : money((r.payMax || r.payMin) as number)}${r.isPayHourly ? " per hour" : " per year"}`
      : undefined
    return [{ title: r.title.trim(), url: r.url, location: place ? `${place}${how ? ` (${how})` : ""}` : how || undefined, engagement: r.employmentType?.name, payRange: pay, postedAt: r.dateAdded }]
  })
  return { jobs, total: Number(data.total) || 0, count: rows.length }
}

export const motion: PortalAdapter = {
  portal: "motion",
  firm: "Motion Recruitment",
  async fetchJobs(get) {
    const all: RawJob[] = []
    let total = Infinity
    for (let page = 0, start = 0; start < total && page < MOST_PAGES; page++, start += PAGE) {
      const got = readPage(await get(`${BASE}?start=${start}&count=${PAGE}`))
      all.push(...got.jobs)
      total = got.total
      if (!got.count) break
    }
    return all
  },
}
