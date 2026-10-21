// Brooksource: jobs.brooksource.com/jobs/ is WordPress with WP Job Manager, which publishes every open job as an RSS
// feed the site itself advertises (?feed=job_feed). Verified 2026-10-20: ONE request with posts_per_page=200 returned all
// 157 jobs (about 1 MB), no key or cookie. There is no robots.txt with rules (the root redirects to the jobs page; the
// /jobs/ one is a 404), so nothing is disallowed. The feed's dates are the hourly sync time, not the day a job was
// posted, so none is kept. The feed has no category; construction and mechanical roles are left out by title.
import type { PortalAdapter, RawJob } from "../types"
import { clean, isTechTitle, payIn } from "../text.ts"

const FEED = "https://jobs.brooksource.com/jobs/?feed=job_feed&posts_per_page=200"

/** What an element holds, with its CDATA wrapper taken off. */
function tag(item: string, name: string): string {
  const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1") : ""
}

/** The feed's items as jobs. Throws when the answer is not a feed. */
export function readFeed(xml: string): RawJob[] {
  if (!/<rss[\s>]/.test(xml)) throw new Error("Brooksource's job feed did not come back")
  return xml.split("<item>").slice(1).flatMap((item): RawJob[] => {
    const title = clean(tag(item, "title"))
    const url = clean(tag(item, "link"))
    if (!title || !url || !isTechTitle(title)) return []
    const description = clean(tag(item, "content:encoded") || tag(item, "description"))
    return [{
      title, url,
      location: clean(tag(item, "job_listing:location")) || undefined,
      engagement: clean(tag(item, "job_listing:job_type")) || undefined,
      payRange: payIn(description),
      description: description.slice(0, 8000) || undefined,
    }]
  })
}

export const brooksource: PortalAdapter = {
  portal: "brooksource",
  firm: "Brooksource",
  async fetchJobs(get) {
    return readFeed(await get(FEED, { accept: "application/rss+xml" }))
  },
}
