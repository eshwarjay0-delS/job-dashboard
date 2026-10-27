// Eliassen, System One and Addison run their careers site on SnapHop's recruiting portal, whose job lists are drawn on the
// server: a <li class="list-group-item"> per job holding the job's address, title (h3), place, a snippet and the date.
// One reader for both. The job's kind (contract, contract to hire) is not on the card; it is the filter the list was
// asked for with.
import type { RawJob } from "../types"
import { absolute, clean, payIn, splitCards } from "../text.ts"

/** "10/19/2026" as 2026-10-19. */
function isoDate(s: string): string | undefined {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : undefined
}

/** The jobs on one list page, each with `engagement`; `base` is the portal's own address. A page with none gives []. */
export function readCards(html: string, base: string, engagement: string): RawJob[] {
  // A job's address is /job/... on a portal of its own (Eliassen, System One) and /jobs/job/... when the board sits inside
  // the firm's site (Addison).
  return splitCards(html, /<li class="list-group-item">\s*(?=<a href="(?:\/[\w-]+)?\/job\/)/).flatMap((chunk): RawJob[] => {
    const card = chunk.split("</li>")[0]
    const href = card.match(/<a href="((?:\/[\w-]+)?\/job\/[^"?]+)/)?.[1]
    const title = clean(card.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] || "")
    if (!href || !title) return []
    const place = clean(card.match(/<strong>([\s\S]*?)<\/strong>/)?.[1] || "")
    const snippet = clean(card.match(/<p>([\s\S]*?)<\/p>/)?.[1] || "").replace(/^Description:\s*/i, "")
    const posted = clean(card.match(/Date Posted:\s*<\/strong>\s*([^<]+)/i)?.[1] || "")
    return [{
      title, url: absolute(href, base),
      location: !place || /^date posted/i.test(place) ? undefined : /^anywhere\b/i.test(place) ? "Remote" : place,
      engagement, payRange: payIn(snippet), postedAt: isoDate(posted), description: snippet || undefined,
    }]
  })
}

/** "Job Search Results (138)" on the first page of a filtered list: how many jobs the list holds. */
export const totalIn = (html: string): number => Number(html.match(/Job Search Results \((\d+)\)/)?.[1]) || 0
