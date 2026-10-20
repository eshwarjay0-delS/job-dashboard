// Everforth (Apex Systems): www.apexsystems.com/search-results-usa is a Drupal page whose job table is rendered on the
// server. Verified 2026-10-20: ONE request with rows=3000 returns all 2,332 US jobs, newest first, about 4 s. (The site
// itself is not "a JavaScript shell that needs a headless browser", as this file's neighbours said until 20 Oct 2026.)
// The pager does not work for a client that keeps no session: every page 2 request answers "No jobs found.", and an
// empty parameter brings the error page, so neither is used. robots.txt disallows /search/ (not /search-results-usa),
// /admin/, /core/, /profiles/ and a few more; the page used is not among them. sitemap.xml is stale (404 job pages).
// The table gives title, city, state and date only; with no category on it, jobs whose titles are not technology
// work (nurses, schedulers, drivers) are left out by title.
import type { PortalAdapter, RawJob } from "../types"
import { absolute, clean, isTechTitle, splitCards } from "../text.ts"

const LIST = "https://www.apexsystems.com/search-results-usa?catalogcode=USA&page=1&rows=3000"

/** "10/20/2026" as 2026-10-20 (a date the site writes without zero padding). */
function isoDate(s: string): string | undefined {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : undefined
}

/** The page's table as jobs. Throws on the site's own error pages, which answer 200. */
export function readPage(html: string): RawJob[] {
  if (/Sorry, we're having trouble with your request|No jobs found\./i.test(html)) throw new Error("Everforth's job table did not come back")
  return splitCards(html, /<tr class="(?:odd|even)">/).flatMap((row): RawJob[] => {
    const cells = [...row.matchAll(/<a href="(\/job\/\d+_[^"]+)" class="job-td-link[^"]*">([\s\S]*?)<\/a>/g)]
    if (cells.length < 4) return []
    const title = clean(cells[0][2])
    if (!title || !isTechTitle(title)) return []
    const place = [clean(cells[1][2]), clean(cells[2][2])].filter(Boolean).join(", ")
    return [{ title, url: absolute(cells[0][1], LIST), location: place || undefined, postedAt: isoDate(clean(cells[3][2])) }]
  })
}

export const everforth: PortalAdapter = {
  portal: "everforth",
  firm: "Everforth (Apex Systems)",
  async fetchJobs(get) {
    return readPage(await get(LIST))
  },
}
