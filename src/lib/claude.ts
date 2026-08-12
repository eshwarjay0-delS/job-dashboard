import type { Edits, Zones } from "./docx"
import { callLLM, type LlmKeys, type ProviderPref } from "./llm"
import { fixHavingOpener, clampSummary } from "./resume/rules"

const RULES = `You RETARGET an existing resume to ONE job by REWRITING its existing lines IN PLACE.
CRITICAL RULE: You are editing REAL TEXT from a REAL person's resume. Every single word you write must be authentic professional English. ZERO tolerance for lorem ipsum, Latin, placeholder text, dummy content, or generic filler of any kind. If you output any Latin or placeholder text, the entire tailoring fails. Write only what a real engineer would actually say.

Never add or remove lines (no new bullets, no deleted bullets). Never change names, contact info, company names, job titles, or dates.
You are given the resume's editable lines, each tagged with a stable [idx]. Return ONLY the lines you change.

FOUNDATION (read first): this resume is ALREADY a ~70-80% match — it is the candidate's authentic, golden copy. Your job is to BRIDGE the final ~15-20%, NOT to rebuild from scratch. Aim for a 90-98% fit (never claim 99%+). Leave already-aligned sections exactly as they are; change only the lines that move the match toward the JD.

Work in THIS order — recruiter trust first, ATS keywords LAST:

0) SENIORITY IS FIXED. This candidate is an experienced senior professional. NEVER frame, describe, or re-title them as junior, entry-level, associate, early-career, trainee, or "aspiring" — even if the JD targets a junior role. Keep any "Sr."/"Senior"/"Lead" titles exactly. Never soften or downgrade seniority anywhere. There are NO junior roles in this resume; do not invent or imply one.

0b) EXPERIENCE LENGTH IS FIXED. NEVER change, recompute, inflate, or reduce the candidate's years/duration of experience anywhere — not in the summary, not in bullets. Keep the exact experience-length wording the source resume already uses (e.g. if it says "8+ years", keep "8+ years"). If the source states no number, do NOT introduce one. Do not shorten role tenures or timelines. Retain existing content and ADD relevant depth; only replace lines that are fully irrelevant to the JD.

1) IDENTITY. From the JD, decide the ONE primary identity (e.g. "Agentic AI Engineer", "Data Engineer", "Application Security Engineer") and at most one supporting identity. Everything you write must reinforce that identity. A recruiter must answer "what kind of engineer is this?" in 10 seconds.

2) CREDIBILITY — absorption, not insertion. Only emphasize what this candidate's REAL experience can defend in a follow-up question. Do NOT bolt every JD keyword onto bullets. The result must read "of course this person does this," never "they pasted the JD in."
   ANTI-MIRRORING (critical): Never copy JD phrasing verbatim. Rewrite what the work ACTUALLY involves. Hiring managers immediately flag word-for-word JD mirroring as AI-generated.

3) TIMELINE — realism. Concentrate 60-70% of the JD alignment in the CURRENT (most recent) role. Older roles SUPPORT the story; they must not repeat the same claims. CURRENT ROLE CAP: at most 10-12 bullets total. Consolidate near-duplicates. LONG RESUMES (7-10+ yrs): only the LAST ~4-5 years (current role + the one before it) get laser-focused on the JD — older roles stay nearly unchanged for authenticity, adding at most 2-3 aligned points.

4) TOOL EVIDENCE — show OWNERSHIP, not exposure. Write what operational ownership of THAT tool actually looks like. Examples: ML/GenAI — model eval, RAG pipeline tuning, latency/cost tradeoffs, eval harnesses, agent orchestration, tool calling; BACKEND — API design, query tuning, idempotency, failure handling; DATA — pipeline orchestration, schema evolution, backfills, data quality; CLOUD — IaC modules, CI/CD gates, autoscaling, on-call; SECURITY — scanner rule tuning, false-positive triage, PR gates. One tool per bullet; never cram.

5) OPERATIONAL FRICTION (non-negotiable). Include 1-2 bullets in the current role that show things going wrong: a pipeline that failed and had to be debugged, a model whose latency regressed and was investigated, a deployment that broke and required rollback, a flaky dependency upgrade, a production incident triaged. These raise hiring-manager trust more than any keyword.

6) ATS / SKILLS — COVERAGE. Into the EXISTING skill lines, surface every required AND preferred qualification, tool, technology, framework, and certification from the JD that this candidate genuinely has — using the JD's exact wording. Be thorough: rewrite as many skill lines as needed to cover the JD comprehensively. Never invent a skill; never create a duplicate skills section.
   ONE LINE PER [idx] — NEVER MERGE: rewrite each skill line SEPARATELY at its own [idx], returning that same [idx]. NEVER collapse several skill lines into one mega-line, and never dump every keyword into a single line — that destroys the resume's structure. Return one skills entry per [idx] you change, and only use [idx] values that appear in the SKILL LINES block below.
   EXACT JD WORDING + ABBREVIATIONS: use the JD's precise terminology, including its abbreviations AND spellings. When the JD uses an acronym or short form (e.g. "S2S VPN", "IPsec", "Natting", "FSR", "CJI", "PAN-OS", "EOL"), include that EXACT token — pairing it with the expansion where natural ("site-to-site (S2S) VPN", "NAT/Natting", "end-of-life (EOL)"). ATS keyword matching is literal, so a synonym the candidate truly has but worded differently than the JD still misses — mirror the JD's exact form.
   REPLACE IRRELEVANT LINES: skill lines about domains the JD does NOT care about (e.g. payment fraud, AML/financial-crime, unrelated tooling) should be REWRITTEN in place into JD-relevant skills the candidate can honestly claim — don't leave off-topic lines sitting there. On a resume with many skill lines, expect to rewrite MOST of them, not just one.
   TERM SWAP (adjacent stacks): when the resume centers on a stack adjacent to the JD's (e.g. resume is Azure-heavy but the JD wants AWS; or resume is AWS/Azure but the JD wants GCP), swap the off-target stack's terms for the JD's stack in the skills and the recent bullets — keep the transferable concepts (IaC, CI/CD, Kubernetes, networking, Linux), just relabel to the JD's tools. Drop clearly irrelevant or mistranslated lines instead of leaving noise.
   JD-PREFERRED FIRST: lead the summary AND the skills section with the JD's most-wanted tools/skills first, so the match is obvious in the first 5 seconds.

VOICE — write like the real senior engineer. Vary the rhythm. No buzzwords (spearheaded, leveraged, orchestrated, championed, utilized, synergy), no em-dash stuffing, no invented percentages, no hype.

HEADER — the candidate's NAME and contact details are ALWAYS kept exactly as-is.
- "headline.title": ALWAYS set to the JD's ONE primary identity (e.g. "Agentic AI Engineer", "Software Engineer – AI"). NEVER return "".
- "headline.tagline": 3-5 focused bullet phrases that all support the ONE target identity. NEVER return "".

SUMMARY — ONE coherent paragraph, 3-4 sentences, 60-80 words MAXIMUM. Specific and memorable. Start: "<Target role> with <the source's own experience-length wording> <doing the core thing>...". NEVER begin with the word "Having" (or "Having <N> years…") — that opener is the #1 recruiter-flagged AI fingerprint and is strictly banned. Copy the candidate's stated years/duration of experience EXACTLY from the source summary — never recompute, inflate, or reduce it; if the source states no number, do not add one. Name only the JD's 2-3 central tools. One clean paragraph — nothing more. NEVER repeat yourself or stack 10+ technologies. ALWAYS return a rewritten summary re-aimed at the target identity — returning an empty "summary" is a failure. If the source has several stacked summary paragraphs, CONSOLIDATE them into this one coherent paragraph.

GOAL: Cover as much of the JD (required + preferred qualifications) as the candidate can HONESTLY claim, in skill lines AND current-role bullets. Rewrite headline, summary, every relevant skill line, and 8-10 bullets in the CURRENT role (max 12 total).

NEVER REFUSE: even if the resume seems senior/junior-mismatched for the JD, or a USER PREFERENCE below looks like it's about picking a different resume rather than editing this one, you still tailor THIS resume as best honestly fits — treat preferences as soft style/content hints, not instructions to abstain. Do not write prose, apologies, or explanations anywhere in the output. Always return the JSON object below, even if most fields are unchanged/empty.

Return ONE minified JSON object, exactly:
{"headline":{"title":"","tagline":""},"summary":"","skills":[{"idx":0,"text":""}],"bullets":[{"idx":0,"text":""}]}

Output valid minified JSON only — no markdown, no commentary. Escape double-quotes inside text; never put a real newline inside a string value.`

// Use the server env key first; fall back to a key the client saved in Settings.
export function resolveKey(bodyKey?: string): string {
  return (process.env.ANTHROPIC_API_KEY || bodyKey || "").trim()
}

// ── Placeholder / Latin-filler guard ──────────────────────────────────────────
// The model must never inject lorem-ipsum, Latin, or template filler. A single
// unambiguous Latin/lorem token (or a "[your …]" placeholder) flags the value as
// filler; we then DROP that edit so the resume keeps its real original text.
const LATIN_FILLER = /\b(lorem|ipsum|dolor|consectetur|adipiscing|eiusmod|incididunt|aliqua|ullamco|laboris|aliquip|commodo|consequat|reprehenderit|voluptate|occaecat|cupidatat|proident|laborum|sit\s+amet|quis\s+nostrud)\b/i
const BRACKET_PLACEHOLDER = /\[(?:your|insert|company|role|title|name|x{2,}|placeholder|tbd|todo)[^\]]*\]|\b(?:lorem ipsum|placeholder text|sample text|dummy text)\b/i
function isFiller(s?: string): boolean {
  if (!s) return false
  return LATIN_FILLER.test(s) || BRACKET_PLACEHOLDER.test(s)
}

// Force the parsed model output into the exact Edits shape — string text everywhere,
// idx-keyed arrays — so downstream code never trips on a non-string (a fast model
// occasionally emits a bullet "text" as an array or number).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEdits(e: any): Edits {
  const str = (v: unknown): string =>
    typeof v === "string" ? v
    : v == null ? ""
    : Array.isArray(v) ? v.filter(x => typeof x === "string").join(" ")
    : typeof v === "object" ? "" : String(v)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (arr: unknown) => Array.isArray(arr)
    ? arr.filter((x: any) => x && typeof x.idx === "number").map((x: any) => ({ idx: x.idx, text: str(x.text) }))
    : []
  return {
    headline: { title: str(e?.headline?.title), tagline: str(e?.headline?.tagline) },
    summary: str(e?.summary),
    skills: list(e?.skills),
    bullets: list(e?.bullets),
    extras: list(e?.extras),
  }
}
// Remove any filler the model slipped in. Filler fields become "" / are dropped,
// so applyRewrites simply leaves the original line untouched.
function stripFiller(edits: Edits): { edits: Edits; dropped: number } {
  let dropped = 0
  const drop = () => { dropped++ }
  if (isFiller(edits.summary)) { edits.summary = ""; drop() }
  if (edits.headline?.title && isFiller(edits.headline.title)) { edits.headline.title = ""; drop() }
  if (edits.headline?.tagline && isFiller(edits.headline.tagline)) { edits.headline.tagline = ""; drop() }
  edits.skills = (edits.skills || []).filter(s => { const f = isFiller(s.text); if (f) drop(); return !f })
  edits.bullets = (edits.bullets || []).filter(b => { const f = isFiller(b.text); if (f) drop(); return !f })
  edits.extras = (edits.extras || []).filter(e => { const f = isFiller(e.text); if (f) drop(); return !f })
  return { edits, dropped }
}

export async function adapt(opts: {
  keys: LlmKeys
  pref?: ProviderPref
  jd: string
  zones: Zones
  preferences: string
  jdKeywords?: string[]
  onePage?: boolean
  mode?: "quick" | "full"
  // Force a specific Claude model for this pass (the tailoring escalation ladder
  // uses this to retry a low-coverage result on a stronger model).
  model?: string
}): Promise<Edits> {
  // Output ceiling — the edit JSON fits well under this. (OpenRouter is clamped lower
  // inside the provider layer.)
  const cap = 4096
  // Build the editable-lines block from the resume's zones.
  let lines = ""
  if (opts.zones.header) {
    const h = opts.zones.header
    lines += "HEADER (name + contact are kept automatically — you may set only the title and tagline to the target role):\n"
    lines += `Name: ${h.name || "(kept)"}\nCurrent title: ${h.title || "(none)"}\n`
    if (h.tagline) lines += `Current tagline: ${h.tagline}\n`
    lines += "\n"
  }
  if (opts.zones.summaryText) lines += `SUMMARY (keep the real details; re-aim the identity only):\n${opts.zones.summaryText}\n\n`
  if (opts.zones.skills.length) {
    lines += "SKILL LINES (focus on the role; keep honest, no keyword dumping; keep each [idx]):\n"
    lines += opts.zones.skills.map(s => `[${s.idx}] ${s.text}`).join("\n") + "\n\n"
  }
  if (opts.zones.roles.length) {
    lines += "EXPERIENCE BULLETS — rewrite ONLY the JD-relevant ones; keep each [idx]:\n"
    for (const r of opts.zones.roles) {
      const tag = r.current ? "  <<< CURRENT ROLE — concentrate ~60-70% of the JD alignment here" : ""
      lines += `Role: ${r.role}${tag}\n`
      lines += r.bullets.map(b => `[${b.idx}] ${b.text}`).join("\n") + "\n"
    }
  }
  // Preserve the candidate's OWN stated experience length — never recompute it
  // from dates (that was silently overwriting e.g. "8+ years" with a shorter
  // computed figure). We capture whatever the source summary already states and
  // instruct the model to keep it verbatim.
  const statedYears = (opts.zones.summaryText || "").match(/\b\d+\s*\+?\s*years?\b/i)?.[0]?.replace(/\s+/g, " ").trim()
  const yoeLine = statedYears
    ? `\n\nCANDIDATE STATED EXPERIENCE: "${statedYears}" — keep this EXACT experience-length wording in the summary. Never increase, decrease, or recompute it.`
    : `\n\nEXPERIENCE LENGTH: the source summary does not state a fixed number of years — do NOT introduce one. Keep the existing seniority framing as-is.`

  // First non-empty JD line is usually the role title — a hint for the single identity.
  const firstLine = (opts.jd.split("\n").map(l => l.trim()).find(Boolean) || "").slice(0, 120)
  const idLine = firstLine ? `\n\nTARGET ROLE (infer the ONE primary identity from the whole JD; this line is just a hint): ${firstLine}` : ""
  const kwLine = opts.jdKeywords?.length
    ? `\n\nTOOLS THE JD CENTERS ON (absorb ONLY the ones this candidate can defend; put the central ones inside bullets, not just skills): ${opts.jdKeywords.join(", ")}`
    : ""
  const pref = opts.preferences
    ? `\n\nUSER PREFERENCES (honor strictly): ${opts.preferences}`
    : ""
  // One-page mode: condense to a single page WITHOUT touching formatting — keep only the
  // most JD-relevant bullets per role (current role ≤5, older roles ≤3), make every kept
  // line tighter, and hold the summary to ~45-55 words. Edit existing lines only; do not
  // invent or remove structure (the format/length rules below still apply).
  const onePageLine = opts.onePage
    ? `\n\nONE-PAGE MODE (strict): the user wants a single-page resume. Tighten aggressively — rewrite the CURRENT role to its 4-5 strongest JD-aligned bullets and each older role to its 2-3 strongest, make every kept bullet concise (one line each), and keep the summary to ~45-55 words. Prioritise the JD's most-wanted skills. Still edit existing lines in place only; never change names, dates, companies, or formatting.`
    : ""
  // Quick mode: a fast, focused pass on the highest-impact lines only (routed to the
  // fast/light model below). Full mode (default) does the comprehensive rewrite.
  const quickLine = opts.mode === "quick"
    ? `\n\nQUICK MODE: do a fast, focused pass — rewrite the headline, summary, the top 2-3 skill lines, and the 5-6 strongest bullets in the CURRENT role only. Skip marginal edits; speed over exhaustiveness.`
    : ""
  const user =
    `JOB DESCRIPTION:\n${opts.jd.slice(0, 4000)}${idLine}${kwLine}${yoeLine}${onePageLine}${quickLine}\n\n` +
    `RESUME LINES TO EDIT (each [idx] is stable — return only what you change):\n${lines.slice(0, 11000)}${pref}\n\nReturn the rewrite JSON.`

  // Try twice: a one-off malformed reply no longer fails the whole tailoring.
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string
    try {
      // Low temperature → CONSISTENT keyword coverage & escalation decisions run-to-run
      // (default sampling swung 93–98% coverage and 25–73s on identical input).
      text = (await callLLM({ keys: opts.keys, tier: opts.mode === "quick" ? "light" : "heavy", pref: opts.pref, system: RULES, user, maxTokens: cap, model: opts.model, temperature: 0.2 })).text
    } catch (e) {
      lastErr = e
      // Auth / bad-request errors won't fix themselves on retry.
      if (/\b(400|401|403)\b/.test(String(e))) throw e
      continue
    }
    try {
      const parsed = parseJson(text)
      // Coerce every field to a safe shape first — faster models occasionally return
      // a bullet/skill `text` as a non-string, which later `.trim()` calls would crash on.
      const normalized = normalizeEdits(parsed)
      // Hard guard: strip any lorem-ipsum / Latin / placeholder filler before it can
      // ever reach the document. Dropped fields keep the resume's real original text.
      const { edits } = stripFiller(normalized)
      // Preserve the years: if the model changed the experience length, restore the
      // candidate's OWN wording from the source summary (exact string, incl. any "+").
      // We never recompute from work-history dates — that only ever misled the figure.
      const computed = statedYears?.match(/\d+/)?.[0]
      if (statedYears && edits.summary) {
        edits.summary = /\b\d+\s*\+?\s*years?\b/i.test(edits.summary)
          ? edits.summary.replace(/\b\d+\s*\+?\s*years?\b/i, statedYears)
          : edits.summary
      }
      // Safety net: if the model returned "" for headline.title despite the RULES,
      // infer it from the JD's first non-empty line (typically the role title).
      if (!edits.headline) edits.headline = {}
      if (!edits.headline.title) {
        edits.headline.title = firstLine || ""
      }
      // Enforce the CLAUDE.md text rules on the summary even if the model slips:
      // never ship a "Having …" opener (the #1 AI fingerprint), and keep it to one
      // paragraph of ≤80 words. Both are safe text-only transforms (no format change).
      if (edits.summary) {
        edits.summary = clampSummary(
          fixHavingOpener(edits.summary, { title: edits.headline.title, years: computed }),
          80,
        )
      }
      return edits
    } catch (e) { lastErr = e }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Claude request failed")
}

// ── Targeted coverage augment (token-smart escalation) ─────────────────────────
// Instead of re-sending the WHOLE resume to a stronger/costlier model, send only the
// ATS surface that can absorb the gap — the skill lines + the CURRENT role's bullets
// (+ the summary only if the base pass left it empty) — plus the exact JD terms still
// missing. The strong model sees the smallest possible payload, so escalation costs a
// fraction of a full re-draft. Returns edits to MERGE onto the base pass (by idx).
export async function augmentCoverage(opts: {
  keys: LlmKeys
  pref?: ProviderPref
  model?: string
  jd: string
  zones: Zones
  missing: string[]
  fillSummary: boolean
}): Promise<Edits> {
  const cap = 4096
  let lines = ""
  if (opts.zones.skills.length) {
    lines += "SKILL LINES (rewrite each at its own [idx] to honestly surface the missing terms; one line per [idx], never merge):\n"
    lines += opts.zones.skills.map(s => `[${s.idx}] ${s.text}`).join("\n") + "\n\n"
  }
  const cur = opts.zones.roles.find(r => r.current) || opts.zones.roles[0]
  if (cur) {
    lines += `CURRENT ROLE BULLETS — ${cur.role} (rewrite the JD-relevant ones; keep each [idx]):\n`
    lines += cur.bullets.map(b => `[${b.idx}] ${b.text}`).join("\n") + "\n\n"
  }
  if (opts.fillSummary && opts.zones.summaryText) {
    lines += `SUMMARY (return a rewritten one — the previous pass left it empty; keep the candidate's stated experience length verbatim):\n${opts.zones.summaryText}\n\n`
  }
  const user =
    `JOB DESCRIPTION (context):\n${opts.jd.slice(0, 2500)}\n\n` +
    `MISSING JD TERMS — weave EACH one the candidate can honestly support into the most relevant skill line or current-role bullet, using the JD's exact wording (never invent unsupported claims): ${opts.missing.join(", ")}\n\n` +
    `RESUME LINES YOU MAY EDIT (return ONLY the idxs you change):\n${lines}\nReturn the rewrite JSON.`

  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string
    try {
      text = (await callLLM({ keys: opts.keys, tier: "heavy", pref: opts.pref, system: RULES, user, maxTokens: cap, model: opts.model })).text
    } catch (e) {
      if (/\b(400|401|403)\b/.test(String(e))) throw e
      continue
    }
    try {
      const { edits } = stripFiller(normalizeEdits(parseJson(text)))
      // This pass only augments skills/bullets (+ summary if it was empty). Never let
      // it touch the headline, and drop its summary unless we explicitly asked for one.
      edits.headline = undefined
      if (!opts.fillSummary) edits.summary = ""
      // Preserve the candidate's stated years verbatim if a summary came back.
      const stated = (opts.zones.summaryText || "").match(/\b\d+\s*\+?\s*years?\b/i)?.[0]
      if (stated && edits.summary && /\b\d+\s*\+?\s*years?\b/i.test(edits.summary)) {
        edits.summary = edits.summary.replace(/\b\d+\s*\+?\s*years?\b/i, stated)
      }
      return edits
    } catch { /* retry once */ }
  }
  return { skills: [], bullets: [] }
}

// Builder AI-assist: revise ONE field (summary / a skill line / a bullet / a cert)
// from a short user instruction. Returns plain text for that field only.
export async function assistField(opts: {
  keys: LlmKeys
  pref?: ProviderPref
  section: string
  current: string
  instruction: string
  jd?: string
}): Promise<string> {
  const system = `You edit ONE field of a resume. Return ONLY the revised text for that field — no quotes, no markdown, no labels, no commentary, no leading bullet glyph. Keep first person if the original is first person. Write in an authentic, specific senior-engineer voice: real tools and real work, no buzzwords (spearheaded, leveraged, orchestrated, utilized), no invented percentages or fake metrics. A "summary" is one tight 3-4 sentence paragraph; a "skill line" or "bullet" is a single line.`
  const jdCtx = opts.jd ? `\n\nJOB DESCRIPTION CONTEXT (for relevance):\n${opts.jd.slice(0, 1500)}` : ""
  const user =
    `FIELD: ${opts.section}\nCURRENT TEXT:\n${opts.current || "(empty)"}${jdCtx}\n\n` +
    `INSTRUCTION: ${opts.instruction}\n\nReturn ONLY the revised ${opts.section} text.`

  const text = (await callLLM({ keys: opts.keys, tier: "light", pref: opts.pref, system, user, maxTokens: 600 })).text.trim()
  // Strip any stray wrapping quotes / leading bullet the model may add.
  const cleaned = text.replace(/^["'`]+|["'`]+$/g, "").replace(/^\s*[•\-–*]\s*/, "").trim()
  // Never let placeholder/Latin filler replace the user's real line — keep the original.
  return isFiller(cleaned) ? opts.current : cleaned
}

export function parseJson(text: string): Edits {
  // Strip markdown code fences and any prose before the JSON object.
  let t = text.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim()
  const start = t.indexOf("{")
  if (start > 0) t = t.slice(start)

  let firstErr = ""

  // 1) Straight parse.
  try { return JSON.parse(t) } catch (e) { firstErr = String((e as Error).message) }

  // 2) Trim to the last closing brace (drops trailing junk).
  const lastBrace = t.lastIndexOf("}")
  if (lastBrace > 0) {
    try { return JSON.parse(t.slice(0, lastBrace + 1)) } catch { /* fall through */ }
  }

  // 3) Repair a truncated reply: close any dangling string and open brackets.
  try { return JSON.parse(repairJson(t)) } catch { /* fall through */ }

  // 4) Escape raw control chars (newlines/tabs) that the model left INSIDE
  //    strings — the most common breaker — then retry, with and without repair.
  const cleaned = sanitizeJson(t)
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  try { return JSON.parse(repairJson(cleaned)) } catch { /* fall through */ }

  // Still bad: throw with a precise window around the failure for diagnosis.
  const pos = Number(firstErr.match(/position (\d+)/)?.[1] ?? -1)
  const near = pos >= 0 ? t.slice(Math.max(0, pos - 70), pos + 70) : t.slice(0, 200)
  throw new Error(`Claude returned malformed JSON (${firstErr}); len=${t.length}; near=⟪${near}⟫`)
}

// Repair the JSON the model commonly emits malformed: raw control chars inside
// strings, stray unescaped double-quotes inside strings, and trailing commas.
function sanitizeJson(s: string): string {
  let out = "", inStr = false, esc = false
  const isWs = (ch: string) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r"
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) { out += c; esc = false; continue }
      if (c === "\\") { out += c; esc = true; continue }
      if (c === '"') {
        // Closing quote only if the next non-space char ends the value
        // (, } ] :) or the input; otherwise it's a stray inner quote → escape it.
        let j = i + 1
        while (j < s.length && isWs(s[j])) j++
        const nxt = s[j]
        if (nxt === undefined || nxt === "," || nxt === "}" || nxt === "]" || nxt === ":") {
          out += '"'; inStr = false
        } else {
          out += '\\"'
        }
        continue
      }
      const code = c.charCodeAt(0)
      if (code < 0x20) {
        out += c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : " "
        continue
      }
      out += c; continue
    }
    if (c === '"') { inStr = true; out += c; continue }
    if (c === "{") {
      // Collapse a stray doubled opening brace ("},{{" → "},{"): "{{" is never valid JSON.
      out += "{"
      while (s[i + 1] === "{") i++
      continue
    }
    if (c === ",") {
      // Drop a trailing comma before a closing } or ].
      let j = i + 1
      while (j < s.length && isWs(s[j])) j++
      if (s[j] === "}" || s[j] === "]") continue
      out += c; continue
    }
    out += c
  }
  return out
}

// Best-effort repair for output that was cut off mid-structure.
function repairJson(s: string): string {
  const stack: string[] = []
  let inStr = false, esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]")
    else if (c === "}" || c === "]") stack.pop()
  }
  let out = s
  if (inStr) out += '"'            // close a dangling string
  out = out.replace(/,\s*$/, "")   // drop a trailing comma
  while (stack.length) out += stack.pop() // close open arrays/objects
  return out
}
