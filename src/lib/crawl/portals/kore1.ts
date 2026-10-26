// KORE1: talent.kore1.com/careers is the firm's own job board; its script reads the board's own public JSON
// (/api/job-board.php?action=jobs), which this reads too. Verified 2026-10-21: 100 jobs in ONE request, no key, cookie or
// login (the board's apply call is never used). There is no robots.txt (404), so nothing is disallowed. Each job gives
// title, place, kind (contract, contract to hire, full time), pay range with its unit, and the day it was published; the
// description is one request per job and is not read. Most of the board is engineering, finance and healthcare work, so
// jobs whose titles are not technology work are left out.
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle } from "../text.ts"

const API = "https://talent.kore1.com/api/job-board.php?action=jobs&limit=100&offset="
const MOST_PAGES = 5

type Hit = {
  posted_title?: string; posted_location?: string; slug?: string; published_at?: string
  compensation_min?: string; compensation_max?: string; compensation_type?: string
  employment_type?: string; remote_policy?: string | null
}

const KINDS: Record<string, string> = { contract: "Contract", c2h: "Contract to Hire", full_time: "Full-time", part_time: "Part-time" }

/** "70.00" and "85.00" hourly is "$70 - $85 per hour"; one figure twice is one figure. */
function payOf(h: Hit): string | undefined {
  const lo = Number(h.compensation_min) || 0, hi = Number(h.compensation_max) || 0
  if (!lo && !hi) return undefined
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
  const range = lo && hi && lo !== hi ? `${fmt(lo)} - ${fmt(hi)}` : fmt(hi || lo)
  return `${range}${h.compensation_type === "hourly" ? " per hour" : h.compensation_type === "annual" ? " per year" : ""}`
}

/** "Irvine, CA" and remote_policy "remote" is "Irvine, CA (Remote)"; an empty place with a remote policy is "Remote". */
function placeOf(h: Hit): string | undefined {
  const place = clean(h.posted_location || "")
  const mode = h.remote_policy === "remote" ? "Remote" : h.remote_policy === "hybrid" ? "Hybrid" : ""
  if (!place) return mode || undefined
  return mode && !new RegExp(mode, "i").test(place) ? `${place} (${mode})` : place
}

/** One answer of the board: its jobs, and whether it has more. */
export function readPage(raw: string): { jobs: RawJob[]; more: boolean; count: number } {
  const data = JSON.parse(raw) as { jobs?: Hit[]; has_more?: boolean }
  if (!Array.isArray(data.jobs)) throw new Error("KORE1's job board did not come back")
  const jobs = data.jobs.flatMap((h): RawJob[] => {
    const title = clean(h.posted_title || "").replace(/\.$/, "")
    if (!h.slug || !title || !isTechTitle(title)) return []
    return [{
      title, url: `https://talent.kore1.com/careers/${encodeURIComponent(h.slug)}`, location: placeOf(h),
      engagement: KINDS[h.employment_type || ""] || h.employment_type || undefined, payRange: payOf(h),
      postedAt: /^\d{4}-\d\d-\d\d/.test(h.published_at || "") ? (h.published_at as string).slice(0, 10) : undefined,
    }]
  })
  return { jobs, more: data.has_more === true && data.jobs.length > 0, count: data.jobs.length }
}

export const kore1: PortalAdapter = {
  portal: "kore1",
  firm: "KORE1",
  async fetchJobs(get) {
    const all: RawJob[] = []
    let offset = 0
    for (let page = 0; page < MOST_PAGES; page++) {
      const got = readPage(await get(`${API}${offset}`, { accept: "application/json" }))
      all.push(...got.jobs)
      if (!got.more) break
      offset += got.count
    }
    return all
  },
}
