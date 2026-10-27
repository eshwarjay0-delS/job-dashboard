// Addison Group: addisongroup.com/jobs/ is a SnapHop ("Recruiting Hop") board drawn on the server inside the firm's own
// site. Verified 2026-10-21: no login, key or captcha. robots.txt allows every path for * and carries "Crawl-delay: 10",
// which is honoured: ten seconds between requests. The technology category is asked for once per contract kind
// (CONTRACT, Contract to Hire), 30 a page, by the total on page one: 92 jobs in 4 requests. Direct hire is not read (the
// product is for contract work). Cards carry no date; the job's own page does, one request each, and is not read.
import type { PortalAdapter, RawJob } from "../types"
import { readCards, totalIn } from "./snaphop.ts"

const BASE = "https://addisongroup.com"
const LIST = `${BASE}/jobs/l/recruiting/jobsearchaction/19e62b1f-e3e6-11eb-be56-42010a8a0031/null/false?term=&sortBy=beginTime&tags=Information%20Technology&distance=1000000&measurementSystem=US&radiusSearch=false&relevancy=false`
const KINDS = ["CONTRACT", "Contract to Hire"]
const LABEL: Record<string, string> = { CONTRACT: "Contract" }
const PER_PAGE = 30
const MOST_PAGES = 4

export const addison: PortalAdapter = {
  portal: "addison",
  firm: "Addison Group",
  // robots.txt: "Crawl-delay: 10". Four requests at that pace need more than the usual minute.
  gapMs: 10_000,
  budgetMs: 90_000,
  async fetchJobs(get) {
    const all: RawJob[] = []
    for (const kind of KINDS) {
      let pages = 1
      for (let n = 1; n <= pages && n <= MOST_PAGES; n++) {
        const html = await get(`${LIST}&jobTypes=${encodeURIComponent(kind)}&page=${n}`)
        if (n === 1) pages = Math.ceil(totalIn(html) / PER_PAGE) || 1
        const cards = readCards(html, BASE, LABEL[kind] || kind)
        all.push(...cards)
        if (!cards.length) break
      }
    }
    return all
  },
}
