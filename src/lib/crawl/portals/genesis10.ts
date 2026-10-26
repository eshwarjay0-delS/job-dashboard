// Genesis10: www.genesis10.com/consultant-careers is a HubSpot page whose job list is filled in the visitor's browser
// from the firm's public JobDiva job feed (getportaljobs.jsp, open to cross-site reads by design). Verified 2026-10-21:
// 646 jobs in ONE request, no login or cookie. The feed's address carries the firm's JobDiva portal id, which is read
// from the careers page each run (never kept in this code), so a run is 2 requests. robots.txt on both hosts allows both
// paths (www2.jobdiva.com has no rules at all). The feed is about 5 MB of XML; it is read with plain text matching.
// Jobs whose titles are not technology work (chefs, clerks, assistants) are left out.
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle, payIn } from "../text.ts"

const CAREERS = "https://www.genesis10.com/consultant-careers"
const KINDS: Record<string, string> = { "1": "Direct Placement", "2": "Contract", "3": "Right To Hire" }
const MODES: Record<string, string> = { "50": "Hybrid", "100": "Remote" }

/** The feed's address as the careers page names it. Throws when the page no longer names it. */
export function feedIn(html: string): string {
  const id = html.match(/getportaljobs\.jsp\?a=([a-z0-9]+)/)?.[1]
  if (!id) throw new Error("Genesis10's careers page no longer names its job feed")
  return `https://www2.jobdiva.com/candidates/myjobs/getportaljobs.jsp?a=${id}&noofjobs=10000`
}

/** What a tag of one job holds, with its CDATA wrapper taken off. */
function tag(job: string, name: string): string {
  const m = job.match(new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${name}>`))
  return m ? (m[1] ?? m[2] ?? "") : ""
}

/** "MN - Eagan" is "Eagan, MN"; anything else is kept as it is written. */
const placeOf = (raw: string) => {
  const m = raw.match(/^([A-Z]{2})\s*-\s*(.+)$/)
  return m ? `${m[2].trim()}, ${m[1]}` : raw
}

/** The feed's jobs. Throws when the answer is not the feed. */
export function readFeed(xml: string): RawJob[] {
  if (!/<outertag>|<jobs>/.test(xml)) throw new Error("Genesis10's job feed did not come back")
  return xml.split(/<job>/).slice(1).flatMap((job): RawJob[] => {
    const title = clean(tag(job, "title"))
    const url = clean(tag(job, "portal_url"))
    if (!title || !/^https:\/\//.test(url) || !isTechTitle(title)) return []
    const place = placeOf(clean(tag(job, "location"))), mode = MODES[clean(tag(job, "onsiteflexibility"))]
    const description = clean(tag(job, "jobdescription"))
    const lo = Number(tag(job, "ratemin")) || 0, hi = Number(tag(job, "ratemax")) || 0, per = clean(tag(job, "rateper"))
    const issued = clean(tag(job, "issuedate"))
    return [{
      title, url,
      location: place ? (mode && !new RegExp(mode, "i").test(place) ? `${place} (${mode})` : place) : mode,
      engagement: KINDS[clean(tag(job, "positiontype"))],
      payRange: lo || hi ? `$${lo && hi && lo !== hi ? `${lo} - $${hi}` : hi || lo}${per ? ` per ${per.toLowerCase()}` : ""}` : payIn(description),
      postedAt: /^\d{4}-\d\d-\d\d/.test(issued) ? issued.slice(0, 10) : undefined,
      description: description.slice(0, 8000) || undefined,
    }]
  })
}

export const genesis10: PortalAdapter = {
  portal: "genesis10",
  firm: "Genesis10",
  async fetchJobs(get) {
    const feed = feedIn(await get(CAREERS))
    return readFeed(await get(feed, { accept: "application/xml" }))
  },
}
