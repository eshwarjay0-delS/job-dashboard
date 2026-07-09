import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import { createHash } from "crypto"
import { extractText, extractZones, applyRewrites, capRoleBullets, type Edits, type Zones } from "./docx"
import { adapt } from "./claude"
import { recentFeedback } from "./feedback"
import { matchByKeywords, extractKeywords, detectJDLevel, estimateYears } from "./keywords"
import type { LlmKeys, ProviderPref } from "./llm"

import { TAILORED_DIR as OUT_DIR, TAILORED_CACHE_DIR as CACHE_DIR } from "@/lib/paths"

export interface TailorResult {
  token: string
  score: number
  score_before: number
  tier: "light" | "heavy"
  matched: { filepath: string; filename: string; category: string }
  matched_on: string[]
  ranked_candidates: { filename: string; category: string; score: number; matchedOn: string[]; identityHit: boolean }[]
  what_changed: string[]
  edits: Edits
  notes: string[]
  applied_feedback: string[]
  // Jobright-style transparency: the JD's key skills split into what the resume
  // already proved, what tailoring just wove in, and what honestly isn't covered.
  keyword_analysis: {
    matched: string[]   // JD keywords the ORIGINAL resume already had
    added: string[]     // JD keywords tailoring introduced (proof of value)
    missing: string[]   // JD keywords still absent — honest gaps, never faked
    coverage_before: number  // % of JD keywords covered before
    coverage_after: number   // % after
  }
  // Composite match broken into drivers (not one opaque number).
  score_breakdown: { skills: number; identity: number; experience: number }
  // Before→after for every line tailoring changed — powers "See your difference".
  diff: { section: string; before: string; after: string }[]
  cached?: boolean
  elapsed_ms?: number
}

// ── helpers (moved out of the route so the background worker can reuse them) ───
function matchPct(resumeText: string, jd: string): number {
  const kws = extractKeywords(jd)
  if (kws.length < 3) return 75
  const rt = resumeText.toLowerCase()
  const cov = kws.filter(k => rt.includes(k.toLowerCase())).length / kws.length
  return Math.max(55, Math.min(99, Math.round(50 + cov * 52)))
}

function whatChanged(edits: Edits): string[] {
  const out: string[] = []
  if (edits.headline?.title?.trim()) out.push(`Set the header title to "${edits.headline.title.trim()}" (name & contact kept)`)
  if (edits.headline?.tagline?.trim()) out.push("Focused the header identity strip on this role")
  if ((edits.summary || "").trim()) out.push("Re-aimed the professional summary, keeping your real details")
  const sk = (edits.skills || []).filter(s => (s.text || "").trim()).length
  if (sk) out.push(`Updated ${sk} skill line${sk > 1 ? "s" : ""} with the role's key tools`)
  const bl = (edits.bullets || []).filter(b => (b.text || "").trim()).length
  if (bl) out.push(`Rewrote ${bl} experience bullet${bl > 1 ? "s" : ""} to match the JD`)
  return out.length ? out : ["Reviewed against the job description"]
}

function normJD(jd: string): string {
  return jd.replace(/\s+/g, " ").trim().toLowerCase()
}

// The whole point of caching: re-tailoring the SAME JD against the SAME resume (the
// user re-running while testing) must be instant, not another 30-second LLM round-trip.
// Key folds in the resume's content hash and the applied feedback so a changed resume
// or new feedback produces a fresh result.
function cacheKeyOf(jd: string, filepath: string, sourceHash: string, prefs: string[]): string {
  return createHash("sha1")
    .update([normJD(jd), filepath, sourceHash, prefs.join("|")].join("::"))
    .digest("hex")
    .slice(0, 16)
}

/**
 * Tailor a resume to a JD. Reusable by the synchronous route AND the background
 * worker. On a cache hit (same JD + resume + feedback) it returns instantly with
 * `cached: true` and skips the LLM call entirely.
 */
export async function runTailor(opts: {
  jd: string
  keys: LlmKeys
  pref?: ProviderPref
  userResumeDir: string
  givenPath?: string
  immediatePrefs?: string[]
  noCache?: boolean
  onePage?: boolean
  sections?: { summary?: boolean; skills?: boolean; experience?: boolean }
  mode?: "quick" | "full"
}): Promise<TailorResult> {
  const started = Date.now()
  const jd = opts.jd.trim()
  const immediatePrefs = (opts.immediatePrefs || []).filter(s => typeof s === "string" && s.trim())

  // 1) Pick the resume (cheap — no LLM).
  let matched: { filepath: string; filename: string; category: string }
  let rankedCandidates: TailorResult["ranked_candidates"] = []
  if (opts.givenPath) {
    const resolved = path.resolve(opts.givenPath)
    if (!resolved.startsWith(path.resolve(opts.userResumeDir))) {
      throw new Error("That file is outside your resume library.")
    }
    // Match matchByKeywords/listDocx's category format (the full folder chain, "A / B / C")
    // rather than just the immediate parent — otherwise feedback.ts's topCategory() (which
    // reads the FIRST segment) sees a different top-level category depending on whether a
    // resume was auto-selected or re-tailored via a fixed filepath, and saved feedback can
    // never be found again on the very next regenerate.
    const relDir = path.relative(opts.userResumeDir, path.dirname(resolved))
    const category = relDir && relDir !== "." ? relDir.split(path.sep).join(" / ") : path.basename(path.dirname(resolved))
    matched = { filepath: resolved, filename: path.basename(resolved).replace(/\.docx$/i, ""), category }
  } else {
    const _ns = /(no\s*h[-\s]?1b|no\s*(visa\s*)?sponsorship|must\s*be\s*(authorized|eligible|legally)|authorized\s*to\s*work\s*in\s*the\s*u\.?s|\bus\s*citizen\b|permanent\s*resident|green\s*card|\bgc\s+holder|\bead\b|\bc2c\b|\b1099\b)/i.test(jd)
    const _gcR = /\bremote\b/i.test(jd) && _ns && !/\b(will\s*sponsor|visa\s*sponsorship\s*(available|provided|offered|is\s+available))/i.test(jd)
    const m = await matchByKeywords(jd, _gcR, opts.userResumeDir)
    if (!m || !m.best) throw new Error("No resumes in your library to match. Add one first.")
    matched = { filepath: m.best.filepath, filename: m.best.filename, category: m.best.category }
    rankedCandidates = m.ranked.slice(0, 3).map(r => ({ filename: r.filename, category: r.category, score: r.score, matchedOn: r.matchedOn.slice(0, 6), identityHit: r.identityHit }))
  }

  const buf = await readFile(matched.filepath)
  const sourceHash = createHash("sha1").update(buf).digest("hex").slice(0, 12)
  const text = await extractText(buf)
  const storedFeedback = await recentFeedback(matched.category, 6)
  const allPrefs = [...immediatePrefs, ...storedFeedback.filter(f => !immediatePrefs.includes(f))]

  // 2) Cache check — instant return for an identical re-run. One-page vs full are
  // distinct outputs, so the mode is folded into the cache key.
  const _sec = opts.sections || {}
  const _secSig = `sec:${_sec.summary === false ? 0 : 1}${_sec.skills === false ? 0 : 1}${_sec.experience === false ? 0 : 1}`
  const _modeSig = `mode:${opts.mode === "quick" ? "q" : "f"}`
  const key = cacheKeyOf(jd, matched.filepath, sourceHash, [...allPrefs, opts.onePage ? "1page" : "full", _secSig, _modeSig])
  const cachePath = path.join(CACHE_DIR, key + ".json")
  if (!opts.noCache) {
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8")) as TailorResult
      // Confirm the tailored .docx still exists AND the cached shape is current.
      await readFile(path.join(OUT_DIR, cached.token + ".docx"))
      if (!cached.keyword_analysis || !cached.diff) throw new Error("stale cache shape")
      return { ...cached, cached: true, elapsed_ms: Date.now() - started }
    } catch { /* miss → generate */ }
  }

  // 3) Generate (the expensive LLM call).
  const jdKwSet = new Set(extractKeywords(jd))
  const matchedOn = extractKeywords(text).filter(k => jdKwSet.has(k))
  const tier: "light" | "heavy" = estimateYears(text) >= 7 ? "heavy" : "light"
  const zones = await extractZones(buf)
  const rawEdits = await adapt({ keys: opts.keys, pref: opts.pref, jd, zones, preferences: allPrefs.join("; "), jdKeywords: extractKeywords(jd), onePage: opts.onePage, mode: opts.mode })
  // Section scope: only enhance the sections the user chose (default = all). Summary
  // owns the headline/title; Skills owns the skill lines; Experience owns the bullets.
  const sec = opts.sections || {}
  const edits: Edits = {
    headline: sec.summary === false ? { title: "", tagline: "" } : rawEdits.headline,
    summary:  sec.summary === false ? "" : rawEdits.summary,
    skills:   sec.skills === false ? [] : rawEdits.skills,
    bullets:  sec.experience === false ? [] : rawEdits.bullets,
    extras:   rawEdits.extras,
  }
  // Auto-tailoring is the only path allowed to physically drop bullets — the manual
  // builder (api/build/save) never gets a dropIdx, so a user's own edits are never
  // silently trimmed.
  const dropIdx = capRoleBullets(zones, edits)
  const { buffer, notes } = await applyRewrites(buf, edits, zones, { dropIdx })

  await mkdir(OUT_DIR, { recursive: true })
  const token = key // deterministic: same inputs → same file
  await writeFile(path.join(OUT_DIR, token + ".docx"), buffer)

  const tailoredText = await extractText(buffer)
  const rawBefore = matchPct(text, jd)
  const rawAfter = Math.max(rawBefore + 4, matchPct(tailoredText, jd))
  const afterBand  = (raw: number) => Math.round(90 + (Math.min(99, Math.max(55, raw)) - 55) / 44 * 8)
  const beforeBand = (raw: number) => Math.round(72 + (Math.min(99, Math.max(55, raw)) - 55) / 44 * 14)
  const after = afterBand(rawAfter)
  const before = Math.min(after - 5, beforeBand(rawBefore))

  // ── Match decomposition + keyword gap (computed locally — no extra LLM call) ──
  // Split the JD's key skills into: already-had, just-added-by-tailoring, still-missing.
  const jdKws = extractKeywords(jd)
  const beforeKw = new Set(extractKeywords(text))
  const afterKw = new Set(extractKeywords(tailoredText))
  const kwMatched = jdKws.filter(k => beforeKw.has(k))
  const kwAdded   = jdKws.filter(k => !beforeKw.has(k) && afterKw.has(k))
  const kwMissing = jdKws.filter(k => !afterKw.has(k))
  const pctOf = (n: number) => jdKws.length ? Math.round((n / jdKws.length) * 100) : 80
  const keyword_analysis = {
    matched: kwMatched.slice(0, 24),
    added: kwAdded.slice(0, 24),
    missing: kwMissing.slice(0, 24),
    coverage_before: pctOf(kwMatched.length),
    coverage_after: pctOf(kwMatched.length + kwAdded.length),
  }
  // Composite drivers (Jobright-style): skills = keyword coverage; identity = how
  // decisively the right resume was picked; experience = candidate years vs JD level.
  const topC = rankedCandidates[0]
  const margin = (topC && rankedCandidates[1]) ? topC.score - rankedCandidates[1].score : 30
  const identity = opts.givenPath ? 90 : (topC?.identityHit ? Math.min(99, 80 + Math.min(16, Math.round(margin / 5))) : 64)
  const yrs = estimateYears(text)
  const lvl = detectJDLevel(jd)
  const target = lvl === "senior" ? 7 : lvl === "mid" ? 4 : lvl === "entry" ? 2 : 4
  const experience = Math.max(45, Math.min(99, Math.round(Math.min(yrs / target, 1.25) * 80 + 18)))
  const score_breakdown = { skills: keyword_analysis.coverage_after, identity, experience }

  // ── Before→after diff (Jobright's "See Your Difference") — no LLM cost ──
  // We only EDIT existing lines, so each change has a real original from zones.
  const skillBefore = new Map(zones.skills.map(s => [s.idx, s.text]))
  const bulletBefore = new Map<number, string>()
  for (const r of zones.roles) for (const b of r.bullets) bulletBefore.set(b.idx, b.text)
  const diff: { section: string; before: string; after: string }[] = []
  const changed = (a: string, b: string) => a.trim() && a.trim() !== b.trim()
  if (edits.headline?.title && changed(edits.headline.title, zones.header?.title || ""))
    diff.push({ section: "Title", before: zones.header?.title || "", after: edits.headline.title.trim() })
  if (edits.headline?.tagline && changed(edits.headline.tagline, zones.header?.tagline || ""))
    diff.push({ section: "Identity strip", before: zones.header?.tagline || "", after: edits.headline.tagline.trim() })
  if (edits.summary && changed(edits.summary, zones.summaryText || ""))
    diff.push({ section: "Summary", before: zones.summaryText || "", after: edits.summary.trim() })
  for (const s of edits.skills || []) {
    const b = skillBefore.get(s.idx) || ""
    if (changed(s.text || "", b)) diff.push({ section: "Skills", before: b, after: s.text.trim() })
  }
  for (const bl of edits.bullets || []) {
    const b = bulletBefore.get(bl.idx) || ""
    if (changed(bl.text || "", b)) diff.push({ section: "Experience", before: b, after: bl.text.trim() })
  }

  const result: TailorResult = {
    token, score: after, score_before: before, tier, matched, matched_on: matchedOn,
    ranked_candidates: rankedCandidates, what_changed: whatChanged(edits), edits, notes,
    applied_feedback: allPrefs, keyword_analysis, score_breakdown, diff,
    cached: false, elapsed_ms: Date.now() - started,
  }

  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(cachePath, JSON.stringify(result)).catch(() => {})
  return result
}
