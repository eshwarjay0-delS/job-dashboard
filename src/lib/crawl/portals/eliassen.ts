// Eliassen Group: careers.eliassen.com is a SnapHop portal drawn on the server. Verified 2026-10-20: 276 jobs, no login,
// key or captcha. robots.txt disallows only /admin, /testing and /switchmode. The list is read once per kind of job
// (Contract, Contract To Hire, Consulting, Permanent), 30 a page, which is 11 requests and gives each job its kind; the
// unfiltered list gives no kind. The order inside a page is not stable between requests, so a run can miss a job or two:
// the next run sees them, and a job is retired only after 14 days unseen. The cards have a snippet only; the full
// description is on the job's own page, one request each, and is not read. Jobs whose titles are not technology work
// are left out.
import type { PortalAdapter, RawJob } from "../types"
import { isTechTitle } from "../text.ts"
import { readCards } from "./snaphop.ts"

const BASE = "https://careers.eliassen.com"
const KINDS = ["CONTRACT", "Contract To Hire", "Consulting", "PERMANENT"]
const LABEL: Record<string, string> = { CONTRACT: "Contract", PERMANENT: "Permanent" }
const PER_PAGE = 30
const MOST_PAGES = 10

const firstPage = (kind: string) => `${BASE}/all-jobs?type=${encodeURIComponent(kind)}`
const laterPage = (kind: string, n: number) =>
  `${BASE}/l/recruiting/alljobs/4cc0e44e-4839-11ef-989c-42010a8a0fd9/null/false?geo=null&tag=null&type=${encodeURIComponent(kind)}&division=null&company=null&industry=null&pageId=null&page=${n}`

export const eliassen: PortalAdapter = {
  portal: "eliassen",
  firm: "Eliassen Group",
  async fetchJobs(get) {
    const all: RawJob[] = []
    for (const kind of KINDS) {
      for (let n = 1; n <= MOST_PAGES; n++) {
        const html = await get(n === 1 ? firstPage(kind) : laterPage(kind, n))
        const cards = readCards(html, BASE, LABEL[kind] || kind)
        all.push(...cards.filter(j => isTechTitle(j.title)))
        // A page short of 30 is the last (the cards counted before the technology filter).
        if (cards.length < PER_PAGE) break
      }
    }
    return all
  },
}
