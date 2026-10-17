// Portal crawler — the Apply tab's inclusive search.
// Each adapter knows one vendor portal: where its listings live and how to
// read a job card. Adding a portal = one entry in ADAPTERS with verified selectors.

export type WorkType = "contract" | "permanent" | "unknown"

export type RawJob = {
  title: string
  url: string
  location?: string
  engagement?: string // raw employment-type string, e.g. "Direct (Permanent), Full Time"
  payRange?: string
  postedAt?: string // raw date string
  description?: string
}

export type PortalAdapter = {
  /** stable key, also the `portal` column value */
  portal: string
  /** display name, also the `firm` column value */
  firm: string
  /** listing pages to crawl (page 1 of each is enough for v1) */
  listUrls: string[]
  /** extract job cards from a listing page's HTML */
  parseList: (html: string) => RawJob[]
}

export type CrawlResult = {
  portal: string
  firm: string
  found: number
  upserted: number
  error?: string
}
