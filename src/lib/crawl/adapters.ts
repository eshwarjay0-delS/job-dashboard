import type { PortalAdapter, RawJob } from "./types"
import { clean, splitCards } from "./text.ts"
import { teksystems } from "./portals/teksystems.ts"
import { kforce } from "./portals/kforce.ts"
import { motion } from "./portals/motion.ts"
import { everforth } from "./portals/everforth.ts"
import { oxford } from "./portals/oxford.ts"
import { insightglobal } from "./portals/insightglobal.ts"
import { inspyr } from "./portals/inspyr.ts"
import { brooksource } from "./portals/brooksource.ts"
import { eteam } from "./portals/eteam.ts"
import { eliassen } from "./portals/eliassen.ts"
import { systemone } from "./portals/systemone.ts"

// Verified 2026-10-17 against live portal HTML. Each parseList was tested
// against a real listing page before shipping — never trust selectors blind.

// ── Beacon Hill Technologies — WordPress + FacetWP, .job-card markup ─────────
const beaconHill: PortalAdapter = {
  portal: "beaconhill",
  firm: "Beacon Hill Technologies",
  listUrls: ["https://bhsg.com/jobs/"],
  parseList(html) {
    const jobs: RawJob[] = []
    for (const card of splitCards(html, /<div class="job-card"/)) {
      const href = card.match(/<a[^>]+href="([^"]+)"/)?.[1]
      const titleRaw = card.match(/<a[^>]+href="[^"]+"[^>]*>([\s\S]*?)<\/a>/)?.[1]
      if (!href || !titleRaw) continue
      const title = clean(titleRaw)
      if (!title) continue
      const meta = [...card.matchAll(/job-card__metaItem[^>]*>([\s\S]*?)<\/span>/g)].map(m => clean(m[1]))
      const location = meta[0] || undefined
      const engagement = meta.find(m => /contract|permanent|full time|part time/i.test(m))
      const pay = card.match(/\$\s?[\d,.]+\s?-\s?\$\s?[\d,.]+\s?per hour/i)?.[0]
      const posted = card.match(/Posted\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/)?.[1]
      jobs.push({
        title,
        url: href.startsWith("http") ? href : `https://bhsg.com${href}`,
        location,
        engagement,
        payRange: pay ? clean(pay) : undefined,
        postedAt: posted,
      })
    }
    return jobs
  },
}

// ── Collabera — WordPress, .card markup with job-description/?post= links ────
// Reverse-engineered: pagination is ?q=N (server-rendered, ~49 pages), with
// keyword/industry/location filters as query params. We crawl the 5 newest
// pages (50 jobs) per run — the fresh listings, politely.
const COLLABERA_PAGES = [1, 2, 3, 4, 5]
const collabera: PortalAdapter = {
  portal: "collabera",
  firm: "Collabera",
  listUrls: COLLABERA_PAGES.map(n =>
    `https://www.collabera.com/job-search/?sort_by=&industry=&keyword=&location=&Posteddays=0${n > 1 ? `&q=${n}` : ""}`
  ),
  parseList(html) {
    const jobs: RawJob[] = []
    const re = /<a href="(https:\/\/www\.collabera\.com\/job-description\/\?post=\d+)">([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
      const [, url, body] = m
      const title = clean(body.match(/<h5[^>]*>([\s\S]*?)<\/h5>/)?.[1] ?? "")
      if (!title) continue
      const engMatch = body.match(/<p class="p-secondary">\s*([^:<]+):\s*<span class="job-bold">\s*([^<]+)</)
      const engagement = engMatch?.[1]?.trim()
      const location = engMatch?.[2]?.trim()
      const pay = body.match(/Salary Range:\s*<span class="job-bold">\s*([^<]+)</)?.[1]?.trim()
      jobs.push({ title, url, location, engagement, payRange: pay })
    }
    return jobs
  },
}

// Beacon Hill and Collabera read listing pages; the others read the source their own page reads (src/lib/crawl/portals):
// a JSON search, the data a page hands to React, or a server-rendered table. Each has a saved sample and an offline test
// (scripts/tests/crawl-*.test.mjs) and was run once against the live portal on 2026-10-20.
export const ADAPTERS: PortalAdapter[] = [
  beaconHill, collabera, teksystems, kforce, motion, everforth, oxford, insightglobal,
  inspyr, brooksource, eteam, eliassen, systemone,
]

// Still to be read (a probe for each is in the REA board): Addison Group, KORE1, CSI, IDR, Vaco, IntelliPro, Genesis10,
// Diverse Lynx, Robert Half, CyberSN and the firms whose portal address is not yet known.
// Not read on purpose: Experis (its robots.txt disallows every crawler).
export const PENDING_PORTALS = [
  "addison", "kore1", "csi", "idr", "vaco", "intellipro",
  "genesis10", "diverselynx", "roberthalf", "cybersn",
]
