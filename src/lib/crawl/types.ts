// Portal crawler — the Apply tab's inclusive search.
// Each adapter knows one vendor portal: where its listings live and how to read them. A portal whose page is drawn by
// its own script still fetches its jobs from somewhere (a JSON API, a sitemap of job pages, the job pages' JobPosting
// records): such an adapter reads that source with `fetchJobs` instead of `listUrls` + `parseList`.

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

/** The runner's fetch: its own user agent, a time limit, and a gap between calls. Returns the body; throws on non-2xx. */
export type Fetcher = (url: string, init?: {
  method?: "GET" | "POST"
  body?: string
  headers?: Record<string, string>
  /** The Accept header; HTML unless said otherwise. */
  accept?: string
}) => Promise<string>

export type PortalAdapter = {
  /** stable key, also the `portal` column value */
  portal: string
  /** display name, also the `firm` column value */
  firm: string
  /** listing pages to crawl (page 1 of each is enough for v1) */
  listUrls?: string[]
  /** extract job cards from a listing page's HTML */
  parseList?: (html: string) => RawJob[]
  /** for a portal read from an API or a sitemap: every job it lists now, fetched only through `get` */
  fetchJobs?: (get: Fetcher) => Promise<RawJob[]>
  /** pause between this portal's requests, in ms; the runner's own 600 unless a portal asks for slower */
  gapMs?: number
}

export type CrawlResult = {
  portal: string
  firm: string
  found: number
  upserted: number
  error?: string
}
