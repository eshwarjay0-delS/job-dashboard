// Insight Global: insightglobal.com/jobs is an Angular app reading a public JSON search on the same host (/all/jobs; the
// signed-in /my API on another host is not used). Verified 2026-10-20: no key, cookie or captcha; 50 a page at most;
// 5,229 jobs in all, so a full read is 105 requests. This reads the newest contract jobs only (filter.jobType=Contract,
// newest first), at most 20 pages, because contract work is what the product is for and the newest are the open ones.
// The board also lists healthcare and office work: jobs whose titles are not technology work are left out by title.
// robots.txt disallows only /wp-content/uploads/. The job description needs one request per job and is not read.
import type { PortalAdapter, RawJob } from "../types"
import { isTechTitle } from "../text.ts"

const API = "https://insightglobal.com/all/jobs"
const PAGE = 50
const MOST_PAGES = 20

type Hit = {
  requisitionId?: string; jobTitle?: string; postedDate?: string; workRemote?: boolean; jobType?: string; jobStatus?: string
  workAddress?: { locality?: string; administrativeArea?: string }
  payRate?: { min?: number; max?: number; type?: string }
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`
function payOf(p?: Hit["payRate"]): string | undefined {
  if (!p || (!p.min && !p.max)) return undefined
  const per = /hour/i.test(p.type || "") ? " per hour" : /annual|year/i.test(p.type || "") ? " per year" : ""
  const range = p.min && p.max && p.min !== p.max ? `${money(p.min)} - ${money(p.max)}` : money((p.max || p.min) as number)
  return `${range}${per}`
}

/** One page of the answer: its jobs and how many pages the board says it has. */
export function readPage(raw: string): { jobs: RawJob[]; pages: number } {
  const data = JSON.parse(raw) as { jobs?: Hit[]; pageMetadata?: { totalPages?: number } }
  const jobs = (data.jobs || []).flatMap((h): RawJob[] => {
    if (!h.requisitionId || !h.jobTitle || !isTechTitle(h.jobTitle) || (h.jobStatus && h.jobStatus !== "active")) return []
    const place = [h.workAddress?.locality, h.workAddress?.administrativeArea].filter(Boolean).join(", ")
    return [{
      title: h.jobTitle.trim(), url: `https://insightglobal.com/jobs/${h.requisitionId}`,
      location: place ? `${place}${h.workRemote ? " (Remote)" : ""}` : h.workRemote ? "Remote" : undefined,
      engagement: h.jobType, payRange: payOf(h.payRate), postedAt: h.postedDate,
    }]
  })
  return { jobs, pages: Number(data.pageMetadata?.totalPages) || 0 }
}

export const insightglobal: PortalAdapter = {
  portal: "insightglobal",
  firm: "Insight Global",
  async fetchJobs(get) {
    const all: RawJob[] = []
    let pages = 1
    for (let page = 1; page <= pages && page <= MOST_PAGES; page++) {
      const got = readPage(await get(`${API}?page=${page}&size=${PAGE}&sort=postedDate,desc&filter.status=active&filter.jobType=Contract`, { accept: "application/json" }))
      pages = got.pages || 1
      all.push(...got.jobs)
      if (!got.jobs.length) break
    }
    return all
  },
}
