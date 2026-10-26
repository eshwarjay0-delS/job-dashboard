// Pyramid Consulting: its job board is on Sprockets (jobs.sprockets.ai/en-US/pyramidinc/jobs, a Next.js page). The page
// reads Sprockets' public GraphQL API; this sends the page's own query (GetJobsForBoard), 100 jobs a request, with the
// fixed "Sprockets-App: job-board-app" header the page's script sends (a constant, not a key). Verified 2026-10-21: 978
// jobs in 10 requests, no cookie, login or key. robots.txt: the API host has no rules, the board host has no robots.txt.
// (The address the firm's site still names, pyramidci.jobs.net, no longer resolves.) The employment type is "full_time"
// on every job, so the kind is read from the description's first sentence ("This is a 06+months contract opportunity").
// Jobs whose titles are not technology work are left out.
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle, payIn } from "../text.ts"

const API = "https://production-api.sprockets.ai/graphql"
const PER_PAGE = 100
const MOST_PAGES = 12
const QUERY = "query GetJobsForBoard($identifier:String!$page:Int$itemsPer:Int$search:String$latitude:Float$longitude:Float$zipCode:String$city:String$state:String$employmentTypes:[String!]$workplaceTypes:[WorkplaceTypeEnum!]$tagGroups:[[ID!]!]$locationIds:[ID!]$sortBy:JobBoardSortEnum){jobBoardPostingPaginated(identifier:$identifier page:$page itemsPer:$itemsPer search:$search latitude:$latitude longitude:$longitude zipCode:$zipCode city:$city state:$state employmentTypes:$employmentTypes workplaceTypes:$workplaceTypes tagGroups:$tagGroups locationIds:$locationIds sortBy:$sortBy){totalCount nodes{id priority jobDescription accountSubtitle wageMin wageMax employmentType workplaceType wageInterval postedAt group{id name location{id name address{id city fullAddress state latitude longitude}account{companyName brand{name}wageRangeToSurveyApp showJobPostingDateInJobBoard}}}}}}"

type Node = {
  id?: string; jobDescription?: string; wageMin?: string; wageMax?: string; wageInterval?: string; postedAt?: string
  workplaceType?: string | null; group?: { name?: string; location?: { name?: string } }
}

/** The body the board page itself posts for one page. */
export const pageBody = (page: number) => JSON.stringify({ operationName: "GetJobsForBoard", query: QUERY, variables: { identifier: "pyramidinc", page, itemsPer: PER_PAGE, search: "" } })

/** "This is a 06+months contract opportunity" is Contract; "Fulltime opportunity" or "Permanent" is Full Time. */
export function kindOf(description: string): string | undefined {
  const head = description.slice(0, 400)
  if (/contract[- ]to[- ]hire|\bc2h\b|right[- ]to[- ]hire/i.test(head)) return "Contract to Hire"
  if (/\bcontract\b/i.test(head)) return "Contract"
  if (/\bfull[- ]?time\b|\bpermanent\b|\bdirect hire\b/i.test(head)) return "Full Time"
  return undefined
}

const PER: Record<string, string> = { hourly: " per hour", annually: " per year", weekly: " per week", daily: " per day" }

/** One answer of the API: its jobs, and how many the board holds. */
export function readPage(raw: string): { jobs: RawJob[]; total: number; count: number } {
  const data = (JSON.parse(raw) as { data?: { jobBoardPostingPaginated?: { totalCount?: number; nodes?: Node[] } } }).data?.jobBoardPostingPaginated
  if (!data || !Array.isArray(data.nodes)) throw new Error("Pyramid's job board did not come back")
  const jobs = data.nodes.flatMap((n): RawJob[] => {
    const title = clean(n.group?.name || "")
    if (!n.id || !title || !isTechTitle(title)) return []
    const description = clean(n.jobDescription || "")
    const lo = Number(n.wageMin) || 0, hi = Number(n.wageMax) || 0
    const fmt = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    const pay = lo || hi ? `${lo && hi && lo !== hi ? `${fmt(lo)} - ${fmt(hi)}` : fmt(hi || lo)}${PER[n.wageInterval || ""] || ""}` : payIn(description)
    const place = clean(n.group?.location?.name || "")
    const remote = n.workplaceType === "remote" || /\(remote\)|\bfully remote\b|\b100% remote\b/i.test(description.slice(0, 400))
    return [{
      title, url: `https://jobs.sprockets.ai/en-US/pyramidinc/jobs/${n.id}`,
      location: place ? `${place}${remote ? " (Remote)" : ""}` : remote ? "Remote" : undefined,
      engagement: kindOf(description), payRange: pay,
      postedAt: /^\d{4}-\d\d-\d\d/.test(n.postedAt || "") ? (n.postedAt as string).slice(0, 10) : undefined,
      description: description.slice(0, 8000) || undefined,
    }]
  })
  return { jobs, total: Number(data.totalCount) || 0, count: data.nodes.length }
}

export const pyramid: PortalAdapter = {
  portal: "pyramid",
  firm: "Pyramid Consulting",
  async fetchJobs(get) {
    const all: RawJob[] = []
    let seen = 0, total = Infinity
    for (let page = 1; page <= MOST_PAGES && seen < total; page++) {
      const got = readPage(await get(API, { method: "POST", body: pageBody(page), accept: "application/json", headers: { "Sprockets-App": "job-board-app" } }))
      total = got.total
      seen += got.count
      all.push(...got.jobs)
      if (!got.count) break
    }
    return all
  },
}
