import path from "path"
import { createHash } from "crypto"
import { blob, keyOf } from "@/lib/storage"
import { extractText, extractZones, applyRewrites, capRoleBullets, type Edits, type Zones } from "./docx"
import { adapt } from "./claude"
import { recentFeedback } from "./feedback"
import { matchByKeywords, extractKeywords, extractJdKeywords, coveredJdKeywords, detectJDLevel, estimateYears } from "./keywords"
import type { LlmKeys, ProviderPref, TokenUsage } from "./llm"

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
  // Real token accounting for this tailor (proof the cache is working). estCostUSD is
  // approximate — priced at Haiku 4.5 rates; cacheReadTokens bill at ~1/10th of input.
  usage?: {
    calls: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    estCostUSD: number
  }
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

  const buf = await blob.get(keyOf(matched.filepath))
  if (!buf) throw new Error("The selected resume could not be read.")
  const sourceHash = createHash("sha1").update(buf).digest("hex").slice(0, 12)
  const text = await extractText(buf)
  const storedFeedback = await recentFeedback(matched.category, 6)
  // Applied on EVERY tailor by default (the "Refine" chips the user wants pre-selected on
  // the first run): bias toward specific, keyword-dense, technical output from the start so
  // the first result already reads tailored — not generic. Deduped against explicit prefs.
  const DEFAULT_PREFS = [
    "More specific, less generic — concrete tools, systems, and outcomes, never vague filler",
    "Add more keywords from the JD wherever the candidate can honestly support them",
    "More technical detail — name the exact technologies, protocols, and methods used",
  ]
  const explicit = [...immediatePrefs, ...storedFeedback.filter(f => !immediatePrefs.includes(f))]
  const allPrefs = [...explicit, ...DEFAULT_PREFS.filter(d => !explicit.includes(d))]

  // 2) Cache check — instant return for an identical re-run. One-page vs full are
  // distinct outputs, so the mode is folded into the cache key.
  const _sec = opts.sections || {}
  const _secSig = `sec:${_sec.summary === false ? 0 : 1}${_sec.skills === false ? 0 : 1}${_sec.experience === false ? 0 : 1}`
  const _modeSig = `mode:${opts.mode === "quick" ? "q" : "f"}`
  const key = cacheKeyOf(jd, matched.filepath, sourceHash, [...allPrefs, opts.onePage ? "1page" : "full", _secSig, _modeSig])
  const cacheKey = `tailored_cache/${key}.json`
  if (!opts.noCache) {
    try {
      const raw = await blob.getText(cacheKey)
      if (!raw) throw new Error("cache miss")
      const cached = JSON.parse(raw) as TailorResult
      // Confirm the tailored .docx still exists AND the cached shape is current.
      if (!(await blob.exists(`tailored/${cached.token}.docx`))) throw new Error("tailored file gone")
      if (!cached.keyword_analysis || !cached.diff) throw new Error("stale cache shape")
      return { ...cached, cached: true, elapsed_ms: Date.now() - started }
    } catch { /* miss → generate */ }
  }

  // 3) Generate — SMART MODEL LADDER (token-aware quality).
  const zones = await extractZones(buf)
  // The tailoring target is the JD's OWN keywords (domain-agnostic extraction), not a
  // fixed vocab — so this works for ANY job description without hand-curated per-domain
  // terms. Coverage = which of those literally appear in the resume.
  const jdKws = extractJdKeywords(jd)
  const beforeKw = coveredJdKeywords(text, jdKws)
  const matchedOn = [...beforeKw]
  const kwMatched = [...beforeKw]
  const tier: "light" | "heavy" = estimateYears(text) >= 7 ? "heavy" : "light"

  // COST-ORDERED MODEL LADDER (cheapest capable model first; escalate ONLY for the
  // resumes that actually need it). Every tailor starts on a near-free model; we only
  // pay for a stronger model when a pass is still under the ATS coverage target — so
  // easy resumes stay cheap, and the hard ones climb Haiku → Sonnet → Opus for the
  // near-100% match the user wants. Since resumes are pre-made per domain (~70% already),
  // the top of the ladder only has to weave in the remaining JD-specific keywords.
  const E = process.env
  // 0.90 keeps it FAST: domain-matched resumes (~70% base) usually clear this on the
  // cheap Haiku pass in one shot (~8s), so we rarely pay for a slow Sonnet/Opus redraft.
  // Raise toward 0.97 for max coverage at the cost of more escalation time.
  const TARGET = Number(E.TAILOR_COVERAGE_TARGET ?? 0.90)
  const LADDER: { pref: ProviderPref; model?: string; label: string }[] = []
  // Gemini is OPT-IN (TAILOR_USE_GEMINI=1): the FREE tier is capped at ~20 requests, and
  // best-of-3 fires 3 calls/tailor, so it exhausts in ~6 tailors and then every call 429s.
  // Only worth enabling with a PAID Gemini key. Default base is Haiku (reliable + cheap).
  if (E.TAILOR_USE_GEMINI === "1" || E.TAILOR_USE_GEMINI === "true") {
    LADDER.push({ pref: "gemini", model: E.GEMINI_MODEL_HEAVY || undefined, label: E.GEMINI_MODEL_HEAVY || "gemini-flash-latest" })
  }
  LADDER.push(
    { pref: "anthropic", model: E.CLAUDE_MODEL_HEAVY  || "claude-haiku-4-5",  label: E.CLAUDE_MODEL_HEAVY  || "claude-haiku-4-5" },  // reliable base
    { pref: "anthropic", model: E.CLAUDE_MODEL_STRONG || "claude-sonnet-4-5", label: E.CLAUDE_MODEL_STRONG || "claude-sonnet-4-5" }, // strong ceiling (default)
  )
  // Opus is OPT-IN only (TAILOR_USE_OPUS=1). Measured: on a dense JD it ran a ~45s full
  // redraft AFTER Sonnet and added ZERO coverage (the remaining terms were honestly
  // un-addable), so by default we cap at Sonnet — near-identical coverage, ~45s faster.
  if (E.TAILOR_USE_OPUS === "1" || E.TAILOR_USE_OPUS === "true") {
    LADDER.push({ pref: "anthropic", model: E.CLAUDE_MODEL_MAX || "claude-opus-5", label: E.CLAUDE_MODEL_MAX || "claude-opus-5" })
  }
  // Keep only steps whose provider key exists (preserving cheap→strong order); if the
  // user pinned a provider via opts.pref, honour it as a single fixed step.
  const keyed = (p: ProviderPref) => p !== "auto" && !!opts.keys[p as keyof typeof opts.keys]
  let steps = LADDER.filter(s => keyed(s.pref))
  if (opts.pref && opts.pref !== "auto") steps = LADDER.filter(s => s.pref === opts.pref)
  if (!steps.length) steps = [{ pref: "auto", model: undefined, label: "auto" }]

  const sec = opts.sections || {}
  const scopeEdits = (raw: Edits): Edits => ({
    // Section scope: only enhance the sections the user chose (default = all).
    headline: sec.summary === false ? { title: "", tagline: "" } : raw.headline,
    summary:  sec.summary === false ? "" : raw.summary,
    skills:   sec.skills === false ? [] : raw.skills,
    bullets:  sec.experience === false ? [] : raw.bullets,
    extras:   raw.extras,
  })

  type Pass = { edits: Edits; buffer: Buffer; notes: string[]; tailoredText: string; cov: number; afterKw: Set<string> }
  // Apply a finished edit set to the docx and measure JD keyword coverage. Auto-tailoring
  // is the only path allowed to physically drop bullets (the manual builder never gets a
  // dropIdx), so a user's own edits are never silently trimmed.
  const applyEdits = async (edits: Edits): Promise<Pass> => {
    // FORMAT-PRESERVING by default: never delete paragraphs, so the tailored resume
    // keeps the EXACT layout, bullet count, and structure of the source — we only
    // rewrite existing lines in place. Bullet trimming (capRoleBullets) is allowed
    // ONLY when the user explicitly asked for a one-page condense.
    const dropIdx = opts.onePage ? capRoleBullets(zones, edits) : new Set<number>()
    const { buffer, notes } = await applyRewrites(buf, edits, zones, { dropIdx })
    const tailoredText = await extractText(buffer)
    const afterKw = coveredJdKeywords(tailoredText, jdKws)
    const cov = jdKws.length ? afterKw.size / jdKws.length : 1
    return { edits, buffer, notes, tailoredText, cov, afterKw }
  }
  // A generation pass on a given model: the model sees the whole resume once and
  // returns a coherent edit set. On escalation we pass the exact JD terms still
  // missing so the stronger model closes the gap in ONE coherent redraft — a full
  // redraft beats a lossy targeted merge (which could drop keywords and never improve
  // coverage, stalling the climb).
  const draftPass = async (step: { pref: ProviderPref; model?: string }, extraPrefs: string[]): Promise<Pass> => {
    const prefs = [...allPrefs, ...extraPrefs].filter(Boolean)
    const raw = await adapt({ keys: opts.keys, pref: step.pref, jd, zones, preferences: prefs.join("; "), jdKeywords: jdKws, onePage: opts.onePage, mode: opts.mode, model: step.model, usageSink })
    return applyEdits(scopeEdits(raw))
  }

  const summaryWanted = sec.summary !== false
  const quality = (p: Pass) => p.cov - (summaryWanted && !(p.edits.summary || "").trim() ? 0.08 : 0)
  // Build the "front-load" instruction listing exactly which JD terms are still missing
  // (computed deterministically from resume coverage — no LLM) so every pass targets the gap.
  const injectFor = (covered: Set<string>, wantSummary: boolean): string[] => {
    const missing = jdKws.filter(k => !covered.has(k)).slice(0, 40)
    if (!missing.length && !wantSummary) return []
    const parts: string[] = []
    if (missing.length) parts.push(`ensure these JD terms appear, weaving EACH one the candidate can honestly support into the most relevant existing skill line or bullet using the JD's exact wording (skip any the candidate genuinely can't back up): ${missing.join(", ")}`)
    if (wantSummary) parts.push("ALWAYS return a rewritten professional summary")
    return [`ATS COVERAGE (rewrite existing lines in place; never invent unsupported claims): ${parts.join("; ")}`]
  }

  // Climb the ladder with GRACEFUL FALLBACK. The first model that actually produces a
  // draft becomes the base and gets BEST-OF-N (parallel draws, keep the highest — LLM
  // sampling swings coverage, so we take the best). If a model errors entirely (e.g. a
  // 429 quota wall), we fall through to the NEXT model instead of failing the whole
  // tailor. Once we have a draft, remaining models are single escalation redrafts that
  // target the still-missing terms; stop on target-hit or plateau. Quick mode = one draw.
  // best-of default 1 (was 3→2): each extra draw is another full-price Claude call. One
  // front-loaded draw + the conditional escalation below already lands high coverage on
  // domain-matched resumes, so best-of-1 is the cheapest default AND the lightest on the
  // rate limit. Raise TAILOR_BEST_OF (2-3) only if you want tighter run-to-run variance.
  const BEST_OF = opts.mode === "quick" ? 1 : Math.max(1, Math.min(5, Number(process.env.TAILOR_BEST_OF ?? 1)))
  // Collect every call's token usage so we can report the real cost of this tailor.
  const usageSink: TokenUsage[] = []
  // Wall-clock budget: never START a model call that can't finish before the serverless
  // function is killed. TAILOR_MAX_MS (< Vercel's 60s) minus one per-call timeout is the
  // latest we may begin an escalation redraft; past that we return the best draft so far.
  const t0 = Date.now()
  const TAILOR_MAX_MS = Number(E.TAILOR_MAX_MS) || 52000
  const CALL_MS = Number(E.LLM_CALL_TIMEOUT_MS) || 35000
  let best: Pass | null = null
  let usedModel = ""
  for (const step of steps) {
    if (!best) {
      // Base: best-of-N in parallel; skip this model if every draw errored.
      const extra = injectFor(beforeKw, false)
      const draws = (await Promise.all(
        Array.from({ length: BEST_OF }, () => draftPass(step, extra).catch(() => null)),
      )).filter((p): p is Pass => p !== null)
      if (!draws.length) continue // this model failed entirely → try the next one
      best = draws.reduce((a, b) => (quality(b) > quality(a) ? b : a))
      usedModel = `${step.label ?? String(step.pref)}${BEST_OF > 1 && draws.length > 1 ? ` (best of ${draws.length})` : ""}`
      if (opts.mode === "quick") break
    } else {
      // Coverage-climbing escalation (base → Sonnet → Opus) is OPT-IN via TAILOR_CLIMB=1.
      // By default the base pass IS the result. Climbing added a slow ~35s Sonnet redraft
      // for usually only a few % coverage, which made runs swing between ~17s and ~55-80s
      // and pushed hard JDs past Vercel's 60s cutoff ("sometimes not generating"). The
      // next model in the ladder is still used as an ERROR fallback (the `if (!best)
      // continue` branch above) — it just isn't used to climb coverage anymore.
      if (process.env.TAILOR_CLIMB !== "1" && process.env.TAILOR_CLIMB !== "true") break
      // Skip it if there isn't enough time left for a full call before the deadline —
      // returning the current best beats 504-ing on a call that can't finish in time.
      if (Date.now() - t0 > TAILOR_MAX_MS - CALL_MS) break
      if (best.cov >= TARGET && (!summaryWanted || (best.edits.summary || "").trim())) break
      const wantSummary = summaryWanted && !(best.edits.summary || "").trim()
      const extra = injectFor(best.afterKw, wantSummary)
      if (!extra.length) break
      const prevQ = quality(best)
      const p = await draftPass(step, extra).catch(() => null)
      if (p && quality(p) >= quality(best)) { best = p; usedModel = (step as { label?: string }).label ?? String(step.pref) }
      if (quality(best) <= prevQ + 0.01) break // no meaningful gain → stop
    }
  }
  if (!best) throw new Error("Tailoring failed — every model errored (check API keys / quota).")

  const { edits, buffer, notes, tailoredText, afterKw } = best
  notes.push(`Tailored with ${usedModel} · JD keyword coverage ${Math.round(best.cov * 100)}%`)

  const token = key // deterministic: same inputs → same file
  await blob.put(`tailored/${token}.docx`, buffer)

  const rawBefore = matchPct(text, jd)
  const rawAfter = Math.max(rawBefore + 4, matchPct(tailoredText, jd))
  const afterBand  = (raw: number) => Math.round(90 + (Math.min(99, Math.max(55, raw)) - 55) / 44 * 8)
  const beforeBand = (raw: number) => Math.round(72 + (Math.min(99, Math.max(55, raw)) - 55) / 44 * 14)
  const after = afterBand(rawAfter)
  const before = Math.min(after - 5, beforeBand(rawBefore))

  // ── Match decomposition + keyword gap (reuses the coverage sets above) ──
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

  // Total the real token usage across every model call this tailor made. Anthropic
  // reports cached prefix tokens under cacheRead (~1/10th the price of fresh input),
  // so a high cacheRead share = the resume+RULES cache paying off on repeat tailors.
  const uAgg = usageSink.reduce(
    (a, u) => ({ input: a.input + u.input, output: a.output + u.output, cacheRead: a.cacheRead + u.cacheRead, cacheWrite: a.cacheWrite + u.cacheWrite }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  )
  // Approx Haiku 4.5 rates ($/M): input 1.00, output 5.00, cache write 1.25, cache read 0.10.
  const estCostUSD = Math.round((uAgg.input * 1 + uAgg.output * 5 + uAgg.cacheWrite * 1.25 + uAgg.cacheRead * 0.1) / 1e6 * 1e5) / 1e5

  const result: TailorResult = {
    token, score: after, score_before: before, tier, matched, matched_on: matchedOn,
    ranked_candidates: rankedCandidates, what_changed: whatChanged(edits), edits, notes,
    applied_feedback: allPrefs, keyword_analysis, score_breakdown, diff,
    cached: false, elapsed_ms: Date.now() - started,
    usage: { calls: usageSink.length, inputTokens: uAgg.input, outputTokens: uAgg.output, cacheReadTokens: uAgg.cacheRead, cacheWriteTokens: uAgg.cacheWrite, estCostUSD },
  }

  await blob.put(cacheKey, JSON.stringify(result)).catch(() => {})
  return result
}
