// Kavaliro: jobs.kavaliro.com is a Haley Marketing job board (jobs fed from Bullhorn). The search page draws its list with
// a JSON call (/json/index.smpl?arg=list_posts) that needs the two hidden values the page's own search form carries (h and
// t, a ticket every visitor's page gets), so a run reads the page first and then the list: 2 requests for all 104 jobs
// (verified 2026-10-21). robots.txt has no rules, only a sitemap line. Without gzip the server cuts the answer short
// (it counts characters, not bytes); Node's fetch asks for gzip, so the answer is whole. Jobs whose titles are not
// technology work are left out (the board's own IT categories are loose).
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle, payIn } from "../text.ts"

const BASE = "https://jobs.kavaliro.com"
const SEARCH = `${BASE}/index.smpl?arg=jb_search_results&view=0`
const PER_PAGE = 200
const MOST_PAGES = 5

type Post = {
  POST_TITLE?: string; POST_SEO_URL?: string; POST_LOCATION?: string; POST_REQUIREMENTS?: string
  POST_EMPLOYMENT_TYPE?: string; POST_DATE?: string; POST_PAYRATE?: string; POST_DESCRIPTION?: string
}

/** The ticket the search page hands its own list call. Throws when the page no longer carries it. */
export function ticketIn(html: string): { h: string; t: string } {
  const h = html.match(/name="h"\s+value="([0-9a-f]+)"/)?.[1], t = html.match(/name="t"\s+value="(\d+)"/)?.[1]
  if (!h || !t) throw new Error("Kavaliro's search page no longer carries its list ticket")
  return { h, t }
}

/** One answer of the list: its jobs, and where the next page starts (-1 when there is none). */
export function readList(raw: string): { jobs: RawJob[]; next: number } {
  const set = (JSON.parse(raw) as { ResultSet?: { list?: Post[]; list_meta?: { first?: string }; ticket?: { msg?: string } } }).ResultSet
  if (!set || !Array.isArray(set.list)) throw new Error(`Kavaliro's job list did not come back${set?.ticket?.msg ? `: ${set.ticket.msg}` : ""}`)
  const jobs = set.list.flatMap((p): RawJob[] => {
    const title = clean(p.POST_TITLE || "")
    if (!p.POST_SEO_URL || !title || !isTechTitle(title)) return []
    const description = clean(p.POST_DESCRIPTION || "")
    const place = clean(p.POST_LOCATION || ""), mode = clean(p.POST_REQUIREMENTS || "")
    const rate = clean(p.POST_PAYRATE || "")
    return [{
      title, url: p.POST_SEO_URL,
      location: place ? (mode === "Remote" || mode === "Hybrid" ? `${place} (${mode})` : place) : mode === "Remote" ? "Remote" : undefined,
      engagement: clean(p.POST_EMPLOYMENT_TYPE || "") || undefined,
      // The structured rate has no unit ("28.60", "120,000"): the figure the recruiter wrote in the text comes first.
      payRange: payIn(description) || (rate ? `$${rate}` : undefined),
      postedAt: /^\d{4}-\d\d-\d\d$/.test(p.POST_DATE || "") ? p.POST_DATE : undefined,
      description: description.slice(0, 8000) || undefined,
    }]
  })
  return { jobs, next: Number(set.list_meta?.first ?? -1) }
}

export const kavaliro: PortalAdapter = {
  portal: "kavaliro",
  firm: "Kavaliro",
  async fetchJobs(get) {
    const { h, t } = ticketIn(await get(SEARCH))
    const all: RawJob[] = []
    let first = 0
    for (let page = 0; page < MOST_PAGES && first >= 0; page++) {
      const got = readList(await get(`${BASE}/json/index.smpl?arg=list_posts&pp=${PER_PAGE}&pid=gwt&h=${h}&t=${t}&first=${first}&total=&view=0&action=1`, { accept: "application/json" }))
      all.push(...got.jobs)
      first = got.next > first ? got.next : -1
    }
    return all
  },
}
