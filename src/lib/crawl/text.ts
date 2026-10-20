// Reading job listings out of what a portal sends: HTML text, and the JobPosting records (schema.org JSON-LD) most
// job pages carry for search engines. Shared by every portal adapter; imported with its ".ts" so tests can load it.
import type { RawJob } from "./types"

export const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ")
export const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
export const clean = (s: string) => decodeEntities(stripTags(String(s ?? ""))).replace(/\s+/g, " ").trim()

/** The page split at each occurrence of `marker`, without what comes before the first. */
export function splitCards(html: string, marker: RegExp): string[] {
  const parts = html.split(marker)
  parts.shift()
  return parts
}

/** A link made absolute against the page it was found on. */
export function absolute(href: string, base: string): string {
  try { return new URL(decodeEntities(href), base).toString() } catch { return href }
}

type Place = { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } }
const placeOf = (loc: unknown, remote: boolean): string | undefined => {
  const all = (Array.isArray(loc) ? loc : loc ? [loc] : []) as Place[]
  const names = all.map(p => {
    const a = p?.address || {}
    const country = typeof a.addressCountry === "string" ? a.addressCountry : a.addressCountry?.name
    return [a.addressLocality, a.addressRegion, all.length === 1 && !a.addressLocality ? country : ""].filter(Boolean).join(", ")
  }).filter(Boolean)
  const place = [...new Set(names)].join("; ")
  return remote ? (place ? `Remote (${place})` : "Remote") : place || undefined
}

type Salary = { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } }
const payOf = (s: unknown): string | undefined => {
  const v = (s as Salary)?.value
  if (!v) return undefined
  const cur = (s as Salary).currency === "USD" || !(s as Salary).currency ? "$" : `${(s as Salary).currency} `
  const amount = (n?: number) => (typeof n === "number" ? `${cur}${n.toLocaleString("en-US")}` : "")
  const range = v.minValue || v.maxValue ? [amount(v.minValue), amount(v.maxValue)].filter(Boolean).join(" - ") : amount(v.value)
  return range ? `${range}${v.unitText ? ` per ${String(v.unitText).toLowerCase()}` : ""}` : undefined
}

/** Every JobPosting record (JSON-LD) on a page, as jobs. `pageUrl` stands in when a record names no address. */
export function jobPostingsIn(html: string, pageUrl: string): RawJob[] {
  const out: RawJob[] = []
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try { data = JSON.parse(m[1].trim()) } catch { continue }
    const items: unknown[] = Array.isArray(data) ? data : (data as { "@graph"?: unknown[] })?.["@graph"] || [data]
    for (const it of items as Record<string, unknown>[]) {
      const type = it?.["@type"]
      if (!(type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting")))) continue
      const title = clean(String(it.title || ""))
      if (!title) continue
      const kinds = ([] as unknown[]).concat(it.employmentType || []).map(String).filter(Boolean)
      out.push({
        title,
        url: absolute(String(it.url || pageUrl), pageUrl),
        location: placeOf(it.jobLocation, it.jobLocationType === "TELECOMMUTE"),
        engagement: kinds.length ? kinds.join(", ") : undefined,
        payRange: payOf(it.baseSalary),
        postedAt: typeof it.datePosted === "string" ? it.datePosted : undefined,
        description: clean(String(it.description || "")).slice(0, 8000) || undefined,
      })
    }
  }
  return out
}

/** The page addresses a sitemap lists (`<loc>`), optionally only those matching `keep`. */
export function sitemapUrls(xml: string, keep?: RegExp): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => decodeEntities(m[1]))
  return keep ? urls.filter(u => keep.test(u)) : urls
}
