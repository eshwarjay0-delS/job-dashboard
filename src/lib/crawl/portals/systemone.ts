// System One: jobs.systemone.com is a SnapHop portal drawn on the server (the marketing site, www.systemone.com, holds no
// jobs). Verified 2026-10-20: no login, key or captcha; robots.txt on the jobs host disallows only /admin, /testing and
// /switchmode (the marketing host asks for a 10 s gap; the jobs host, the one used, states none). The technology category
// is asked for, once per contract kind (Contract, Contract To Hire), 30 a page: 221 jobs in 8 requests. Direct hire jobs
// are not read (the product is for contract work). The cards have a snippet only; the full description is on the job's
// own page and is not read. The search pages are marked noindex for search engines, which is a hint for them and not a
// robots.txt rule; the lists are read the way the page itself reads them.
import type { PortalAdapter, RawJob } from "../types"
import { readCards, totalIn } from "./snaphop.ts"

const BASE = "https://jobs.systemone.com"
const LIST = `${BASE}/l/recruiting/jobsearchaction/b440eda6-9cc2-11e4-a7c5-bc764e10782d/c05e6108-1930-11ef-8b1c-42010a8a0fd9/false?term=&sortBy=beginTime&tags=Information%20Technology&distance=1000000&measurementSystem=US&radiusSearch=false&relevancy=false`
const KINDS = ["CONTRACT", "Contract To Hire"]
const LABEL: Record<string, string> = { CONTRACT: "Contract" }
const PER_PAGE = 30
const MOST_PAGES = 8

export const systemone: PortalAdapter = {
  portal: "systemone",
  firm: "System One",
  // Eight requests; two seconds apart is a fair pace for a site that states no delay.
  gapMs: 2000,
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
