// RETIRED FROM THE ACTIVE REGISTRY 2026-11-09.
// The former /searchjobs/api/jobs JSON proxy returned HTTP 404 in the 2026-11-09 production crawl.
// The current official /careers page is interactive; no public static feed has been verified.
// Keep this parser only for historical fixture coverage. Do not re-register until a compliant feed is live.
// See docs/research/contract-crawler-freshness-2026-11-09.md.
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle } from "../text.ts"

const API = "https://www.eteaminc.com/searchjobs/api/jobs?instance=US&limit=200&page="
const MOST_PAGES = 5

type Hit = {
  jobid?: string; title?: string; location?: string; description?: string; jobtype?: string; postdate?: string
  payratemin?: string; payratemax?: string; payrateper?: string
}

const amount = (v?: string): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** "0" means "not given". Hour, Day and Year become the unit a person reads. */
function payOf(h: Hit): string | undefined {
  const lo = amount(h.payratemin), hi = amount(h.payratemax)
  if (!lo && !hi) return undefined
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
  const range = lo && hi && lo !== hi ? `${fmt(lo)} - ${fmt(hi)}` : fmt(hi || lo)
  const per = String(h.payrateper || "").toLowerCase()
  return `${range}${per === "hour" ? " per hour" : per === "day" ? " per day" : per === "year" ? " per year" : ""}`
}

/** One page of the answer: its jobs, and whether the board says there are more. */
export function readPage(raw: string): { jobs: RawJob[]; more: boolean } {
  const data = JSON.parse(raw) as { jobs?: Hit[]; hasMore?: boolean }
  if (!Array.isArray(data.jobs)) throw new Error("eTeam's job list did not come back")
  const jobs = data.jobs.flatMap((h): RawJob[] => {
    const title = clean(h.title || "")
    if (!h.jobid || !title || !isTechTitle(title)) return []
    return [{
      title, url: `https://www.eteaminc.com/searchjobs/${h.jobid}`,
      location: clean(h.location || "") || undefined, engagement: h.jobtype || undefined, payRange: payOf(h),
      postedAt: /^\d{4}-\d\d-\d\d/.test(h.postdate || "") ? (h.postdate as string).slice(0, 10) : undefined,
      description: clean(h.description || "") || undefined,
    }]
  })
  return { jobs, more: data.hasMore === true && data.jobs.length > 0 }
}

export const eteam: PortalAdapter = {
  portal: "eteam",
  firm: "eTeam",
  async fetchJobs(get) {
    const all: RawJob[] = []
    for (let page = 1; page <= MOST_PAGES; page++) {
      const got = readPage(await get(`${API}${page}`, { accept: "application/json" }))
      all.push(...got.jobs)
      if (!got.more) break
    }
    return all
  },
}
