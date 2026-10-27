// Mitchell Martin: www.mitchellmartin.com/career-portal shows 10 cards and draws the rest by script, but the jobs are
// WordPress posts of the public type "job", which the site's REST API lists openly (/wp-json/wp/v2/job). Verified
// 2026-10-21: 784 jobs, no key, nonce or cookie; robots.txt disallows only /wp-admin/ (admin-ajax allowed). Only the IT
// position types are asked for (IT Contract, IT Direct Placement, IT-Right to Hire; healthcare is left out), 100 a page.
// The posts' dates are the site's nightly sync, not the day a job was posted, so none is kept. The place is the
// description's "Location:" line (the location terms disagree with it and cost three more requests).
import type { PortalAdapter, RawJob } from "../types"
import { clean, labelled, payIn } from "../text.ts"

// The site's position-type and on-site-flexibility terms (/wp-json/wp/v2/position-type and /on-site-flexibility).
const IT_KINDS: Record<number, string> = { 349: "IT Contract", 346: "IT Direct Placement", 763: "IT-Right to Hire" }
const MODES: Record<number, string> = { 604: "Hybrid", 605: "Remote" }
const API = `https://www.mitchellmartin.com/wp-json/wp/v2/job?per_page=100&position-type=${Object.keys(IT_KINDS).join(",")}&_fields=id,link,title,content,position-type,on-site-flexibility&page=`
const PER_PAGE = 100
const MOST_PAGES = 8

type Post = { link?: string; title?: { rendered?: string }; content?: { rendered?: string }; "position-type"?: number[]; "on-site-flexibility"?: number[] }

/** One page of the API as jobs (IT position types only), and how many posts it held. */
export function readPage(raw: string): { jobs: RawJob[]; count: number } {
  const posts = JSON.parse(raw) as Post[]
  if (!Array.isArray(posts)) throw new Error("Mitchell Martin's job list did not come back")
  const jobs = posts.flatMap((p): RawJob[] => {
    const kind = (p["position-type"] || []).map(id => IT_KINDS[id]).find(Boolean)
    const title = clean(p.title?.rendered || "")
    if (!p.link || !title || !kind) return []
    const html = p.content?.rendered || ""
    const mode = (p["on-site-flexibility"] || []).map(id => MODES[id]).find(Boolean)
    const line = labelled(html, /location/)
    const place = line && mode && !line.toLowerCase().includes(mode.toLowerCase()) ? `${line} (${mode})` : line || mode
    const description = clean(html)
    return [{ title, url: p.link, location: place || undefined, engagement: kind, payRange: payIn(description), description: description.slice(0, 8000) || undefined }]
  })
  return { jobs, count: posts.length }
}

export const mitchellmartin: PortalAdapter = {
  portal: "mitchellmartin",
  firm: "Mitchell Martin",
  async fetchJobs(get) {
    const all: RawJob[] = []
    for (let page = 1; page <= MOST_PAGES; page++) {
      let raw: string
      try {
        raw = await get(`${API}${page}`, { accept: "application/json" })
      } catch (e) {
        // WordPress answers 400 for a page past the last; a full last page leads here, and that is the end.
        if (page > 1 && /HTTP 400/.test(String(e))) break
        throw e
      }
      const got = readPage(raw)
      // No title filter: the IT position type already says the job is technology work.
      all.push(...got.jobs)
      if (got.count < PER_PAGE) break
    }
    return all
  },
}
