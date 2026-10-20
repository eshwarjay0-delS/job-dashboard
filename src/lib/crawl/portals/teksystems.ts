// TEKsystems: careers.teksystems.com runs Phenom, whose search page reads one public JSON endpoint (/widgets, named in the
// page's own config: widgetApiEndpoint). No key, cookie or token is needed. Verified 2026-10-20: 2,679 jobs on the board,
// 1,054 in the ten IT categories below, 100 a page, so 11 requests read every IT job. robots.txt (careers.teksystems.com)
// blocks only Phenom's marketing and chat paths; /widgets and /us/en/job are open.
//
// Until 20 Oct 2026 this portal was skipped as "only ~4 jobs posted": that was the search page's embedded preload, which
// shows ten jobs near the caller. The widget returns the whole board. Results come sorted by distance from the caller's
// address, not by date, so every page is read.
import type { PortalAdapter, RawJob } from "../types"

const ENDPOINT = "https://careers.teksystems.com/widgets"
const PAGE = 100
const IT_CATEGORIES = ["Architect", "Business/Systems Analyst", "Database Administrator", "Developer", "Helpdesk/Desktop", "Network Engineer",
  "Project Manager", "Security Analyst/Engineer", "Systems Administrator/Engineer", "Tester"]
// 1,054 IT jobs today; a hard stop in case the board grows or the count is wrong.
const MOST_PAGES = 15

const body = (from: number) => JSON.stringify({
  lang: "en_us", deviceType: "desktop", country: "us", pageName: "search-results", ddoKey: "refineSearch", sortBy: "", subsearch: "", from,
  jobs: true, counts: true, all_fields: ["category", "country", "state", "city", "type", "remoteOnsite"], size: PAGE, clearAll: false,
  jdsource: "facets", isSliderEnable: false, pageId: "page10", siteType: "external", keywords: "", global: true,
  selected_fields: { category: IT_CATEGORIES }, locationData: {}, refNum: "TESYUS",
})

type Hit = {
  title?: string; jobSeqNo?: string; location?: string; type?: string; postedDate?: string; descriptionTeaser?: string
  ml_job_parser?: { descriptionTeaser_first200?: string }
}

const slug = (title: string) => title.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

/** One page's jobs. The address a person opens is built from the sequence number and the title, as the site builds it. */
export function readPage(raw: string): { jobs: RawJob[]; total: number } {
  const found = (JSON.parse(raw) as { refineSearch?: { totalHits?: number; data?: { jobs?: Hit[] } } }).refineSearch
  const hits = found?.data?.jobs || []
  const jobs = hits.flatMap((h): RawJob[] => {
    if (!h.title || !h.jobSeqNo) return []
    const opening = h.ml_job_parser?.descriptionTeaser_first200?.trim(), teaser = h.descriptionTeaser?.trim()
    return [{
      title: h.title,
      url: `https://careers.teksystems.com/us/en/job/${h.jobSeqNo}/${slug(h.title)}`,
      location: h.location || undefined,
      engagement: h.type || undefined,
      postedAt: h.postedDate,
      // The site's own summary of the job: short, and what a person sees in its list.
      description: [...new Set([opening, teaser].filter(Boolean))].join("\n") || undefined,
    }]
  })
  return { jobs, total: Number(found?.totalHits) || 0 }
}

export const teksystems: PortalAdapter = {
  portal: "teksystems",
  firm: "TEKsystems",
  async fetchJobs(get) {
    const all: RawJob[] = []
    let total = Infinity
    for (let page = 0, from = 0; from < total && page < MOST_PAGES; page++, from += PAGE) {
      const got = readPage(await get(ENDPOINT, { method: "POST", body: body(from), accept: "application/json" }))
      all.push(...got.jobs)
      total = got.total
      if (!got.jobs.length) break
    }
    return all
  },
}
