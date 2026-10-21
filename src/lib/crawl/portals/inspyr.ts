// INSPYR Solutions: www.inspyrsolutions.com is WordPress with the WP Job Manager plugin; its job search page loads the jobs
// through a script, but the plugin also publishes them as the site's open REST feed (wp/v2/job-listings), the feed the
// search page's own jobs come from. Verified 2026-10-20: 488 jobs in 5 plain GETs of 100, no key, nonce or cookie.
// robots.txt disallows only /wp-admin/admin-ajax.php and one PHP file; neither is used. Pay is not a field (the salary
// fields are empty on every job): it is written in the description, so it is read from there. The portal lists every kind
// of work (payroll, accounting, construction management), so jobs whose titles are not technology work are left out.
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle, payIn } from "../text.ts"

const FEED = "https://www.inspyrsolutions.com/wp-json/wp/v2/job-listings?per_page=100&_fields=id,date,link,title,content,meta._job_location,meta._filled,job-types,class_list&page="
const PER_PAGE = 100
const MOST_PAGES = 8

type Hit = {
  date?: string; link?: string
  title?: { rendered?: string }; content?: { rendered?: string }
  meta?: { _job_location?: string; _filled?: number | string }
  class_list?: string[]
}

const KINDS: Record<string, string> = {
  contract: "Contract", "contract-to-hire": "Contract to Hire", "direct-hire": "Direct Hire", "direct-placement": "Direct Placement",
  "right-to-hire": "Right to Hire", "full-time-contract": "Full Time/Contract", "full-time": "Full Time", "part-time": "Part Time", temporary: "Temporary",
}

/** "job-type-right-to-hire" in the post's classes is "Right to Hire". */
function engagementOf(classes?: string[]): string | undefined {
  const slug = (classes || []).find(c => c.startsWith("job-type-"))?.slice("job-type-".length)
  return slug ? KINDS[slug] || slug.replace(/-/g, " ") : undefined
}

/** One page of the feed as jobs, and how many entries it held (a page of fewer than 100 is the last). */
export function readPage(raw: string): { jobs: RawJob[]; count: number } {
  const hits = JSON.parse(raw) as Hit[]
  if (!Array.isArray(hits)) throw new Error("INSPYR's job feed did not come back as a list")
  const jobs = hits.flatMap((h): RawJob[] => {
    const title = clean(h.title?.rendered || "")
    if (!h.link || !title || !isTechTitle(title) || Number(h.meta?._filled)) return []
    const description = clean(h.content?.rendered || "")
    return [{
      title, url: h.link, location: h.meta?._job_location?.trim() || undefined, engagement: engagementOf(h.class_list),
      payRange: payIn(description), postedAt: h.date?.slice(0, 10), description: description.slice(0, 8000) || undefined,
    }]
  })
  return { jobs, count: hits.length }
}

export const inspyr: PortalAdapter = {
  portal: "inspyr",
  firm: "INSPYR Solutions",
  async fetchJobs(get) {
    const all: RawJob[] = []
    for (let page = 1; page <= MOST_PAGES; page++) {
      const got = readPage(await get(`${FEED}${page}`, { accept: "application/json" }))
      all.push(...got.jobs)
      if (got.count < PER_PAGE) break
    }
    return all
  },
}
