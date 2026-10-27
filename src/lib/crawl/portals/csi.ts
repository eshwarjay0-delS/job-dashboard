// CSI Companies: jobs.csicompanies.com is Bullhorn's "Career Portal" page, which reads Bullhorn's public job search
// (public-rest<swimlane>.bullhornstaffing.com/rest-services/<corpToken>/search/JobOrder). The swimlane and corpToken are
// read each run from the page's own public config (/app.json), never kept in this code. Verified 2026-10-21: 29 open
// jobs, all contract or contract-to-hire, in one search (2 requests with the config). robots.txt: none on the portal
// host (it answers the page itself) and a 404 on Bullhorn's host, so no rules. Salary is 0 on every job, so pay is read
// from the description. The firm is mostly healthcare IT; jobs whose titles are not technology work are left out.
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle, payIn } from "../text.ts"

const CONFIG = "https://jobs.csicompanies.com/app.json"
const FIELDS = "id,title,publishedCategory(id,name),address(city,state,countryName),employmentType,dateLastPublished,publicDescription,isOpen,isPublic,isDeleted,publishedZip,salary,salaryUnit,customText2"
const COUNT = 200
const MOST_PAGES = 5

type Config = { service?: { corpToken?: string; swimlane?: string | number } }
type Job = { id?: number; title?: string; address?: { city?: string; state?: string }; employmentType?: string; dateLastPublished?: number; publicDescription?: string; customText2?: string }

/** The search address from the portal's public config. Throws when the config no longer names it. */
export function searchFrom(raw: string): string {
  const s = (JSON.parse(raw) as Config).service || {}
  const token = String(s.corpToken || ""), lane = String(s.swimlane ?? "")
  if (!/^[A-Za-z0-9]+$/.test(token) || !/^\d+$/.test(lane)) throw new Error("CSI's portal config no longer names its job search")
  return `https://public-rest${lane}.bullhornstaffing.com/rest-services/${token}/search/JobOrder`
}

/** The portal's own address for a job: /jobs/<id>/<title with only letters, digits and dashes>. */
const jobUrl = (id: number, title: string) => `https://jobs.csicompanies.com/jobs/${id}/${title.trim().replace(/[^a-z0-9\s]/gi, "").replace(/[_\s]+/g, "-")}`

/** One answer of the search: its jobs, and how many it holds. */
export function readPage(raw: string): { jobs: RawJob[]; total: number; count: number } {
  const data = JSON.parse(raw) as { total?: number; data?: Job[] }
  if (!Array.isArray(data.data)) throw new Error("CSI's job search did not come back")
  const jobs = data.data.flatMap((j): RawJob[] => {
    const title = clean(j.title || "")
    if (!j.id || !title || !isTechTitle(title)) return []
    const description = clean(j.publicDescription || "")
    const place = [clean(j.address?.city || ""), clean(j.address?.state || "")].filter(Boolean).join(", ")
    const mode = clean(j.customText2 || "")
    return [{
      title, url: jobUrl(j.id, title),
      location: place ? (/remote|hybrid/i.test(mode) ? `${place} (${mode})` : place) : /remote/i.test(mode) ? "Remote" : undefined,
      engagement: j.employmentType || undefined, payRange: payIn(description),
      postedAt: typeof j.dateLastPublished === "number" ? new Date(j.dateLastPublished).toISOString().slice(0, 10) : undefined,
      description: description.slice(0, 8000) || undefined,
    }]
  })
  return { jobs, total: Number(data.total) || 0, count: data.data.length }
}

export const csi: PortalAdapter = {
  portal: "csi",
  firm: "CSI Companies",
  async fetchJobs(get) {
    const search = searchFrom(await get(CONFIG, { accept: "application/json" }))
    const all: RawJob[] = []
    let start = 0, total = Infinity
    for (let page = 0; page < MOST_PAGES && start < total; page++) {
      const q = new URLSearchParams({ query: "(isOpen:1) AND (isDeleted:0)", fields: FIELDS, count: String(COUNT), start: String(start), sort: "-dateLastPublished", showTotalMatched: "true" })
      const got = readPage(await get(`${search}?${q}`, { accept: "application/json" }))
      total = got.total
      start += got.count
      all.push(...got.jobs)
      if (!got.count) break
    }
    return all
  },
}
