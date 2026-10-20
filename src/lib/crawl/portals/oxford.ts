// Oxford Global Resources, US board: www.oxfordcorp.com is WordPress with a server-rendered listing. Verified 2026-10-20:
// /all-jobs/?include_remote=1&pagenum=N, 12 cards a page, 130 jobs (11 requests), no cookie, key or POST. robots.txt
// disallows only /wp-admin/, /wp-json/, /xmlrpc.php and "?s=" searches; none of those is used. The card has no pay and no
// contract field; the industry label on it ("Tech. & Communication") is how IT jobs are told from the rest, because the
// site's own industry filter returns nothing. The job pages are not read one by one.
import type { PortalAdapter, RawJob } from "../types"
import { clean, splitCards } from "../text.ts"

const LIST = "https://www.oxfordcorp.com/all-jobs/?keyword=&location=&industry=&include_remote=1&pagenum="
const PER_PAGE = 12
const MOST_PAGES = 15
const IT_INDUSTRY = /tech/i

const field = (card: string, cls: string): string => clean(card.match(new RegExp(`class="${cls}[^"]*"[^>]*>([\\s\\S]*?)</(?:p|h2|span|div)>`))?.[1] || "")

/** "Posted - Oct 19th, 2026 | Cleveland, OH - Remote": the date, and the place with Remote moved into brackets. */
function dateAndPlace(line: string): { posted?: string; place?: string } {
  const [left, ...rest] = line.split("|").map(s => s.trim())
  const posted = left?.replace(/^posted\s*-?\s*/i, "").replace(/(\d+)(?:st|nd|rd|th)/, "$1").trim()
  const place = rest.join(" | ").trim()
  const remote = /\s-\s*remote$/i.test(place)
  const base = place.replace(/\s-\s*remote$/i, "").trim()
  return { posted: posted || undefined, place: base ? `${base}${remote ? " (Remote)" : ""}` : remote ? "Remote" : undefined }
}

/** One page: its technology jobs, and how many jobs the board says it holds. */
export function readPage(html: string): { jobs: RawJob[]; total: number } {
  const total = Number(html.match(/<strong>(\d+)<\/strong>\s*results/)?.[1]) || 0
  const jobs = splitCards(html, /<article class="oxglobal-listing-item[^"]*">/).flatMap((card): RawJob[] => {
    const url = card.match(/class="oxglobal-listing-item_button"[^>]*>/)?.[0].match(/href="([^"]+)"/)?.[1] || card.match(/<a href="(https:\/\/www\.oxfordcorp\.com\/jobs\/[^"]+)"/)?.[1]
    const title = field(card, "oxglobal-listing-item_title")
    if (!url || !title || !IT_INDUSTRY.test(field(card, "cooking-instructions-tab-title"))) return []
    const { posted, place } = dateAndPlace(field(card, "oxglobal-listing-item_date"))
    return [{ title, url, location: place, postedAt: posted, description: field(card, "oxglobal-listing-item_excerpt-p") || undefined }]
  })
  return { jobs, total }
}

export const oxford: PortalAdapter = {
  portal: "oxford",
  firm: "Oxford Global Resources",
  async fetchJobs(get) {
    const all: RawJob[] = []
    let pages = 1
    for (let n = 1; n <= pages && n <= MOST_PAGES; n++) {
      const got = readPage(await get(`${LIST}${n}`))
      if (n === 1) pages = Math.ceil(got.total / PER_PAGE) || 1
      all.push(...got.jobs)
    }
    return all
  },
}
