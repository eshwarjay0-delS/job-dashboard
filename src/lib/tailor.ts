import { roleQualityBlockers } from "./tailor-ship-on-rollback"
import { acceptImprovingRepairs, mergeIndexedEdits } from "./resume-repair"
import { removeUnsupportedRewrites } from "./resume-unsupported-rewrites"
import { candidateEvidenceInput, explicitlyConfirmsAllRequirements } from "./resume-evidence"
import { preserveSkillHeadings } from "./resume-format"
import { RESUME_MIN_COVERAGE, RESUME_TARGET_COVERAGE, experienceCoverageComplete, resumeQuality, requiredEvidenceTerms, coveragePercent } from "./resume-quality"
import { J1_VERSION, constrainResumeEdits } from "./ai/j1"
import path from "path"
import { createHash } from "crypto"
import { blob, keyOf } from "@/lib/storage"
import { extractText, extractZones, applyRewrites, capRoleBullets, roleSpanMonths, type Edits, type Zones } from "./docx"
import { adapt, expandConfirmedVocabulary, expandJdKeywordsTwice, type ConfirmedVocabulary } from "./claude"
import { recentFeedback } from "./feedback"
import { matchByKeywords, extractJdKeywords, requirementText, coveredJdKeywords, detectJDLevel, estimateYears } from "./keywords"
import { modelFor, type LlmKeys, type ProviderPref, type TokenUsage } from "./llm"
import { workParts, judgeLane, extraModels, type Lane, type LaneOut } from "./tailorLanes"
import { priceCalls, type PricedCall } from "./llmPrices"
import { targetKeywords, placeInSkills, isCertification, isQualificationOrJunk, floorTerms, jdSpelling, withoutAddedCerts, withoutUnsupportedSkills, weaveConfirmedVocabulary, SOFT_SKILL, type RelationalPair } from "./keyword-targets"
import { tailorReview, type TailorReview } from "./resume-changes"
import { tailorRunKey } from "./tailor-review"
import { jdTermsGateOn, type JdTermsUnplacedReason } from "./jd-terms-gate"
import { cleanTerm, isJunkTerm, isGuardUnsafe } from "./resume-skills-line"
import { cacheSkipRefusedOn, refusedForReplay } from "./tailor-guards"

export interface TailorResult {
  quality?: ReturnType<typeof resumeQuality>
  /** Non-PII codes explaining why a high keyword score may still be blocked. */
  quality_blockers?: string[]
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
  // What the person checks before download (src/lib/resume-changes.ts): the original as the parser read it, and every
  // added, changed or removed line, role by role, with the JD term it answers. Absent on results made before 23 Oct 2026;
  // /api/tailor/review rebuilds it from the run record.
  review?: TailorReview
  cached?: boolean
  elapsed_ms?: number
  // MEASURED JD keyword coverage (0-100) of the document actually returned.
  // keyword_analysis.coverage_after still counts an original keyword that a rewrite
  // dropped; this one doesn't, so it is the honest number to report after an edit.
  coverage?: number
  /** Coverage of requirements grounded in source resume or explicit candidate confirmations. Not overall ATS coverage. */
  supported_coverage?: number
  /** JD requirements not evidenced by the candidate; never add as claimed skills merely to raise a score. */
  unsupported_keywords?: string[]
  /** Unsupported requirements that appeared as new claims in the generated document. */
  unverified_added_keywords?: string[]
  // Per role: bullets rewritten and added, the listed JD skills this role must show to back the
  // candidate's claimed years (`required`), and how many its bullets do show (`skills`).
  role_alignment?: { role: string; bullets: number; rewritten: number; added: number; skills: number; required: number }[]
  // JD skills the skills section lists, and how many of them at least one role's bullets show.
  experience_skills?: { listed: number; shown: number }
  // Set when some parts of the draft were refused by every model and left as they were (the rest is tailored).
  partial?: { failed: number; total: number; pendingRoles?: number[]; pendingProfile?: boolean }
  /** The document that came out has no line different from the one that went in. The caller should say so, not present it as tailored. */
  unchanged?: boolean
  /** Job-post terms the floor wrote onto the skills section because no pass had put them in (see THE FLOOR in runTailor). */
  placed_from_jd?: string[]
  /** Gate on: job-post terms the AI writer itself put on the skills line (not the floor's). Named in the reply as job-post terms. */
  skills_from_jd_writer?: string[]
  /** Soft skills the floor wrote into an open summary as one "Strengths:" sentence. */
  placed_in_summary?: string[]
  /** No AI writer answered in time: the file is the source resume with only its skills section brought up to the floor. */
  skills_only?: boolean
  /** Job-post terms gate (src/lib/jd-terms-gate.ts) state this result was made under. A cached result from the other state is recomputed. */
  jd_terms_gate?: "on" | "off"
  /** Gate on: experience bullets the writer gave a job-post-only term, sent back to the source text (the term went to the skills line). */
  bullets_reverted_for_jd_terms?: number
  /** Gate on: job-post terms not written into the file because skills were locked or there is no skills section. Listed in the reply. */
  jd_terms_unplaced?: string[]
  jd_terms_unplaced_reason?: JdTermsUnplacedReason
  // Real token accounting for this tailor (proof the cache is working). estCostUSD is
  // approximate — priced at Haiku 4.5 rates; cacheReadTokens bill at ~1/10th of input.
  usage?: {
    calls: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    estCostUSD: number
    /** Calls to a model with no known price. When not 0, estCostUSD is a floor, not the cost. */
    unpricedCalls?: number
    /** The same usage, per model that served it. */
    byModel?: PricedCall[]
  }
}

// ── helpers (moved out of the route so the background worker can reuse them) ───
function whatChanged(edits: Edits): string[] {
  const out: string[] = []
  if (edits.headline?.title?.trim()) out.push(`Set the header title to "${edits.headline.title.trim()}" (name & contact kept)`)
  if (edits.headline?.tagline?.trim()) out.push("Focused the header identity strip on this role")
  if ((edits.summary || "").trim()) out.push("Re-aimed the professional summary, keeping your real details")
  const sk = (edits.skills || []).filter(s => (s.text || "").trim()).length
  if (sk) out.push(`Updated ${sk} skill line${sk > 1 ? "s" : ""} with the role's key tools`)
  const bl = (edits.bullets || []).filter(b => (b.text || "").trim()).length
  if (bl) out.push(`Rewrote ${bl} experience bullet${bl > 1 ? "s" : ""} to match the JD`)
  const ad = (edits.added || []).filter(a => (a.text || "").trim()).length
  if (ad) out.push(`Added ${ad} experience bullet${ad > 1 ? "s" : ""} so each role shows the skills you list`)
  return out.length ? out : ["Reviewed against the job description"]
}

// Split the work history into contiguous groups of roughly equal bullet count (about `maxPerCall`
// bullets each), so every experience call stays small enough to answer quickly and completely.
// A skill fragment already inside a longer listed skill ("att" and "ck" in "mitre att&ck",
// "directory" in "active directory") is not counted or asked for on its own.
const padTerm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim()} `
function wholeSkills(terms: string[]): string[] {
  return terms.filter(k => !terms.some(o => padTerm(o) !== padTerm(k) && padTerm(o).includes(padTerm(k))))
}
// Certifications are listed, not demonstrated in a bullet, so they are not skills a role has to
// show (the pattern also catches pieces of cert names, e.g. "handler" from GIAC GCIH).
const CERT_TERM = /certif|comptia|giac|security\+|\b(cissp|cism|cisa|ccsp|ceh|oscp|gcih|gcia|gsec|csa|handler)\b|^[a-z]{2,3}-\d{3}$/
function provableSkills(terms: string[]): string[] {
  return wholeSkills(terms).filter(k => !CERT_TERM.test(k))
}

function normJD(jd: string): string {
  return jd.replace(/\s+/g, " ").trim().toLowerCase()
}

// The whole point of caching: re-tailoring the SAME JD against the SAME resume (the
// user re-running while testing) must be instant, not another 30-second LLM round-trip.
// Key folds in the resume's content hash and the applied feedback so a changed resume
// or new feedback produces a fresh result.
// Raised when results made before a fix must not be served again. "2": until 2026-10-05 a draft most providers had refused, or
// one with no line changed, was stored like any other, so sending the same job description again returned the same file.
// "4": results made before the resume and the JD were read as one record (J1 v3) stopped near the first draft.
// Earlier contexts could truncate explicit confirmations behind a lengthy pasted JD.
// Version 18 preserves subthreshold fractional coverage in every result field.
// Version 19 prevents a high-overlap resume with thin per-role experience coverage from being served as complete.
// Version 20 places missing job-post skills on the skills line and caches every finished run.
const CACHE_GENERATION = "20"
const inflightTailors = new Map<string, Promise<TailorResult>>()
function cacheKeyOf(jd: string, filepath: string, sourceHash: string, prefs: string[]): string {
  return createHash("sha1")
    .update([J1_VERSION, CACHE_GENERATION, normJD(jd), filepath, sourceHash, prefs.join("|")].join("::"))
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
  // headline (title + tagline) follows `summary` unless set explicitly.
  sections?: { summary?: boolean; skills?: boolean; experience?: boolean; headline?: boolean }
  mode?: "quick" | "full"
  // Time budget for this tailor when the caller already spent part of its request time (capped by TAILOR_MAX_MS).
  maxMs?: number
  // REFINEMENT: givenPath is a resume ALREADY tailored to this JD and this is the user's
  // change request for it (the WhatsApp swipe-reply). Only that change is applied.
  refine?: string
}): Promise<TailorResult> {
  const started = Date.now()
  const jd = requirementText(opts.jd).trim()
  const immediatePrefs = (opts.immediatePrefs || []).filter(s => typeof s === "string" && s.trim())
  // Second prompt: ask the model for the ATS keywords a recruiter expects for this JD
  // (synonyms, acronym expansions, implied tooling) to concat with the literal extraction.
  // Fired HERE, before resume matching/loading, so it runs CONCURRENTLY with that work and
  // costs ~no extra wall time; it self-resolves to [] on error/timeout, so it can never
  // stall or fail a tailor. TAILOR_KW_EXPAND=0 disables it.
  // Is GPT Luna in use for this tailor? One switch for the ladder below and for the keyword call here.
  const openaiOn = !!opts.keys.openai && process.env.TAILOR_USE_OPENAI !== "0" && process.env.TAILOR_USE_OPENAI !== "false"
  const keywordUsage: TokenUsage[] = []
  const expandKeywords = async (sourceResume: string, candidateInput: string): Promise<{ generated: string[]; pairs: ConfirmedVocabulary[] }> => {
    if (opts.refine) return { generated: [], pairs: [] }
    const timeoutMs = Number(process.env.TAILOR_KW_EXPAND_MS) || 10000
    const [generated, pairs] = await Promise.all([
      expandJdKeywordsTwice({ keys: opts.keys, jd, known: extractJdKeywords(jd), sourceResume, candidateInput, timeoutMs, usageSink: keywordUsage }),
      expandConfirmedVocabulary({ keys: opts.keys, confirmed: immediatePrefs, sourceResume, timeoutMs, usageSink: keywordUsage }),
    ])
    return { generated, pairs }
  }
  // Start only after a cache miss; both Gemini passes finish before generation.
  let kwExpandPromise: Promise<{ generated: string[]; pairs: ConfirmedVocabulary[] }> | null = null

  // 1) Pick the resume (cheap — no LLM).
  let matched: { filepath: string; filename: string; category: string }
  let rankedCandidates: TailorResult["ranked_candidates"] = []
  if (opts.givenPath) {
    const resolved = path.resolve(opts.givenPath)
    const baseDir = path.resolve(opts.userResumeDir)
    // Prefix confusion: a bare startsWith lets a SIBLING directory whose name
    // begins with the allowed path pass ("/u/demo" also matches "/u/demo2").
    if (!(resolved === baseDir || resolved.startsWith(baseDir + path.sep))) {
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
  // FULL-QUALITY default: a comprehensive, keyword-dense rewrite for maximum JD coverage —
  // NEVER hold back on quality. On the free providers (Gemini/Groq) output tokens cost
  // nothing, so there is no reason to minimize edits. The old "cost mode" cap traded
  // coverage for fewer tokens; it is now OPT-IN via TAILOR_COST_MODE=1, only for someone
  // running a paid per-token model who explicitly wants to trade thoroughness for spend.
  const DEFAULT_PREFS = (process.env.TAILOR_COST_MODE === "1" || process.env.TAILOR_COST_MODE === "true")
    ? [
        "COST MODE — MINIMIZE edits (fewer rewrites = lower cost). Change ONLY: the summary; AT MOST 8 skill lines (only clarify skills already supported by the baseline); and AT MOST 5 bullets, all in the CURRENT role. Leave EVERY other line exactly as it is. Use the JD's exact keyword wording so ATS still matches.",
      ]
    : [
        "More specific, less generic — concrete tools, systems, and outcomes, never vague filler",
        "SOURCE FACT CONTRACT: the baseline resume and explicit candidate confirmations supply experience facts; the JD supplies target requirements only. Incorporate confirmed skills even if absent from the older baseline. Use exact JD terms where supported by either source, respecting role-specific attribution. Never invent certifications, experience years, job titles, platforms, employers, project implementations, or dates.",
        "More technical detail — name the exact technologies, protocols, and methods used",
      ]
  const candidateInput = candidateEvidenceInput(opts.jd, immediatePrefs)
  const explicit = [`CANDIDATE-SUPPLIED INPUT (separate explicit first-person experience confirmations from employer requirements; the JD alone is not a confirmation):\n${candidateInput}`, ...immediatePrefs, ...storedFeedback.filter(f => !immediatePrefs.includes(f))]
  // A refinement carries ONLY the user's request. The default "more keywords / more detail"
  // prefs would make the model rewrite lines the user already accepted, so a small change
  // ("shorten the second bullet") would come back as a different resume.
  const refine = (opts.refine || "").trim()
  const allPrefs = refine
    ? [refine.slice(0, 1500)] // adapt() runs it as the change request under REFINE_RULES
    : [...explicit, ...DEFAULT_PREFS.filter(d => !explicit.includes(d))]

  // 2) Cache check — instant return for an identical re-run. One-page vs full are
  // distinct outputs, so the mode is folded into the cache key.
  const _sec = { summary: false, headline: false, ...opts.sections }
  const _secSig = `sec:${_sec.summary === false ? 0 : 1}${_sec.skills === false ? 0 : 1}${_sec.experience === false ? 0 : 1}${_sec.headline === undefined ? "" : _sec.headline ? "h1" : "h0"}`
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
      if (!cached.keyword_analysis || !cached.diff || (!refine && (!Number.isFinite(cached.supported_coverage) || !Array.isArray(cached.unsupported_keywords)))) throw new Error("stale cache shape")
      if ((cached.jd_terms_gate ?? "off") !== (jdTermsGateOn() ? "on" : "off")) throw new Error("stale cache shape")
      // A stored run the delivery checks refuse is not replayed (blueprint 2026-10-30): the next request redraws it.
      // TAILOR_CACHE_SKIP_REFUSED=0 restores replay of every finished run.
      if (cacheSkipRefusedOn() && refusedForReplay(cached)) throw new Error("refused result")
      // A finished run is replayed at any coverage. The generation in the key drops
      // results made before labelled job-post skills were written back onto the line.
      return { ...cached, cached: true, elapsed_ms: Date.now() - started }
    } catch { /* miss → generate */ }
  }

  // An identical request that arrives while this one is still running (a double-click,
  // or a retry after the caller timed out) waits for it and shares the result.
  // It does not start a second paid model ladder.
  if (!opts.noCache) {
    const existing = inflightTailors.get(key)
    if (existing) {
      const shared = await existing
      return { ...shared, cached: true, elapsed_ms: Date.now() - started }
    }
    let resolveWork: (result: TailorResult) => void = () => {}
    let rejectWork: (error: unknown) => void = () => {}
    const work = new Promise<TailorResult>((resolve, reject) => { resolveWork = resolve; rejectWork = reject })
    inflightTailors.set(key, work)
    void runTailor({ ...opts, noCache: true }).then(
      result => resolveWork(result),
      error => rejectWork(error),
    ).finally(() => { if (inflightTailors.get(key) === work) inflightTailors.delete(key) })
    return work
  }

  // 3) Generate — SMART MODEL LADDER (token-aware quality).
  const zones = await extractZones(buf)
  // The tailoring target is the JD's OWN keywords (domain-agnostic extraction), not a
  // fixed vocab — so this works for ANY job description without hand-curated per-domain
  // terms. Coverage = which of those literally appear in the resume.
  // Literal extraction from the JD, PLUS the model-generated keywords.
  // These play DIFFERENT roles on purpose:
  //   • jdKws (extracted only) drives coverage SCORING and the climb decision. Generated
  //     synonyms are "nice to have", so counting them tanked coverage (95%→87%), which
  //     tripped the climb on every run and pushed tailors to ~60s.
  //   • jdKwsPrompt (the union) is what the MODEL sees — so the expansions still get
  //     woven into the resume, which is the part an ATS actually reads.
  // Result: richer keywords in the document, without the extra escalation or the delay.
  const jdExtracted = extractJdKeywords(jd)
  const expanded = await (kwExpandPromise ??= expandKeywords(text, candidateInput))
  const jdGenerated = expanded.generated.filter(k => !jdExtracted.includes(k))
  const relationalPairs: RelationalPair[] = expanded.pairs
  // Since 19 Oct 2026 the target is the job post's own terms AND Gemini's skill-like suggestions, together, cleaned of
  // generic words and fragments (owner: "give this to gemini free api for more keywords ... then concatenate both given
  // user input and that results"). The full set is scored and shown to the model, but deterministic placement and
  // mandatory repair apply only where the baseline or the candidate's own statement supplies evidence.
  // Since 26 Oct 2026 the MATCH is scored on the post's own terms only (scoreKws), with qualifications and words that
  // are not skills left out (a clearance, a degree, a rank, a benefit, a place: isQualificationOrJunk), so the floor at
  // the end can meet it honestly and a resume made earlier is checked against the same set (made-floor.ts). Gemini's
  // suggestions stay targets for the writer (jdKws, jdKwsPrompt), never for the score or the floor.
  // The job-post terms switch (JD_TERMS_ALWAYS_ON_SKILLS, default on), read once per run.
  const jdGate = jdTermsGateOn()
  const scoreKws = floorTerms(jd, targetKeywords(jdExtracted, [], jd))
  const jdKws = [...new Set([...targetKeywords(jdExtracted, jdGenerated, jd).filter(k => !isQualificationOrJunk(k)), ...scoreKws])]
  const floorKws = new Set(floorTerms(jd, scoreKws))
  const shareOf = (shown: Set<string>) => (scoreKws.length ? scoreKws.filter(k => shown.has(k)).length / scoreKws.length : 1)
  const forcedJdKws = explicitlyConfirmsAllRequirements(immediatePrefs)
    ? jdKws
    : [...coveredJdKeywords([text, ...immediatePrefs].join("\n"), jdKws)].filter(k => jdKws.includes(k))
  // The JD is target context, not evidence. Only verified terms are mandatory in
  // rewrite prompts; chasing every JD phrase caused fabricated skills and timeouts.
  const jdKwsPrompt = [...new Set(forcedJdKws)]
  const beforeKw = coveredJdKeywords(text, jdKws)
  const matchedOn = [...beforeKw]
  const kwMatched = scoreKws.filter(k => beforeKw.has(k))
  const tier: "light" | "heavy" = estimateYears(text) >= 7 ? "heavy" : "light"

  // COST-ORDERED MODEL LADDER (cheapest capable model first; escalate ONLY for the
  // resumes that actually need it). Every tailor starts on a near-free model; we only
  // pay for a stronger model when a pass is still under the ATS coverage target — so
  // easy resumes stay cheap, and the hard ones climb Haiku → Sonnet → Opus for the
  // near-100% match the user wants. Since resumes are pre-made per domain (~70% already),
  // the top of the ladder only has to weave in the remaining JD-specific keywords.
  const E = process.env
  const LADDER: { pref: ProviderPref; model?: string; label: string }[] = []
  // PROVIDER ORDER. Default = Claude Haiku FIRST — the user's trusted quality baseline
  // (~98% match). The free providers (Gemini Flash-Lite, then Groq) sit right below as
  // AUTOMATIC fallbacks: used only if Claude errors or rate-limits, which also gives $0
  // resilience and helps under concurrent load. Quality is never compromised — every model
  // gets the same full, comprehensive rewrite prompt. Set TAILOR_FREE_FIRST=1 to instead
  // prefer the free providers first (Gemini → Groq → Claude) when you want $0 over Claude.
  // FREE-FIRST ladder. Claude is a single switch: TAILOR_USE_CLAUDE=0 removes it from the
  // ladder ENTIRELY (used while the Anthropic account has no credit — its API returns a
  // hard 400 "credit balance is too low", which is not retryable). Flip it back to 1 the
  // moment credits are topped up and Claude rejoins as the quality fallback. The three free
  // providers each sit on a SEPARATE rate limit, so if one 429s the next still answers.
  const claudeOn = !!opts.keys.anthropic && E.TAILOR_USE_CLAUDE !== "0" && E.TAILOR_USE_CLAUDE !== "false"
  const claudeStep = { pref: "anthropic" as ProviderPref, model: E.CLAUDE_MODEL_HEAVY || "claude-haiku-4-5", label: E.CLAUDE_MODEL_HEAVY || "claude-haiku-4-5" }
  const freeSteps: { pref: ProviderPref; model?: string; label: string }[] = []
  if (!!opts.keys.gemini && E.TAILOR_USE_GEMINI !== "0" && E.TAILOR_USE_GEMINI !== "false")
    freeSteps.push({ pref: "gemini", model: E.GEMINI_MODEL_HEAVY || "gemini-3.5-flash-lite", label: E.GEMINI_MODEL_HEAVY || "gemini-3.5-flash-lite" })
  if (!!opts.keys.groq && E.TAILOR_USE_GROQ !== "0" && E.TAILOR_USE_GROQ !== "false")
    freeSteps.push({ pref: "groq", model: E.GROQ_MODEL_HEAVY || "openai/gpt-oss-120b", label: E.GROQ_MODEL_HEAVY || "openai/gpt-oss-120b" })
  // OpenRouter last of the free tier: its :free models are frequently 429 rate-limited, so
  // it is a genuine last resort rather than something to lead with. Pin a model with
  // OPENROUTER_MODEL_HEAVY — never use the "openrouter/free" auto-router, which happily
  // routes to unrelated models (it returned a content-safety verdict instead of the JSON).
  if (!!opts.keys.openrouter && E.TAILOR_USE_OPENROUTER !== "0" && E.TAILOR_USE_OPENROUTER !== "false")
    freeSteps.push({ pref: "openrouter", model: E.OPENROUTER_MODEL_HEAVY || "z-ai/glm-5.2:free", label: E.OPENROUTER_MODEL_HEAVY || "z-ai/glm-5.2:free" })
  if (claudeOn && E.TAILOR_FREE_FIRST !== "1" && E.TAILOR_FREE_FIRST !== "true") LADDER.push(claudeStep, ...freeSteps)
  else if (claudeOn) LADDER.push(...freeSteps, claudeStep)
  else LADDER.push(...freeSteps)
  // Sonnet is now OPT-IN only (TAILOR_USE_SONNET=1). It's 3x Haiku's price and was a big
  // part of the cost overrun, so by default it is NEVER used — not even as a fallback.
  if (E.TAILOR_USE_SONNET === "1" || E.TAILOR_USE_SONNET === "true") {
    LADDER.push({ pref: "anthropic", model: E.CLAUDE_MODEL_STRONG || "claude-sonnet-4-5", label: E.CLAUDE_MODEL_STRONG || "claude-sonnet-4-5" })
  }
  // Opus is OPT-IN only (TAILOR_USE_OPUS=1). Measured: on a dense JD it ran a ~45s full
  // redraft AFTER Sonnet and added ZERO coverage (the remaining terms were honestly
  // un-addable), so by default we cap at Sonnet — near-identical coverage, ~45s faster.
  if (E.TAILOR_USE_OPUS === "1" || E.TAILOR_USE_OPUS === "true") {
    LADDER.push({ pref: "anthropic", model: E.CLAUDE_MODEL_MAX || "claude-opus-5", label: E.CLAUDE_MODEL_MAX || "claude-opus-5" })
  }
  // GPT Luna leads when this caller was handed the OpenAI key, which tailorKeys() in llm.ts does for every tailor
  // ("reroute to them use OPEN_API_KEY", 2026-10-05). The free providers stand behind it.
  const lunaStep = { pref: "openai" as ProviderPref, model: E.OPENAI_MODEL_TAILOR || E.OPENAI_MODEL || "gpt-6-luna", label: E.OPENAI_MODEL_TAILOR || E.OPENAI_MODEL || "gpt-6-luna" }
  if (openaiOn) LADDER.unshift(lunaStep)
  // Keep only steps whose provider key exists (preserving cheap→strong order); if the
  // user pinned a provider via opts.pref, honour it as a single fixed step.
  const keyed = (p: ProviderPref) => p !== "auto" && !!opts.keys[p as keyof typeof opts.keys]
  let steps = LADDER.filter(s => keyed(s.pref))
  if (opts.pref && opts.pref !== "auto") steps = LADDER.filter(s => s.pref === opts.pref || (s === lunaStep && keyed(s.pref)))
  if (!steps.length) steps = [{ pref: "auto", model: undefined, label: "auto" }]

  // LANES: one (provider, model) pair each, because a provider counts its limits per model. See tailorLanes.ts.
  //   GROQ_MODELS_EXTRA / OPENROUTER_MODELS_EXTRA  comma-separated model ids; set either to an empty value to use none.
  // The standard extras are the models that answered on this deployment's keys when measured on 2026-10-05.
  const lanes: Lane[] = steps.flatMap((s): Lane[] => {
    const extra = s.pref === "groq" ? extraModels(E.GROQ_MODELS_EXTRA, "qwen/qwen3.8-27b,openai/gpt-oss-20b")
      : s.pref === "openrouter" ? extraModels(E.OPENROUTER_MODELS_EXTRA, "nvidia/nemotron-3-super-120b-a12b:free")
      : []
    // A lane is named after the model it really calls. For the free providers that is the provider's own choice for the
    // tier (its light model in quick mode), which is not always the model the step is labelled with: a quick tailor on Groq
    // was reported as written by gpt-oss-120b while gpt-oss-20b wrote it, and 20b was then asked a second time as an "extra"
    // lane while 120b was never asked (found in review, 2026-10-05).
    const own = s.pref === "gemini" || s.pref === "groq" || s.pref === "openrouter" ? modelFor(s.pref, opts.mode === "quick" ? "light" : "heavy") : s.model
    const first: Lane = s.pref === "anthropic" || s.pref === "auto" ? { ...s } : { pref: s.pref, model: own, label: own || s.label, exact: true }
    return [first, ...extra.filter(m => m !== own).map(m => ({ pref: s.pref, model: m, label: m, exact: true }))]
  })
  const laneOut: LaneOut = new Map()
  // An exact lane IS its model; a Claude lane passes its model the old way (callLLM honours a claude-* id for Anthropic).
  const laneCall = (lane: Lane) => ({ pref: lane.pref, model: lane.model, exactModel: lane.exact ? lane.model : undefined })

  const sec = { summary: false, headline: false, ...opts.sections }
  const scopeEdits = (raw: Edits): Edits => ({
    // Section scope: only enhance the sections the user chose (default = all).
    headline: (sec.headline ?? sec.summary) === false ? { title: "", tagline: "" } : raw.headline,
    summary:  sec.summary === false ? "" : raw.summary,
    skills:   sec.skills === false ? [] : raw.skills,
    bullets:  sec.experience === false ? [] : raw.bullets,
    extras:   raw.extras,
  })

  // ── Work-history measurement (full retarget) ──
  // Tailoring used to land the JD in the skill lines and the current role only: on real resumes every older role got 0
  // rewritten bullets, so skills the candidate lists never showed up in their client experience. Drafts are split per
  // section, ranked on every role, and each role's measured gap is filled.
  const splitDraft = !refine && opts.mode !== "quick" && sec.experience !== false && zones.roles.length > 0
  const roleGroups = splitDraft ? zones.roles.map((_, i) => [i]) : []
  const bulletBefore = new Map<number, string>()
  for (const r of zones.roles) for (const b of r.bullets) bulletBefore.set(b.idx, b.text)
  // Some source paragraphs hold several bullets glued together ("• A.• B.• C."). A rewrite that
  // collapses them into fewer parts silently deletes content, so it is not applied.
  const glyphs = (s: string) => (s.match(/•/g) || []).length
  const keepsParts = (idx: number, text: string) => {
    const parts = glyphs(bulletBefore.get(idx) || "")
    return parts < 2 || glyphs(text) >= parts
  }
  // idx → new text, for the bullets an edit set actually changed.
  const rewrites = (edits: Edits) => new Map(
    (edits.bullets || [])
      .filter(b => (b.text || "").trim() && b.text.trim() !== (bulletBefore.get(b.idx) || "").trim())
      .map(b => [b.idx, b.text] as [number, string]),
  )
  const skillEdits = (edits: Edits) => new Map(
    (edits.skills || []).filter(s => (s.text || "").trim()).map(s => [s.idx, s.text] as [number, string]),
  )
  const skillsText = (edits: Edits) => {
    const sk = skillEdits(edits)
    return zones.skills.map(s => sk.get(s.idx) ?? s.text).join("\n")
  }
  // Roles that count (a one-line "role" is usually a stray date line), and the ones a draft left
  // essentially untouched: under ~30% of their bullets rewritten.
  const countedRoles = zones.roles.map((_, i) => i).filter(i => zones.roles[i].bullets.length >= 2)
  const lackingRoles = (edits: Edits): number[] => {
    if (!splitDraft) return []
    const rw = rewrites(edits)
    return countedRoles.filter(i => {
      const bullets = zones.roles[i].bullets
      return bullets.filter(b => rw.has(b.idx)).length < Math.max(1, Math.ceil(bullets.length * 0.3))
    })
  }
  // YEARS MATH: a skill claimed for N years has to show up in the bullets of enough roles to cover N years, counting back
  // from the most recent role. The claim comes from the skill's own line ("Splunk (5+ years)"), else the summary
  // ("9+ years of experience"). With no stated years, a listed skill has to show in EVERY role.
  const YEARS_RE = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/i
  const summaryYears = Number(zones.summaryText.match(YEARS_RE)?.[1]) || null
  const spans = zones.roles.map(r => roleSpanMonths(r.role) ?? 0)
  const rolesForYears = (years: number | null): number[] => {
    if (!years) return countedRoles
    const out: number[] = []
    let months = 0
    for (const i of countedRoles) {
      out.push(i)
      months += spans[i]
      if (months >= years * 12) break
    }
    return out
  }
  // New bullets per role (each is anchored after its role's last bullet).
  const roleOfLastBullet = new Map(zones.roles.map((r, i) => [r.bullets[r.bullets.length - 1]?.idx, i] as [number, number]))
  const addedFor = (edits: Edits): string[][] => {
    const out = zones.roles.map(() => [] as string[])
    for (const a of edits.added || []) {
      const i = roleOfLastBullet.get(a.after)
      if (i !== undefined && (a.text || "").trim()) out[i].push(a.text.trim())
    }
    return out
  }
  // The resume as a draft left it. A gap-fill pass must build on the draft's text, or its rewrites would replace keywords
  // the draft already put in.
  const zonesAfter = (edits: Edits): Zones => {
    const rw = rewrites(edits)
    const sk = skillEdits(edits)
    const added = addedFor(edits)
    return {
      ...zones,
      skills: zones.skills.map(s => ({ ...s, text: sk.get(s.idx) ?? s.text })),
      roles: zones.roles.map((r, i) => ({ ...r, bullets: r.bullets.map(b => ({ ...b, text: rw.get(b.idx) ?? b.text })), added: added[i] })),
    }
  }
  // claimedKw: JD skills the skill lines list. required[i]: the listed skills role i must show (years math). roleKw[i]: the
  // required ones its bullets (rewritten and added) do show. provenKw: the listed skills any bullet shows. A skill listed
  // but shown at no client reads as padding to a recruiter.
  // `dropped`: paragraphs a one-page condense removed, kept so the change list can show them and the person can undo them.
  type Pass = { edits: Edits; dropped: number[]; buffer: Buffer; notes: string[]; tailoredText: string; cov: number; afterKw: Set<string>; claimedKw: Set<string>; roleKw: Set<string>[]; required: string[][]; provenKw: Set<string>; via?: string; partial?: { failed: number; total: number; pendingRoles?: number[]; pendingProfile?: boolean }; floor?: string[]; floorSummary?: string[] }
  // Apply a finished edit set to the docx and measure JD keyword coverage. Auto-tailoring
  // is the only path allowed to physically drop bullets (the manual builder never gets a
  // dropIdx), so a user's own edits are never silently trimmed.
  const applyEdits = async (edits: Edits): Promise<Pass> => {
    edits = constrainResumeEdits(edits, zones)
    edits.skills = preserveSkillHeadings(zones.skills, edits.skills || [])
    edits = { ...edits, bullets: (edits.bullets || []).filter(b => keepsParts(b.idx, b.text || "")), added: [] }
    // FORMAT-PRESERVING by default: never delete paragraphs, so the tailored resume
    // keeps the EXACT layout, bullet count, and structure of the source — we only
    // rewrite existing lines in place. Bullet trimming (capRoleBullets) is allowed
    // ONLY when the user explicitly asked for a one-page condense.
    const dropIdx = opts.onePage ? capRoleBullets(zones, edits) : new Set<number>()
    const { buffer, notes } = await applyRewrites(buf, edits, zones, { dropIdx })
    const tailoredText = await extractText(buffer)
    const afterKw = coveredJdKeywords(tailoredText, jdKws)
    const cov = shareOf(afterKw)
    // Optional enrichment helps writing, but never creates mandatory experience requirements.
    const listed = provableSkills(requiredEvidenceTerms(jdKws, [...coveredJdKeywords(skillsText(edits), jdKwsPrompt)]))
    // Years claimed per listed skill: its own skill line's "N+ years", else the summary's.
    const sk = skillEdits(edits)
    const skillYears = new Map<string, number>()
    for (const s of zones.skills) {
      const line = sk.get(s.idx) ?? s.text
      const y = Number(line.match(YEARS_RE)?.[1])
      if (y) for (const k of coveredJdKeywords(line, listed)) skillYears.set(k, Math.max(y, skillYears.get(k) || 0))
    }
    // Require a named skill in a client's bullets ONLY where the original
    // client record already evidences that skill. Earlier "years math" forced
    // every listed skill into every role (including unrelated clients), making
    // 100% supported global coverage fail the per-role gate and inviting
    // fabricated work histories. Explicit years can narrow a role window,
    // but can never create role evidence on their own.
    const required = zones.roles.map((r, i) => {
      const evidenced = coveredJdKeywords(r.bullets.map(b => b.text).join("\n"), listed)
      return listed.filter(k => evidenced.has(k) &&
        (!skillYears.has(k) && !summaryYears ||
          rolesForYears(skillYears.get(k) || summaryYears).includes(i)))
    })
    const rw = rewrites(edits)
    const added = addedFor(edits)
    const roleText = zones.roles.map((r, i) => [...r.bullets.map(b => rw.get(b.idx) ?? b.text), ...added[i]].join("\n"))
    const roleKw = zones.roles.map((_, i) => coveredJdKeywords(roleText[i], required[i]))
    const provenKw = coveredJdKeywords(roleText.join("\n"), listed)
    return { edits, dropped: [...dropIdx], buffer, notes, tailoredText, cov, afterKw, claimedKw: new Set(listed), roleKw, required, provenKw }
  }
  // A generation pass on a given model. A full retarget runs as parallel calls: one for the
  // profile (headline, summary, skills) and one per role group for the bullets, so every role
  // gets a dedicated pass and a long reply can't run out before the older roles. Quick mode and
  // refinements stay one call. On escalation we pass the exact JD terms still missing.
  const draftPass = async (step: Lane, extraPrefs: string[]): Promise<Pass> => {
    const prefs = [...allPrefs, ...extraPrefs].filter(Boolean)
    const call = { keys: opts.keys, jd, zones, sections: sec, preferences: prefs.join("; "), jdKeywords: jdKwsPrompt, onePage: opts.onePage, mode: opts.mode, usageSink, refine: !!refine }
    let raw: Edits
    let partsFailed = 0, partsTotal = 0
    let pendingRoles: number[] = [], pendingProfile = false
    let via = step.label ?? step.model ?? String(step.pref)
    if (splitDraft) {
      // The draft is a list of parts: the profile, then each group of roles (current role first). workParts hands them to the
      // lanes: a healthy first provider writes them all in one burst, and when it is down they spread over whatever answers.
      type Part = { kind: "profile" | "experience"; roles?: number[] }
      const wantProfile = sec.skills !== false || sec.summary !== false || (sec.headline ?? sec.summary) !== false
      const parts: Part[] = [...(wantProfile ? [{ kind: "profile" as const }] : []), ...roleGroups.map(g => ({ kind: "experience" as const, roles: g }))]
      // Does a reply change anything this tailor will keep? (An empty one from a free model is offered to another lane.)
      const says = (part: Part, e: Edits): boolean => part.kind === "experience"
        ? (e.bullets || []).some(b => (b.text || "").trim() && b.text.trim() !== (bulletBefore.get(b.idx) || "").trim())
        : (sec.skills !== false && (e.skills || []).some(k => (k.text || "").trim()))
          || (sec.summary !== false && !!(e.summary || "").trim())
          || ((sec.headline ?? sec.summary) !== false && !!`${e.headline?.title || ""}${e.headline?.tagline || ""}`.trim())
      const worked = await workParts<Part, Edits>({
        parts, lanes, out: laneOut, says,
        ask: (part, lane) => {
          const rolePlan = (part.roles || []).map(i => {
            const role = zones.roles[i]
            const supported = [...coveredJdKeywords(role.bullets.map(b => b.text).join("\n"), jdKwsPrompt)]
            return `ROLE #${i}: preserve and develop these source-supported JD skills into substantive action and purpose/result bullets: ${supported.join(", ") || "identify relevant transferable work in the source"}. Review every bullet, retaining its factual context. Use equivalent exact JD terminology where the meaning is supported. Do not turn bullets into skill lists or repeat identical points across clients.`
          }).join("\n")
          return adapt({ ...call, preferences: [call.preferences, rolePlan].filter(Boolean).join("\n"), ...laneCall(lane), part: part.kind, roles: part.roles })
        },
        startBy: deadline - repairReserve - 6000,     // a call started later than this would not be back in time
        assembleBy: deadline - repairReserve,  // what is still running then is left behind; the draft is made of what came back
      })
      const done = worked.filter(w => w.e)
      const total = worked.length, failed = total - done.length
      if (!done.length) throw worked.find(w => w.err)?.err ?? new Error("Tailoring draft came back empty")
      // Most of it refused on every lane: that is not a draft. Failing here lets the caller say so.
      if (failed * 2 > total) throw new Error(`Tailoring incomplete: the AI providers refused ${failed} of ${total} parts of the draft.`)
      partsFailed = failed; partsTotal = total
      pendingRoles = worked.filter(w => !w.e && w.part.kind === "experience").flatMap(w => w.part.roles || [])
      pendingProfile = worked.some(w => !w.e && w.part.kind === "profile")
      const profile = worked.find(w => w.part.kind === "profile")?.e
      raw = { headline: profile?.headline, summary: profile?.summary || "", skills: profile?.skills || [], bullets: worked.filter(w => w.part.kind === "experience").flatMap(w => w.e?.bullets || []), extras: [] }
      via = [...new Set(done.map(w => w.via))].join(" + ")
    } else {
      raw = await adapt({ ...call, ...laneCall(step) })
    }
    const pass = await applyEdits(scopeEdits(raw))
    if (partsFailed) pass.partial = { failed: partsFailed, total: partsTotal, pendingRoles, pendingProfile }
    // Tag with the model(s) that actually produced this draft: when the parts were spread, the notes name every one.
    pass.via = via
    return pass
  }

  // MarketFit contract: a user supplied/approved JD is a KNOWN JD — the resume and the JD are one record (J1 v3). 98%
  // literal JD coverage is the target: the terms still missing are named to the first pass, and each role's gap is then
  // filled until the target or the deadline.
  const usageSink: TokenUsage[] = keywordUsage
  const MIN_KEYWORD_COVERAGE = RESUME_MIN_COVERAGE
  const TARGET_COVERAGE = Math.max(MIN_KEYWORD_COVERAGE, Math.min(1, Number(E.TAILOR_TARGET_COVERAGE) || RESUME_TARGET_COVERAGE))
  const TAILOR_MAX_MS = Math.max(1000, Math.min(opts.maxMs || Number(E.TAILOR_MAX_MS) || 52000, 280000))
  const repairReserve = Math.min(150000, Math.floor(TAILOR_MAX_MS * .6))
  const deadline = started + TAILOR_MAX_MS
  const MIN_CLIMB_MS = Number(E.TAILOR_MIN_CLIMB_MS) || 9000
  const summaryWanted = sec.summary !== false
  // A full retarget is ranked on the whole resume AND on how well EACH client role shows the listed JD skills, with a
  // penalty per untouched role: keywords that sit only in the skills section or the current role lose.
  const roleReflect = (p: Pass) => {
    const roles = countedRoles.filter(i => p.required[i].length)
    if (!roles.length) return 1
    return roles.reduce((s, i) => s + p.roleKw[i].size / p.required[i].length, 0) / roles.length
  }
  const roleShare = (p: Pass) => (countedRoles.length ? 1 - lackingRoles(p.edits).length / countedRoles.length : 1)
  const provenShare = (p: Pass) => (p.claimedKw.size ? p.provenKw.size / p.claimedKw.size : 1)
  const supportedShare = (p: Pass) => forcedJdKws.length
    ? coveredJdKeywords(p.tailoredText, forcedJdKws).size / forcedJdKws.length : 0
  const unsupportedPenalty = (p: Pass) => scoreKws.length
    ? scoreKws.filter(k => !forcedJdKws.includes(k) && p.afterKw.has(k)).length / scoreKws.length : 0
  const quality = (p: Pass) =>
    (splitDraft ? 0.4 * supportedShare(p) + 0.3 * roleReflect(p) + 0.3 * provenShare(p) - 0.25 * (1 - roleShare(p)) : supportedShare(p))
    - 0.3 * unsupportedPenalty(p)
    - (summaryWanted && !(p.edits.summary || "").trim() ? 0.08 : 0) - .05 * (p.partial?.failed || 0)
  // The JD terms still missing, computed from the resume with no model call, so the pass targets the gap.
  const injectFor = (covered: Set<string>): string[] => {
    const missing = forcedJdKws.filter(k => !covered.has(k))
    if (!missing.length) return []
    return [`ATS COVERAGE (rewrite existing lines in place): ensure these JD terms appear, weaving EACH one into the experience bullets of the roles where it fits (and its matching skill line) using the JD's exact wording: ${missing.join(", ")}`]
  }

  // GAP FILL (full retarget): every role must show each listed JD skill the years math requires of it, and no role may be
  // left untouched. Roles short of that get a bullets-only pass each, built on the draft's own text and merged by [idx];
  // when a role's bullets can't carry all its skills (about 3 per bullet) the pass ADDS bullets to it. Repeats while it
  // keeps helping and time allows (TAILOR_FILL_ROUNDS, default 3).
  const FILL_ROUNDS = Math.max(0, Number(E.TAILOR_FILL_ROUNDS ?? 5))
  const fillGaps = async (start: Pass): Promise<Pass> => {
    let cur = start
    for (let round = 0; round < FILL_ROUNDS; round++) {
      if (deadline - Date.now() < MIN_CLIMB_MS) break
      const lacking = new Set(lackingRoles(cur.edits))
      const view = zonesAfter(cur.edits)
      const todo: { role: number; skills: string[]; add: number }[] = []
      // Repair every relevant role using the full JD set, not just skills already
      // listed in the generated skills section. Only the source establishes evidence.
      const unseen = forcedJdKws.filter(k => !cur.afterKw.has(k))
      // Profile repair is essential: the first pass can omit an entire skill category.
      if (sec.skills !== false && (unseen.length || cur.partial)) todo.push({ role: -1, skills: unseen, add: 0 })
      for (const i of countedRoles) {
        const sourceTerms = coveredJdKeywords(zones.roles[i].bullets.map(b => b.text).join("\n"), jdKwsPrompt)
        const currentTerms = coveredJdKeywords(view.roles[i].bullets.map(b => b.text).concat(view.roles[i].added || []).join("\n"), jdKwsPrompt)
        const supportedMissing = [...sourceTerms].filter(k => !currentTerms.has(k))
        const missing = [...new Set([...cur.required[i].filter(k => !cur.roleKw[i].has(k)), ...supportedMissing, ...unseen])]
        if (!missing.length && !lacking.has(i) && !cur.partial?.pendingRoles?.includes(i)) continue
        const add = 0 // Preserve the original paragraph count and format.
        todo.push({ role: i, skills: missing, add })
      }
      if (!todo.length) break
      // One call per role that still has a gap: asked alongside other roles, a role tended to be skipped.
      const roundDeadline = Math.min(deadline - 2000, Date.now() + Math.max(15000, Math.floor((deadline - Date.now() - 2000) / (FILL_ROUNDS - round))))
      const worked = await workParts<typeof todo[number], Edits>({
        parts: todo, lanes: [...lanes.slice(round % lanes.length), ...lanes.slice(0, round % lanes.length)], out: laneOut,
        says: (t, e) => t.role < 0 ? !!e.skills?.length : !!e.bullets?.length,
        ask: (t, lane) => {
          if (t.role < 0) return adapt({ keys: opts.keys, jd, zones: view, sections: sec,
            preferences: [...allPrefs, `SKILLS REPAIR: preserve every already-covered JD term. Review ALL skill categories against the original evidence below. Incorporate missing exact JD terms and supported equivalent terminology under the correct existing category, without unsupported claims. Missing terms: ${t.skills.join(", ")}. Original evidence: ${text}`].join("\n"),
            jdKeywords: jdKwsPrompt, mode: opts.mode, usageSink, part: "profile", ...laneCall(lane) })
          const parts = [
            lacking.has(t.role) ? "not tailored yet, so rewrite at least half of its bullets for this JD" : "",
            t.skills.length ? `its bullets must show ${t.skills.join(", ")}` : "",
            t.add ? `return EXACTLY ${t.add} new bullet${t.add === 1 ? "" : "s"} for it in "added" (role ${t.role}), covering the skills its existing bullets can't carry` : "",
          ].filter(Boolean)
          const originalEvidence = zones.roles[t.role].bullets.map(b => `[${b.idx}] ${b.text}`).join("\n")
          const ask = `ORIGINAL ROLE EVIDENCE (use this to recover relevant facts that the first pass missed):\n${originalEvidence}\nGAP FILL: this resume is already tailored to the JD. The baseline resume AND explicit candidate confirmations in the supplied input are the factual record; the JD alone is a target, not proof of experience. Recover confirmed experience even when it was absent from the baseline, respecting the confirmed role scope. Map each missing requirement to specific original work, including synonymous and transferable responsibilities. The exact JD phrase need not already occur in the original: rewrite equivalent work using the target terminology. Named products still require source evidence. Include each supported term with the action performed, technical context and purpose or documented result. Keep every JD term its bullets already carry. Rewrite bullets that don't carry a JD skill yet so each shows two or three related skills and what the candidate did with them at this client (never a bare list), preserving this client's original paragraph structure. Certifications stay out of the bullets. ROLE #${t.role} (${zones.roles[t.role].role.replace(/\s+/g, " ").trim()}): ${parts.join("; ")}`
          return adapt({ keys: opts.keys, jd, zones: view, sections: sec, preferences: [...allPrefs, ask].join("; "), jdKeywords: jdKwsPrompt, onePage: opts.onePage, mode: opts.mode, usageSink, part: "experience", roles: [t.role], allowAdd: false, ...laneCall(lane) })
        },
        startBy: roundDeadline - 6000,
        assembleBy: roundDeadline,
      })
      // Accept each successful section independently. One regressing role must not
      // discard improvements in the skills section or another client role.
      cur = await acceptImprovingRepairs(cur, worked.filter(w => w.e), async (current, w) => {
        const next = await applyEdits({ ...current.edits,
          skills: w.part.role < 0 ? mergeIndexedEdits(current.edits.skills || [], w.e!.skills || []) : current.edits.skills,
          bullets: w.part.role >= 0 ? mergeIndexedEdits(current.edits.bullets || [], w.e!.bullets || []) : current.edits.bullets,
        })
        next.via = [current.via, w.via].filter(Boolean).join(" + ")
        next.partial = current.partial
        if (current.partial) {
          const pendingRoles = (current.partial.pendingRoles || []).filter(i => i !== w.part.role)
          const pendingProfile = !!current.partial.pendingProfile && w.part.role !== -1
          const failed = pendingRoles.length + Number(pendingProfile)
          next.partial = failed ? { ...current.partial, failed, pendingRoles, pendingProfile } : undefined
        }
        return next
      }, quality)
      if (!cur.partial && supportedShare(cur) >= TARGET_COVERAGE && !countedRoles.some(i => cur.required[i].some(k => !cur.roleKw[i].has(k)))) break
    }
    return cur
  }

  // Every evidence-supported target term the rewrite left out goes onto the skills line it fits best, written as the
  // job post writes it. A term from the JD alone remains a visible gap; adding it would turn a score into fabricated
  // biography. A narrow explicit blanket confirmation ("I have experience with all required skills") supports all.
  const placeRemaining = async (cur: Pass): Promise<Pass> => {
    if (sec.skills === false || !zones.skills.length) return cur
    const left = forcedJdKws.filter(k => !cur.afterKw.has(k) && !isCertification(k))
    if (!left.length && !relationalPairs.length) return cur
    const sk = skillEdits(cur.edits)
    const lines = zones.skills.map(s => ({ idx: s.idx, text: sk.get(s.idx) ?? s.text }))
    const placed = placeInSkills(lines, left, jd)
    const afterPlace = lines.map(l => ({ idx: l.idx, text: placed.find(p => p.idx === l.idx)?.text || l.text }))
    const woven = weaveConfirmedVocabulary({
      skills: afterPlace, jd,
      bullets: zones.roles.flatMap(r => r.bullets.map(b => ({ idx: b.idx, role: r.role, text: (cur.edits.bullets || []).find(x => x.idx === b.idx)?.text || b.text }))),
      pairs: relationalPairs,
      evidence: [text, ...immediatePrefs].join("\n"),
    })
    const addedSkills = mergeIndexedEdits(placed, woven.skills)
    const bulletEdits = woven.bullets
    if (!addedSkills.length && !bulletEdits.length) return cur
    const next = await applyEdits({ ...cur.edits, skills: mergeIndexedEdits(cur.edits.skills || [], addedSkills), bullets: mergeIndexedEdits(cur.edits.bullets || [], bulletEdits) })
    if (next.cov < cur.cov) return cur
    next.via = cur.via
    next.partial = cur.partial
    return next
  }

  // THE FLOOR's placement (see below): only candidate-evidenced target terms still missing, certifications excepted, onto the skills line it
  // fits best. Kept only if the measured coverage rose. With no skills section it changes nothing (and says so in the
  // result's missing terms).
  const placeEverything = async (cur: Pass): Promise<Pass> => {
    // The post's own skill terms (floorTerms), certifications excepted. They are written on the skills
    // line and named in the reply as coming from the job post, not as confirmed experience.
    // They are not written into experience bullets as work the person did.
    // Switch on, the v2 skills-line rules (resume-skills-line.ts): a term is written with its whitespace and line breaks
    // collapsed, and never if it is junk (work status, pay, workplace) or would trip the round-trip guard (a date, phone,
    // email or link).
    const left = scoreKws.filter(k => floorKws.has(k) && !cur.afterKw.has(k) && !isCertification(k))
      .filter(k => !jdGate || (cleanTerm(k) === k && !isJunkTerm(k) && !isGuardUnsafe(k)))
    if (!left.length) return cur
    // A soft skill ("problem solving", "communication skills") reads as a strength, not a tool: it goes into the summary
    // as one short sentence when the summary is a single paragraph the person left open to rewriting; a summary they
    // locked (WhatsApp's default: "summary left as written") is never touched, and the strength goes with the rest.
    const oneSummary = sec.summary !== false && zones.summaryIdx !== null && !(zones.summaryOverflowIdx || []).length
    const soft = oneSummary ? left.filter(k => SOFT_SKILL.test(k)) : []
    const hard = left.filter(k => !soft.includes(k))
    const summaryBase = (cur.edits.summary || zones.summaryText || "").trim()
    // Written as an addition to the paragraph as it stands, so its formatting stays (docx.ts rewriteParaText).
    const summary = soft.length && summaryBase
      ? `${summaryBase}${/[.!?]$/.test(summaryBase) ? "" : "."} Strengths: ${soft.map(k => jdSpelling(k, jd)).join(", ")}.`
      : cur.edits.summary
    const skillsWanted = sec.skills !== false && zones.skills.length > 0
    const sk = skillEdits(cur.edits)
    const placed = skillsWanted ? placeInSkills(zones.skills.map(s => ({ idx: s.idx, text: sk.get(s.idx) ?? s.text })), hard, jd) : []
    if (!placed.length && summary === cur.edits.summary) return cur
    const next = await applyEdits({ ...cur.edits, summary, skills: mergeIndexedEdits(cur.edits.skills || [], placed) })
    if (next.cov <= cur.cov) return cur
    next.via = cur.via
    next.partial = cur.partial
    next.floor = hard.filter(k => next.afterKw.has(k))
    next.floorSummary = soft.filter(k => next.afterKw.has(k))
    return next
  }

  // Certifications are ignored (owner, 19 Oct 2026: "Ignore certs always"): one the writer put on a skills line that the
  // source resume does not list is taken out again.
  const stripAddedCerts = async (cur: Pass): Promise<Pass> => {
    if (!zones.skills.length) return cur
    const sk = skillEdits(cur.edits)
    const cleaned = withoutAddedCerts(zones.skills.map(s => ({ idx: s.idx, text: sk.get(s.idx) ?? s.text })), text)
    if (!cleaned.length) return cur
    const next = await applyEdits({ ...cur.edits, skills: mergeIndexedEdits(cur.edits.skills || [], cleaned) })
    next.via = cur.via
    next.partial = cur.partial
    return next
  }

  // A model sometimes writes a job-post product onto a skills line the source never had.
  // That one item used to fail the whole file. Take the item off the skills line. Leave bullets unchanged.
  const stripUnsupportedSkills = async (cur: Pass, banned: string[]): Promise<Pass> => {
    if (!zones.skills.length || !banned.length) return cur
    const sk = skillEdits(cur.edits)
    const cleaned = withoutUnsupportedSkills(zones.skills.map(s => ({ idx: s.idx, text: sk.get(s.idx) ?? s.text })), text, banned)
    if (!cleaned.length) return cur
    const next = await applyEdits({ ...cur.edits, skills: mergeIndexedEdits(cur.edits.skills || [], cleaned) })
    next.via = cur.via
    next.partial = cur.partial
    next.floor = (cur.floor || []).filter(k => next.afterKw.has(k))
    next.floorSummary = cur.floorSummary
    return next
  }

  let best: Pass | null = null
  let usedModel = ""
  let skillsOnly = false
  let draftErr: unknown = null   // why the last draft that failed did, for the message below
  const firstAsk = refine ? [] : injectFor(beforeKw)
  // A split draft already uses every lane in one pass, so it is made once and then gap-filled per role. A single-call
  // draft (quick mode, a refinement) goes down the lanes until one answers, skipping any that already showed it cannot.
  for (const lane of splitDraft ? lanes.slice(0, 1) : lanes) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    if (laneOut.has(lane)) continue
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const first = await Promise.race([
        draftPass(lane, firstAsk).catch(err => { judgeLane(laneOut, lane, err); draftErr = err; return null }),
        new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), remaining) }),
      ])
      if (!first) continue
      if (!best || quality(first) > quality(best)) {
        best = first
        usedModel = first.via ?? lane.label ?? String(lane.pref)
      }
      let current = best
      // A refinement applies the person's change, not a coverage climb — but the
      // 95%+ match guarantee still holds: a refine that drops coverage below the
      // floor gets repair passes that preserve the requested change (never silently
      // handing back a low-match resume as "tailored"). A split draft climbs in fillGaps below.
      const REFINE_COVERAGE_FLOOR = 0.95
      if (supportedShare(current) >= TARGET_COVERAGE || splitDraft) break
      if (refine && supportedShare(current) >= REFINE_COVERAGE_FLOOR) break

      // Coverage repair passes are deliberately targeted at the exact terms still absent
      // from the rendered DOCX. They regenerate from the canonical source so formatting
      // remains stable, and only a measurable improvement replaces the current best pass.
      // Stop only for the hard request deadline or the 98% completion threshold.
      for (let repair = 1; repair <= 3 && supportedShare(current) < TARGET_COVERAGE; repair++) {
        if (deadline - Date.now() < 5000) break
        const missing = forcedJdKws.filter(k => !current.afterKw.has(k))
        if (!missing.length) break
        const repairPrefs: string[] = [
          `EVIDENCE-SUPPORTED COVERAGE REPAIR PASS ${repair}: verified JD term retention is ${coveragePercent(supportedShare(current))}%. Target at least ${Math.round(TARGET_COVERAGE * 100)}% of evidenced terms; do not invent unsupported requirements.`,
          `The JD is a KNOWN JD supplied/approved by the user. Incorporate ALL of these still-missing ATS terms naturally and contextually: ${missing.join(", ")}.`,
          "Do not claim a JD qualification unless the baseline or explicit candidate confirmation substantiates it. Preserve immutable identity, experience length, employers, dates, education, and certifications.",
          "Distribute terms across the summary, skills, and relevant experience instead of keyword stuffing.",
          ...(refine ? [`Preserve the user's requested change while restoring coverage — do not undo it: "${refine.slice(0, 500)}".`] : []),
        ]
        const candidate: Pass | null = await draftPass(lane, repairPrefs).catch(err => {
          judgeLane(laneOut, lane, err)
          return null
        })
        if (!candidate) break
        if (quality(candidate) > quality(current)) {
          best = candidate
          current = candidate
          usedModel = candidate.via ?? lane.label ?? String(lane.pref)
        } else {
          break
        }
      }
      if (best && supportedShare(best) >= TARGET_COVERAGE) break
    } finally { if (timer) clearTimeout(timer) }
  }
  // Put the supported target vocabulary into the profile BEFORE experience repair. Previously this
  // happened after fillGaps, so applyEdits could create new listed-skill requirements after the last
  // role pass. The exported file could consequently show a high whole-document score while those
  // same terms had no substantive client bullets. Ordering profile placement first makes the role
  // requirements visible to fillGaps and keeps skills + experience as one acceptance unit.
  // A change the person asked for (refine) is left as they asked: it may be the removal of a term.
  if (best && !refine) {
    const placed = await placeRemaining(best)
    if (placed !== best) usedModel = `${usedModel} + every remaining keyword placed`
    best = placed
  }
  if (best && splitDraft && !refine) {
    const filled = await fillGaps(best)
    if (filled !== best) usedModel = `${usedModel} + gap fill`
    best = filled
  }
  if (best) best = await stripAddedCerts(best)
  // A model sometimes writes an unconfirmed tool onto a skills line. Take those off, then the floor
  // below writes the job post's own terms back in one labelled pass. Stripping after the floor is what
  // left a delivered file at 47% of the job post. The reply names those terms as from the job post.
  if (best && !refine) {
    const banned = scoreKws.filter(k => !forcedJdKws.includes(k) && !beforeKw.has(k))
    const stripped = await stripUnsupportedSkills(best, banned)
    if (stripped !== best) { best = stripped; usedModel = `${usedModel} + unconfirmed tools cleared before the skills floor` }
  }

  // Job-post terms gate (owner, 29 Oct 2026). A job-post-only term the writer put into an experience bullet is a claim
  // the person did that work. The bullet goes back to the source text (a new bullet carrying it is dropped), and the
  // floor below writes the term onto the skills line, named in the reply. Bullets without such a term keep the edit.
  let bulletsReverted = 0
  // Switch on: master's rollback (removeUnsupportedRewrites, the whole original paragraph back) runs once BEFORE the floor
  // too, so a job-post-only term the writer put in a bullet, an added row, an extra, the headline or the summary is taken
  // out there and the floor below then writes it onto the skills line. The skills line itself is left for the floor.
  if (best && !refine && jdGate) {
    const jobOnly = scoreKws.filter(k => !forcedJdKws.includes(k) && !beforeKw.has(k) && !isCertification(k))
    if (jobOnly.length) {
      const cleaned = removeUnsupportedRewrites(best.edits, value => coveredJdKeywords(value, jobOnly).size > 0, { keepSkills: true })
      if (cleaned.removed) {
        const next = await applyEdits(cleaned.edits)
        next.via = best.via
        next.partial = best.partial
        best = next
        bulletsReverted = cleaned.removed
        usedModel = `${usedModel} + ${cleaned.removed} paragraph(s) with job-post-only terms restored`
      }
    }
  }

  // THE FLOOR. Owner, 26 Oct 2026, after two WhatsApp resumes came back at 52% and 28.5% ("JD keyword coverage") because
  // terms such as PeopleSoft Query Manager, row-level security, F5 and Cisco were never written in: "I want this to be a
  // consistent build. Even if something going wrong ... the baseline is serve at least 90% match." And 19 Oct: every job
  // keyword goes in, certifications never. Since 22 Oct the passes above write a term into the experience only where the
  // source resume or the person's own words show it (4cbe02a), and that stays: the bullets are the candidate's record.
  // What is still missing is written onto the skills line it fits best, as the job post spells it, and named
  // in the reply so the person sees what came from the job post alone. The pass repeats while coverage is
  // under 95% and each pass still adds terms. Experience bullets stay the candidate's record.
  let floorFrom: Pass | null = null
  if (!best && !refine) {
    const plain = await applyEdits({ headline: { title: "", tagline: "" }, summary: "", skills: [], bullets: [], extras: [] })
    plain.via = "no AI writer (skills section only)"
    best = plain
    usedModel = plain.via
    skillsOnly = true
  }
  if (best && !refine) {
    for (let floorRound = 0; floorRound < 4; floorRound++) {
      const floored = await placeEverything(best)
      if (floored === best) break
      if (!floorFrom) floorFrom = best
      best = floored
      if (!usedModel.includes("job-post terms on the skills line")) usedModel = `${usedModel} + job-post terms on the skills line`
    }
  }
  // A model may still invent a JD-only tool in a client bullet, title, summary,
  // project, or skills line after the earlier skills-only cleanup. Restore the
  // ORIGINAL paragraph rather than deleting just the tool name: the rest of
  // that work claim might also be invented. Re-score the actual exported DOCX
  // and re-run every normal completion/evidence gate; never force acceptance.
  if (best) {
    // Switch on (JD_TERMS_ALWAYS_ON_SKILLS): the skills line is not rolled back and the floor's placed terms (skills line,
    // open-summary "Strengths:") are not counted as unsupported; every other section is rolled back as before. Off: unchanged.
    const placedByFloor = jdGate ? new Set([...(best.floor || []), ...(best.floorSummary || [])]) : new Set<string>()
    const unsupported = scoreKws.filter(k => !forcedJdKws.includes(k) && !beforeKw.has(k) && !placedByFloor.has(k))
    if (unsupported.length) {
      const cleaned = removeUnsupportedRewrites(best.edits,
        value => coveredJdKeywords(value, unsupported).size > 0, { keepSkills: jdGate })
      if (cleaned.removed) {
        const previous = best
        const restored = await applyEdits(cleaned.edits)
        restored.via = previous.via
        restored.partial = previous.partial
        restored.floor = jdGate ? previous.floor : (previous.floor || []).filter(k => restored.afterKw.has(k))
        restored.floorSummary = (previous.floorSummary || []).filter(k => restored.afterKw.has(k))
        best = restored
        // Evidence and role counts must be computed from the sanitized pass.
        floorFrom = null
        usedModel += " + unsupported claim paragraphs restored"
      }
    }
  }
  if (!best) {
    // A split draft is put together a few seconds BEFORE the deadline, so "out of time" is judged with that margin and by
    // what the draft itself said: otherwise slow providers were reported as "check API keys".
    const why = String((draftErr as Error)?.message || draftErr || "")
    throw new Error(Date.now() >= deadline - 4000 || /TimeoutError|timed out|aborted/i.test(why)
      ? "Tailoring timed out: the AI providers are slow or rate-limited right now. Please try again in a minute."
      : /^Tailoring incomplete/.test(why) ? `${why} Please try again in a minute.`
      : "Tailoring failed — every model errored (check API keys / quota).")
  }
  const { edits, buffer, notes, afterKw } = best
  const evidencePass = floorFrom ?? best
  const { claimedKw, roleKw, required, provenKw } = evidencePass
  if (skillsOnly) notes.push("No AI writer answered in time: only the skills section was brought up to the job post. Ask again for the full rewrite.")
  if (best.floor?.length) notes.push(`Job-post terms placed on the skills line, not as confirmed experience: ${best.floor.join(", ")}`)
  if (best.floorSummary?.length) notes.push(`Written into the summary as strengths, from the job post: ${best.floorSummary.join(", ")}`)
  // A skills-line placement is a finished result and is cached with every other finished run.
  // Experience that was not rewritten, and a skills-only file still under 95% of the job post,
  // stay blocked through the checks below.
  const floorCarried = !!floorFrom && skillsOnly
  if (!opts.refine && !jdGenerated.length) notes.push("Gemini keyword review returned no additional terms; generation used the directly extracted JD requirements.")
  notes.push("The JD supplies target requirements; the source resume and explicit candidate confirmations supply experience evidence. The target is 98% keyword coverage where supported. Scores measure exported document keyword overlap, not hiring probability.")
  notes.push(`Tailored with ${usedModel} · JD keyword coverage ${coveragePercent(best.cov)}%`)
  const finalRewrites = rewrites(edits)
  const finalAdded = addedFor(edits)
  const role_alignment = zones.roles.map((r, i) => ({
    role: r.role.replace(/\s+/g, " ").trim(),
    bullets: r.bullets.length,
    rewritten: r.bullets.filter(b => finalRewrites.has(b.idx)).length,
    added: finalAdded[i].length,
    skills: roleKw[i].size,
    required: required[i].length,
  }))
  if (splitDraft) {
    notes.push(`Draft requires review; keyword overlap is not a qualification or ATS success score. Experience: ${countedRoles.length - lackingRoles(edits).length}/${countedRoles.length} roles tailored · listed JD skills shown per role: ${countedRoles.map(i => `${roleKw[i].size}/${required[i].length}`).join(" · ")} · ${finalAdded.flat().length} bullet(s) added · ${provenKw.size}/${claimedKw.size} listed skills shown in at least one role`)
  }


  // Scores describe the exported document's measured JD keyword coverage.
  // Never force a high band or an improvement that the document did not achieve.
  const before = coveragePercent(shareOf(beforeKw))
  const after = coveragePercent(shareOf(afterKw))

  // ── Match decomposition + keyword gap (reuses the coverage sets above) ──
  const kwAdded   = scoreKws.filter(k => !beforeKw.has(k) && afterKw.has(k))
  const kwMissing = scoreKws.filter(k => !afterKw.has(k))
  const pctOf = (n: number) => scoreKws.length ? coveragePercent(n / scoreKws.length) : 0
  const keyword_analysis = {
    matched: kwMatched,
    added: kwAdded,
    missing: kwMissing,
    coverage_before: pctOf(kwMatched.length),
    coverage_after: pctOf(afterKw.size),
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
  for (const a of edits.added || []) if ((a.text || "").trim()) diff.push({ section: "Experience (new bullet)", before: "", after: a.text.trim() })
  // The change list the person keeps or undoes before download, and the reading it was made from. No model call.
  const review = tailorReview({
    zones, text, edits, dropped: best.dropped, requirements: scoreKws, jd,
    evidence: immediatePrefs.join("\n"), covers: coveredJdKeywords, spanOf: r => roleSpanMonths(r),
  })

  // Total the real token usage across every model call this tailor made. Anthropic
  // reports cached prefix tokens under cacheRead (~1/10th the price of fresh input),
  // so a high cacheRead share = the resume+RULES cache paying off on repeat tailors.
  const uAgg = usageSink.reduce(
    (a, u) => ({ input: a.input + u.input, output: a.output + u.output, cacheRead: a.cacheRead + u.cacheRead, cacheWrite: a.cacheWrite + u.cacheWrite }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  )
  // Priced per call by the model that served it (src/lib/llmPrices.ts). This used to price every token at Claude Haiku's rate,
  // so a resume written by GPT Luna showed ten times its cost and one written on Groq's free allowance showed as money spent.
  const priced = priceCalls(usageSink)
  const estCostUSD = priced.costUsd

  // The file's name. A whole draft that changed something is stored under the deterministic key, beside its cached result
  // (same inputs → same file). An incomplete or unchanged one gets another name: written over the key, it left an EARLIER
  // whole result in the cache pointing at this lesser file, so the next identical request was told "31 bullets rewritten"
  // and handed an untailored resume (found in review, 2026-10-05).
  // Weighted coverage (Jobscan REA): hard skills count 3x, titles 2x, soft 1x, buzzwords 0.5x.
  // Preserve actual counts; weighting is a separate signal, not proof of recruiter acceptance.
  // Evaluate whether the rewrite retained the candidate's evidenced JD vocabulary separately
  // from JD requirements the candidate has never claimed. An honest gap must not be
  // interpreted as a failed rewrite, and it must never be silently invented.
  const attainableKws = scoreKws.filter(k => forcedJdKws.includes(k) || beforeKw.has(k))
  const attainableCovered = coveredJdKeywords(best.tailoredText, attainableKws)
  const attainableCoverage = attainableKws.length ? attainableCovered.size / attainableKws.length : 1
  const unsupportedJdKws = scoreKws.filter(k => !attainableKws.includes(k))
  if (unsupportedJdKws.length) {
    notes.push(`JD qualification gaps not supported by candidate evidence: ${unsupportedJdKws.length}`)
  }
  notes.push(`Evidence-supported JD vocabulary retained: ${Math.round(attainableCoverage * 100)}%`)
  const editedBullets = new Map((best.edits.bullets || []).map(b => [b.idx, b.text]))
  const bulletText = [
    ...zones.roles.flatMap(r => r.bullets.map(b => editedBullets.get(b.idx) || b.text)),
    ...(best.edits.added || []).map(a => a.text || ""),
  ].join("\n")
  const floorOnSkills = new Set([...(best.floor || []), ...(best.floorSummary || [])].map(k => k.toLowerCase()))
  // A term the floor wrote onto the skills line, or into an open summary as a strength, is labelled
  // as coming from the job post. The same term inside an experience bullet is a claim that the person
  // did that work, and that still blocks delivery.
  // Gate on: only an experience bullet makes a claim. A term on the skills line or in the summary is labelled in the reply.
  const unverifiedAdded = unsupportedJdKws.filter(k => coveredJdKeywords(bulletText, [k]).has(k) || (!jdGate && coveredJdKeywords(best.tailoredText, [k]).has(k) && !floorOnSkills.has(k.toLowerCase())))
  // Gate on, skills locked or no skills section: what the floor could not place is listed in the reply, not a refusal.
  const unplacedReason: JdTermsUnplacedReason | undefined = !jdGate || refine ? undefined : sec.skills === false ? "skills_locked" : !zones.skills.length ? "no_skills_section" : undefined
  const unplacedTerms = unplacedReason ? scoreKws.filter(k => floorKws.has(k) && !afterKw.has(k) && !isCertification(k)).map(k => jdSpelling(k, jd)) : []
  if (unverifiedAdded.length > 0) notes.push(`Unverified JD claims require candidate confirmation: ${unverifiedAdded.join(", ")}`)
  // Gate on: job-post terms the AI writer itself wrote onto the skills line (not the floor's) are named too (blueprint item 5).
  const floorNamed = new Set((best.floor || []).map(k => k.toLowerCase()))
  const skillsLines = (best.edits.skills || []).map(s => s.text || "").join("\n")
  const writerOnSkills = jdGate && !refine
    ? [...coveredJdKeywords(skillsLines, unsupportedJdKws)].filter(k => !floorNamed.has(k.toLowerCase()) && !isCertification(k)).map(k => jdSpelling(k, jd))
    : []
  if (writerOnSkills.length) notes.push(`Job-post terms the writer put on the skills line, not as confirmed experience: ${writerOnSkills.join(", ")}`)
  // Diagnostic codes contain no resume, JD, name or phone number.
  const qualityBlockers = [
    ...(skillsOnly && best.cov < RESUME_MIN_COVERAGE ? ["skills_only"] : []),
    ...(floorCarried && best.cov < RESUME_MIN_COVERAGE ? ["floor_only"] : []),
    ...(best.partial ? ["draft_parts_missing"] : []),
    ...(unverifiedAdded.length ? ["unverified_jd_terms"] : []),
    // Gate on: roles the job-post terms rollback put back are the candidate's own record (TAILOR_SHIP_ON_ROLLBACK).
    ...roleQualityBlockers({
      splitDraft: !!splitDraft, skillsOnly: !!skillsOnly, lackingRoleCount: splitDraft && !skillsOnly ? lackingRoles(best.edits).length : 0,
      experienceComplete: !splitDraft || skillsOnly || experienceCoverageComplete(role_alignment, TARGET_COVERAGE), jdGate, bulletsReverted,
    }),
    ...(!diff.length ? ["unchanged"] : []),
  ]
  // The delivery score is the job post itself. Evidenced-only scoring reported 100% while
  // the file still showed about half the post, and a post the resume had never used
  // scored as an empty denominator (needs review) after the skills line was filled.
  const coveredScore = scoreKws.filter(k => afterKw.has(k))
  const qualityReport = resumeQuality({ matched: coveredScore.length, total: scoreKws.length, missing: scoreKws.filter(k => !afterKw.has(k)), weightedCoverage: best.cov, partial: qualityBlockers.some(k => k !== "unchanged"), unchanged: !diff.length })
  const token = !best.partial && diff.length && qualityReport.status === "coverage_met" ? key : `${key}x${createHash("sha1").update(buffer).digest("hex").slice(0, 8)}`
  await blob.put(`tailored/${token}.docx`, buffer)

  const result: TailorResult = {
    quality: qualityReport,
    quality_blockers: qualityBlockers,
    token, score: after, score_before: before, tier, matched, matched_on: matchedOn,
    ranked_candidates: rankedCandidates, what_changed: whatChanged(edits), edits, notes,
    applied_feedback: allPrefs, keyword_analysis, score_breakdown, diff, review,
    cached: false, elapsed_ms: Date.now() - started, coverage: coveragePercent(best.cov), supported_coverage: coveragePercent(attainableCoverage), unsupported_keywords: unsupportedJdKws, unverified_added_keywords: unverifiedAdded, role_alignment,
    experience_skills: { listed: claimedKw.size, shown: provenKw.size },
    ...(best.partial ? { partial: best.partial } : {}),
    ...(diff.length ? {} : { unchanged: true }),
    ...(best.floor?.length ? { placed_from_jd: best.floor.map(k => jdSpelling(k, jd)) } : {}),
    ...(writerOnSkills.length ? { skills_from_jd_writer: writerOnSkills } : {}),
    ...(best.floorSummary?.length ? { placed_in_summary: best.floorSummary.map(k => jdSpelling(k, jd)) } : {}),
    ...(skillsOnly ? { skills_only: true } : {}),
    jd_terms_gate: jdGate ? "on" : "off",
    ...(bulletsReverted ? { bullets_reverted_for_jd_terms: bulletsReverted } : {}),
    ...(unplacedTerms.length ? { jd_terms_unplaced: unplacedTerms, jd_terms_unplaced_reason: unplacedReason } : {}),
    usage: { calls: usageSink.length, inputTokens: uAgg.input, outputTokens: uAgg.output, cacheReadTokens: uAgg.cacheRead, cacheWriteTokens: uAgg.cacheWrite, estCostUSD, unpricedCalls: priced.unpricedCalls, byModel: priced.byModel },
  }

  // Retain failed-run evidence privately; do not lose the input/output mapping when
  // WhatsApp consumes its session. No route exposes this diagnostic object.
  // The same record is what /api/tailor/review rebuilds the person's accepted version from (src/lib/tailor-review.ts).
  await blob.put(tailorRunKey(opts.userResumeDir, token), JSON.stringify({
    version: 1, createdAt: new Date().toISOString(), sourceHash, sourcePath: matched.filepath,
    input: { jd: opts.jd, confirmations: immediatePrefs, refine: opts.refine || null },
    requirements: scoreKws, enrichmentSuggestions: jdGenerated, result,
  })).catch(() => { result.notes.push("Run diagnostic persistence failed; generated document storage is separate.") })

  // Every finished run that changed the file is served again, at any coverage, so a repeat does not pay
  // for another model ladder. An incomplete or unchanged draft is still redone when the providers have room.
  if (!result.partial && !result.unchanged) {
    await blob.put(cacheKey, JSON.stringify(result)).catch(() => {})
  }
  return result
}
