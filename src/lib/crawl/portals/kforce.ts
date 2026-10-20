// Kforce: its find-work page draws the list in script, and the script reads a public Azure Cognitive Search index
// (kforcewebjobentity) with a query key that every visitor's browser receives in the site's own JavaScript. Verified
// 2026-10-20: one call returns all 685 Technology jobs (512 contract), about 0.9 s, no captcha or challenge.
//
// The key is not kept in this repository: it is read from the site's script on each run (the search page names the
// script, the script names the key), the way a browser gets it. If Kforce rotates it, the next run reads the new one.
// robots.txt (www.kforce.com) disallows /admin, /svc and "apply-online" paths and asks for 30 s between requests; this
// run makes ONE request to www.kforce.com (the search page), one to its CDN (the script) and one to the search service.
// Job pages are never read one by one, and the ApplyUrl field (its "Industry" parameter carries a recruiter's email
// address) is never asked for.
import type { PortalAdapter, RawJob } from "../types"
import { absolute } from "../text.ts"

const SEARCH_PAGE = "https://www.kforce.com/find-work/search-jobs/"
const INDEX = "https://kforcewebeast.search.windows.net/indexes/kforcewebjobentity/docs/search?api-version=2016-09-01"
const SELECT = "Id, Title, PostDate, City, State, SalaryMin, SalaryMax, SalaryText, TypeCode, Remote, Responsibilities, Skills"
// 27 jobs of December 2022 are still in the index, and their pages still open; a posting that old is not an opening.
const MOST_DAYS_OLD = 120

type Hit = { Id?: string; Title?: string; PostDate?: string; City?: string; State?: string; SalaryMin?: string; SalaryMax?: string; SalaryText?: string; TypeCode?: string; Remote?: string; Responsibilities?: string; Skills?: string }

/** The query key and the script that holds it, from the pages Kforce serves. Null parts when a page changed shape. */
export function scriptOf(searchPage: string): string {
  return searchPage.match(/<script[^>]+src="([^"]*app\.min\.js[^"]*)"/i)?.[1] || ""
}
export function keyOf(script: string): string {
  return script.match(/kforcewebeast\.search\.windows\.net",key:"([0-9A-Fa-f]+)"/)?.[1] || ""
}

/** A job's page: its Id is the address, written in base64url. The short numeric Ids are Kforce's own openings. */
export function addressOf(id: string): string {
  const decoded = Buffer.from(String(id).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  return /^\d+~[A-Z0-9]+~[0-9A-Z]+~\d+$/.test(decoded) ? `https://www.kforce.com/jobs/${decoded}/` : ""
}

const money = (n: string) => `$${Number(n).toLocaleString("en-US")}`
function payOf(h: Hit): string | undefined {
  if (!h.SalaryMin && !h.SalaryMax) return undefined
  const per = h.SalaryText === "Hours" ? " per hour" : h.SalaryText === "Years" ? " per year" : ""
  const range = h.SalaryMin && h.SalaryMax && h.SalaryMin !== h.SalaryMax ? `${money(h.SalaryMin)} - ${money(h.SalaryMax)}` : money((h.SalaryMax || h.SalaryMin) as string)
  return `${range}${per}`
}

/** The search answer as jobs. `now` is when it is read: postings older than MOST_DAYS_OLD are left out. */
export function readJobs(raw: string, now = Date.now()): RawJob[] {
  const hits = ((JSON.parse(raw) as { value?: Hit[] }).value || [])
  return hits.flatMap((h): RawJob[] => {
    const url = addressOf(h.Id || "")
    if (!url || !h.Title) return []
    const posted = Date.parse(h.PostDate || "")
    if (Number.isFinite(posted) && now - posted > MOST_DAYS_OLD * 86_400_000) return []
    const place = [h.City, h.State].filter(Boolean).join(", ")
    const how = h.Remote === "Full" ? "Remote" : h.Remote === "Partial" ? "Hybrid" : ""
    return [{
      title: h.Title.trim(), url,
      location: place ? `${place}${how ? ` (${how})` : ""}` : how || undefined,
      engagement: h.TypeCode || undefined,
      payRange: payOf(h),
      postedAt: h.PostDate,
      description: [h.Responsibilities, h.Skills].map(t => String(t || "").trim()).filter(Boolean).join("\n\n") || undefined,
    }]
  })
}

export const kforce: PortalAdapter = {
  portal: "kforce",
  firm: "Kforce",
  async fetchJobs(get) {
    const script = scriptOf(await get(SEARCH_PAGE))
    if (!script) throw new Error("Kforce's search page names no script, so its search key could not be read")
    const key = keyOf(await get(absolute(script, SEARCH_PAGE), { accept: "*/*" }))
    if (!key) throw new Error("Kforce's script holds no search key where it used to")
    const body = JSON.stringify({ count: true, select: SELECT, filter: "Industry eq 'Technology'", search: "*", queryType: "simple", searchMode: "any", orderby: "PostDate desc", skip: 0, top: 1000 })
    return readJobs(await get(INDEX, { method: "POST", body, headers: { "api-key": key }, accept: "application/json" }))
  },
}
