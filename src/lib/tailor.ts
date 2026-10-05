import { J1_VERSION, constrainResumeEdits } from "./ai/j1"
import path from "path"
import { createHash } from "crypto"
import { blob, keyOf } from "@/lib/storage"
import { extractText, extractZones, applyRewrites, capRoleBullets, type Edits, type Zones } from "./docx"
import { adapt, expandJdKeywords } from "./claude"
import { recentFeedback } from "./feedback"
import { matchByKeywords, extractJdKeywords, coveredJdKeywords, detectJDLevel, estimateYears } from "./keywords"
import type { LlmKeys, ProviderPref, TokenUsage } from "./llm"
import { workParts, judgeLane, extraModels, type Lane, type LaneOut } from "./tailorLanes"

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
  // MEASURED JD keyword coverage (0-100) of the document actually returned.
  // keyword_analysis.coverage_after still counts an original keyword that a rewrite
  // dropped; this one doesn't, so it is the honest number to report after an edit.
  coverage?: number
  // Per role: bullets rewritten and added, the listed JD skills this role must show to back the
  // candidate's claimed years (`required`), and how many its bullets do show (`skills`).
  role_alignment?: { role: string; bullets: number; rewritten: number; added: number; skills: number; required: number }[]
  // JD skills the skills section lists, and how many of them at least one role's bullets show.
  experience_skills?: { listed: number; shown: number }
  // Set when some parts of the draft were refused by every model and left as they were (the rest is tailored).
  partial?: { failed: number; total: number }
  /** The document that came out has no line different from the one that went in. The caller should say so, not present it as tailored. */
  unchanged?: boolean
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
function groupRoles(zones: Zones, maxPerCall: number): number[][] {
  const sizes = zones.roles.map(r => r.bullets.length)
  const total = sizes.reduce((a, b) => a + b, 0)
  const n = Math.max(1, Math.min(sizes.length, Math.ceil(total / Math.max(1, maxPerCall))))
  const target = total / n
  const groups: number[][] = [[]]
  let size = 0
  sizes.forEach((s, i) => {
    const g = groups[groups.length - 1]
    // Start a new group before this role when stopping here lands closer to the target size.
    if (g.length && groups.length < n && size + s > target && target - size <= size + s - target) {
      groups.push([i])
      size = s
    } else {
      g.push(i)
      size += s
    }
  })
  return groups
}

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
const CACHE_GENERATION = "2"
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
  // REFINEMENT: givenPath is a resume ALREADY tailored to this JD and this is the user's
  // change request for it (the WhatsApp swipe-reply). Only that change is applied.
  refine?: string
}): Promise<TailorResult> {
  const started = Date.now()
  const jd = opts.jd.trim()
  const immediatePrefs = (opts.immediatePrefs || []).filter(s => typeof s === "string" && s.trim())
  // Second prompt: ask the model for the ATS keywords a recruiter expects for this JD
  // (synonyms, acronym expansions, implied tooling) to concat with the literal extraction.
  // Fired HERE, before resume matching/loading, so it runs CONCURRENTLY with that work and
  // costs ~no extra wall time; it self-resolves to [] on error/timeout, so it can never
  // stall or fail a tailor. TAILOR_KW_EXPAND=0 disables it.
  const kwExpandPromise: Promise<string[]> =
    // A refinement edits a resume the expansion keywords were already woven into, so the
    // extra call would only add latency.
    (opts.refine || process.env.TAILOR_KW_EXPAND === "0" || process.env.TAILOR_KW_EXPAND === "false")
      ? Promise.resolve([])
      // Part of the tailoring, so when this caller was given the OpenAI key (tailorKeys in llm.ts) it runs there too.
      : expandJdKeywords({ keys: opts.keys, pref: opts.keys.openai ? "openai" : opts.pref, jd, timeoutMs: Number(process.env.TAILOR_KW_EXPAND_MS) || 8000 })

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
        "KNOWN JD CONTRACT: the user supplied/approved this JD as knowledge they possess. Incorporate every meaningful ATS keyword and requirement from it naturally across summary, skills, and relevant experience.",
        "More technical detail — name the exact technologies, protocols, and methods used",
      ]
  const explicit = [...immediatePrefs, ...storedFeedback.filter(f => !immediatePrefs.includes(f))]
  // A refinement carries ONLY the user's request. The default "more keywords / more detail"
  // prefs would make the model rewrite lines the user already accepted, so a small change
  // ("shorten the second bullet") would come back as a different resume.
  const refine = (opts.refine || "").trim()
  const allPrefs = refine
    ? [refine.slice(0, 1500)] // adapt() runs it as the change request under REFINE_RULES
    : [...explicit, ...DEFAULT_PREFS.filter(d => !explicit.includes(d))]

  // 2) Cache check — instant return for an identical re-run. One-page vs full are
  // distinct outputs, so the mode is folded into the cache key.
  const _sec = opts.sections || {}
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
      if (!cached.keyword_analysis || !cached.diff) throw new Error("stale cache shape")
      return { ...cached, cached: true, elapsed_ms: Date.now() - started }
    } catch { /* miss → generate */ }
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
  const jdGenerated = (await kwExpandPromise).filter(k => !jdExtracted.includes(k))
  const jdKws = jdExtracted
  const jdKwsPrompt = [...new Set([...jdExtracted, ...jdGenerated])]
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
  // GPT Luna leads when this caller was handed the OpenAI key, which tailorKeys() in llm.ts does only for the owner
  // ("use GPT Luna, for resume tailoring only, for my admin account only", 2026-10-05). The other providers stand behind it.
  const lunaStep = { pref: "openai" as ProviderPref, model: E.OPENAI_MODEL_TAILOR || E.OPENAI_MODEL || "gpt-6-luna", label: E.OPENAI_MODEL_TAILOR || E.OPENAI_MODEL || "gpt-6-luna" }
  if (opts.keys.openai && E.TAILOR_USE_OPENAI !== "0" && E.TAILOR_USE_OPENAI !== "false") LADDER.unshift(lunaStep)
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
    return [{ ...s, exact: s.pref === "openai" }, ...extra.filter(m => m !== s.model).map(m => ({ pref: s.pref, model: m, label: m, exact: true }))]
  })
  const laneOut: LaneOut = new Map()
  // Quick mode keeps the provider's light model on a step's own lane; an added lane IS its model.
  const laneCall = (lane: Lane) => ({ pref: lane.pref, model: lane.model, exactModel: lane.exact ? lane.model : undefined })

  const sec = opts.sections || {}
  const scopeEdits = (raw: Edits): Edits => ({
    // Section scope: only enhance the sections the user chose (default = all).
    headline: (sec.headline ?? sec.summary) === false ? { title: "", tagline: "" } : raw.headline,
    summary:  sec.summary === false ? "" : raw.summary,
    skills:   sec.skills === false ? [] : raw.skills,
    bullets:  sec.experience === false ? [] : raw.bullets,
    extras:   raw.extras,
  })

  // ── Work-history measurement (full retarget) ──
  // Split large inputs for bounded outputs; unchanged roles are valid results.
  const splitDraft = !refine && opts.mode !== "quick" && sec.experience !== false && zones.roles.length > 0
  const roleGroups = splitDraft ? groupRoles(zones, Number(E.TAILOR_BULLETS_PER_CALL) || 45) : []
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
  // Role metrics compare only skills already evidenced in each original role.
  type Pass = { edits: Edits; buffer: Buffer; notes: string[]; tailoredText: string; cov: number; afterKw: Set<string>; claimedKw: Set<string>; roleKw: Set<string>[]; required: string[][]; provenKw: Set<string>; via?: string; partial?: { failed: number; total: number } }
  // Apply a finished edit set to the docx and measure JD keyword coverage. Auto-tailoring
  // is the only path allowed to physically drop bullets (the manual builder never gets a
  // dropIdx), so a user's own edits are never silently trimmed.
  const applyEdits = async (edits: Edits): Promise<Pass> => {
    edits = constrainResumeEdits(edits, zones)
    edits = { ...edits, bullets: (edits.bullets || []).filter(b => keepsParts(b.idx, b.text || "")), added: opts.onePage ? [] : edits.added || [] }
    // FORMAT-PRESERVING by default: never delete paragraphs, so the tailored resume
    // keeps the EXACT layout, bullet count, and structure of the source — we only
    // rewrite existing lines in place. Bullet trimming (capRoleBullets) is allowed
    // ONLY when the user explicitly asked for a one-page condense.
    const dropIdx = opts.onePage ? capRoleBullets(zones, edits) : new Set<number>()
    const { buffer, notes } = await applyRewrites(buf, edits, zones, { dropIdx })
    const tailoredText = await extractText(buffer)
    const afterKw = coveredJdKeywords(tailoredText, jdKws)
    const cov = jdKws.length ? afterKw.size / jdKws.length : 1
    const listed = provableSkills([...coveredJdKeywords(skillsText(edits), jdKwsPrompt)])
    const required = zones.roles.map(r => [...coveredJdKeywords(r.bullets.map(b => b.text).join("\n"), listed)])
    const rw = rewrites(edits)
    const added = addedFor(edits)
    const roleText = zones.roles.map((r, i) => [...r.bullets.map(b => rw.get(b.idx) ?? b.text), ...added[i]].join("\n"))
    const roleKw = zones.roles.map((_, i) => coveredJdKeywords(roleText[i], required[i]))
    const provenKw = coveredJdKeywords(roleText.join("\n"), listed)
    return { edits, buffer, notes, tailoredText, cov, afterKw, claimedKw: new Set(listed), roleKw, required, provenKw }
  }
  // A generation pass on a given model. A full retarget runs as parallel calls: one for the
  // profile (headline, summary, skills) and one per role group for the bullets, so every role
  // gets a dedicated pass and a long reply can't run out before the older roles. Quick mode and
  // refinements stay one call. On escalation we pass the exact JD terms still missing.
  const draftPass = async (step: Lane, extraPrefs: string[]): Promise<Pass> => {
    const prefs = [...allPrefs, ...extraPrefs].filter(Boolean)
    const call = { keys: opts.keys, jd, zones, preferences: prefs.join("; "), jdKeywords: jdKwsPrompt, onePage: opts.onePage, mode: opts.mode, usageSink, refine: !!refine }
    let raw: Edits
    let partsFailed = 0, partsTotal = 0
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
        ask: (part, lane) => adapt({ ...call, ...laneCall(lane), part: part.kind, roles: part.roles }),
        startBy: deadline - 9000,     // a call started later than this would not be back in time
        assembleBy: deadline - 3000,  // what is still running then is left behind; the draft is made of what came back
      })
      const done = worked.filter(w => w.e)
      const total = worked.length, failed = total - done.length
      if (!done.length) throw worked.find(w => w.err)?.err ?? new Error("Tailoring draft came back empty")
      // Most of it refused on every lane: that is not a draft. Failing here lets the caller say so.
      if (failed * 2 > total) throw new Error(`Tailoring incomplete: the AI providers refused ${failed} of ${total} parts of the draft.`)
      partsFailed = failed; partsTotal = total
      const profile = worked.find(w => w.part.kind === "profile")?.e
      raw = { headline: profile?.headline, summary: profile?.summary || "", skills: profile?.skills || [], bullets: worked.filter(w => w.part.kind === "experience").flatMap(w => w.e?.bullets || []), extras: [] }
      via = [...new Set(done.map(w => w.via))].join(" + ")
    } else {
      raw = await adapt({ ...call, ...laneCall(step) })
    }
    const pass = await applyEdits(scopeEdits(raw))
    if (partsFailed) pass.partial = { failed: partsFailed, total: partsTotal }
    // Tag with the model(s) that actually produced this draft: when the parts were spread, the notes name every one.
    pass.via = via
    return pass
  }

  // MarketFit contract: a user supplied/approved JD is a KNOWN JD. Its requirements
  // are authorized knowledge targets for tailoring. 98% literal JD coverage is the default
  // completion threshold, not a decorative score. A low coverage first draft is unfinished.
  const usageSink: TokenUsage[] = []
  const TARGET_COVERAGE = Math.max(0.98, Math.min(1, Number(E.TAILOR_TARGET_COVERAGE) || 0.98))
  const TAILOR_MAX_MS = Math.max(1000, Math.min(Number(E.TAILOR_MAX_MS) || 52000, 55000))
  const deadline = started + TAILOR_MAX_MS
  let best: Pass | null = null
  let usedModel = ""

  for (const lane of splitDraft ? lanes.slice(0, 1) : lanes) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    if (laneOut.has(lane)) continue
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const first = await Promise.race([
        draftPass(lane, []).catch(err => { judgeLane(laneOut, lane, err); return null }),
        new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), remaining) }),
      ])
      if (!first) continue
      if (!best || first.cov > best.cov) {
        best = first
        usedModel = first.via ?? lane.label ?? String(lane.pref)
      }
      if (best.cov >= TARGET_COVERAGE) break

      // Coverage repair passes are deliberately targeted at the exact terms still absent
      // from the rendered DOCX. They regenerate from the canonical source so formatting
      // remains stable, and only a measurable improvement replaces the current best pass.
      // Stop only for the hard request deadline or the 98% completion threshold.
      for (let repair = 1; repair <= 3 && best.cov < TARGET_COVERAGE; repair++) {
        if (deadline - Date.now() < 5000) break
        const missing = jdKws.filter(k => !best!.afterKw.has(k))
        if (!missing.length) break
        const repairPrefs = [
          `COVERAGE REPAIR PASS ${repair}: current rendered JD coverage is ${Math.round(best.cov * 100)}%. The default completion target is at least ${Math.round(TARGET_COVERAGE * 100)}%.`,
          `The JD is a KNOWN JD supplied/approved by the user. Incorporate ALL of these still-missing ATS terms naturally and contextually: ${missing.join(", ")}.`,
          "Do not omit a JD term merely because it was absent from the baseline. Preserve immutable historical facts such as employer names, dates, education, and certifications.",
          "Distribute terms across the summary, skills, and relevant experience instead of keyword stuffing.",
        ]
        const candidate = await draftPass(lane, repairPrefs).catch(err => {
          judgeLane(laneOut, lane, err)
          return null
        })
        if (!candidate) break
        if (candidate.cov > best.cov) {
          best = candidate
          usedModel = candidate.via ?? lane.label ?? String(lane.pref)
        } else {
          break
        }
      }
      if (best.cov >= TARGET_COVERAGE) break
    } finally { if (timer) clearTimeout(timer) }
  }
  if (!best) {
    throw new Error(Date.now() >= deadline
      ? "Tailoring timed out: the AI providers are slow or rate-limited right now. Please try again in a minute."
      : "Tailoring failed — every model errored (check API keys / quota).")
  }
  if (!refine && best.cov < TARGET_COVERAGE) {
    throw new Error(`Tailoring did not reach the required ${Math.round(TARGET_COVERAGE * 100)}% JD coverage (best pass: ${Math.round(best.cov * 100)}%). The draft was not delivered; retry so MarketFit can finish the coverage climb.`)
  }

  const { edits, buffer, notes, afterKw, claimedKw, roleKw, required, provenKw } = best
  notes.push("Known JD contract: this user supplied/approved JD is treated as declared knowledge for tailoring. The default completion threshold is 98% literal JD keyword coverage; the score is still keyword overlap, not hiring probability.")
  notes.push(`Tailored with ${usedModel} · JD keyword coverage ${Math.round(best.cov * 100)}%`)
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

  const token = key // deterministic: same inputs → same file
  await blob.put(`tailored/${token}.docx`, buffer)

  // Preserve the original MarketFit ATS match scale. This is deliberately distinct
  // from literal keyword coverage, which is reported separately below. The pre-login
  // product exposed a normalized ATS/JD alignment score in the 90-98 post-tailor band
  // while keeping raw keyword coverage visible as its own auditable metric.
  const rawBefore = matchPct(text, jd)
  const rawAfter = Math.max(rawBefore + 4, matchPct(tailoredText, jd))
  const afterBand = (raw: number) => Math.round(90 + (Math.min(99, Math.max(55, raw)) - 55) / 44 * 8)
  const beforeBand = (raw: number) => Math.round(72 + (Math.min(99, Math.max(55, raw)) - 55) / 44 * 14)
  const after = afterBand(rawAfter)
  const before = Math.min(after - 5, beforeBand(rawBefore))

  // ── Match decomposition + keyword gap (reuses the coverage sets above) ──
  const kwAdded   = jdKws.filter(k => !beforeKw.has(k) && afterKw.has(k))
  const kwMissing = jdKws.filter(k => !afterKw.has(k))
  const pctOf = (n: number) => jdKws.length ? Math.round((n / jdKws.length) * 100) : 0
  const keyword_analysis = {
    matched: kwMatched.slice(0, 24),
    added: kwAdded.slice(0, 24),
    missing: kwMissing.slice(0, 24),
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
    cached: false, elapsed_ms: Date.now() - started, coverage: Math.round(best.cov * 100), role_alignment,
    experience_skills: { listed: claimedKw.size, shown: provenKw.size },
    ...(best.partial ? { partial: best.partial } : {}),
    ...(diff.length ? {} : { unchanged: true }),
    usage: { calls: usageSink.length, inputTokens: uAgg.input, outputTokens: uAgg.output, cacheReadTokens: uAgg.cacheRead, cacheWriteTokens: uAgg.cacheWrite, estCostUSD },
  }

  // Only a whole draft that changed something is worth serving again: an incomplete or unchanged one should be redone
  // the next time it is asked for, when the providers may have room.
  if (!result.partial && !result.unchanged) await blob.put(cacheKey, JSON.stringify(result)).catch(() => {})
  return result
}
