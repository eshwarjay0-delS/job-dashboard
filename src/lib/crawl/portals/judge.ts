// The Judge Group: www.judge.com/jobs is drawn by its theme's script, which POSTs a search to the site's own
// admin-ajax.php?action=jdg_get_jobs (no nonce, cookie or key). Verified 2026-10-21: 466 IT contract jobs in the USA, 20 a
// page (the page size is fixed). robots.txt disallows /wp-admin/ but explicitly allows /wp-admin/admin-ajax.php, the only
// path used. The answer is JSON written inside a JSON string, so it is read twice. Page 0 holds a few pinned older jobs;
// the pages after it run newest to oldest, and the board keeps jobs listed for years, so the first 12 pages (about 240,
// the newest) are read. The job page has no JobPosting record; its address is /jobs/details/<id>/.
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle } from "../text.ts"

const API = "https://www.judge.com/wp-admin/admin-ajax.php?action=jdg_get_jobs"
const PER_PAGE = 20
const MOST_PAGES = 12

type Hit = { jobOrderId?: number; title?: string; description?: string; location?: string; salary?: string | null; opened?: number; type?: string }

/** The search the page itself sends: technology, contract, USA, one page. */
export const searchBody = (page: number) => JSON.stringify({
  payload: { categories: ["InformationTechnology"], countries: "USA", geo: [{ distance: "", latLong: [null, null], location: "" }], query: "", states: "", type: ["Contract"], page, remote: false },
})

/** "$45.00 USD Hourly - $50.00 USD Hourly" is "$45 - $50 per hour"; "TBD", "Negotiable" and the like are no figure. */
export function payOf(salary?: string | null): string | undefined {
  const s = clean(salary || "")
  const figures = [...s.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g)].map(m => Number(m[1].replace(/,/g, "")))
  if (!figures.length) return undefined
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
  const [lo, hi] = [Math.min(...figures), Math.max(...figures)]
  const per = /hour/i.test(s) ? " per hour" : /annual|year/i.test(s) ? " per year" : ""
  return `${lo === hi ? fmt(lo) : `${fmt(lo)} - ${fmt(hi)}`}${per}`
}

/** One page of the answer: its jobs, and how many jobs the search holds. */
export function readPage(raw: string): { jobs: RawJob[]; total: number } {
  let data: unknown = JSON.parse(raw)
  if (typeof data === "string") data = JSON.parse(data)
  const hits = (data as { hits?: Hit[] })?.hits
  if (!Array.isArray(hits)) throw new Error("The Judge Group's job search did not come back")
  const jobs = hits.flatMap((h): RawJob[] => {
    const title = clean(h.title || "")
    // The firm's own IT category also holds clinical and content roles ("Locum OM/UC APP", 22 Oct 2026): the title decides.
    if (!h.jobOrderId || !title || !isTechTitle(title)) return []
    const place = clean(h.location || "")
    return [{
      title, url: `https://www.judge.com/jobs/details/${h.jobOrderId}/`,
      location: /^remote$/i.test(place) ? "Remote" : place || undefined,
      engagement: h.type || undefined, payRange: payOf(h.salary),
      postedAt: typeof h.opened === "number" ? new Date(h.opened).toISOString().slice(0, 10) : undefined,
      description: clean(h.description || "").slice(0, 8000) || undefined,
    }]
  })
  return { jobs, total: Number((data as { total?: number }).total) || 0 }
}

export const judge: PortalAdapter = {
  portal: "judge",
  firm: "The Judge Group",
  async fetchJobs(get) {
    const all: RawJob[] = []
    let pages = 1
    for (let page = 0; page < pages && page < MOST_PAGES; page++) {
      const got = readPage(await get(API, { method: "POST", body: searchBody(page), accept: "application/json" }))
      if (page === 0) pages = Math.ceil(got.total / PER_PAGE) || 1
      all.push(...got.jobs)
      if (!got.jobs.length) break
    }
    return all
  },
}
