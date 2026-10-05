import { J1_HEADER, constrainResumeEdits } from "./ai/j1"
import { routeFieldEdit } from "./ai/jev"
import type { Edits, Zones } from "./docx"
import { callLLM, type LlmKeys, type ProviderPref, type TokenUsage } from "./llm"
import { fixHavingOpener, clampSummary } from "./resume/rules"

const OUTPUT_SCHEMA = `Return ONE minified JSON object, exactly:
{"headline":{"title":"","tagline":""},"summary":"","skills":[{"idx":0,"text":""}],"bullets":[{"idx":0,"text":""}],"added":[]}
Use empty strings/arrays for unchanged fields. Return only changed indices, no markdown or commentary.`

const RULES = `${J1_HEADER}
You tailor wording in an existing resume to a job description using the baseline facts and the JD skills confirmed by the user through submission. Highlight relevant real experience, preserve unrelated truthful content, and leave already good lines unchanged. There is no minimum number of edits and no target match percentage. Include the JD’s explicitly listed skills and technologies in the existing skills lines, even if not previously listed. Do not infer non-skill qualifications from the JD.
Keep headline title and tagline empty to preserve the original. Never add/remove paragraphs or merge multiple summary paragraphs. A summary may be shortened without changing facts. Write natural professional language at the candidate's actual level; avoid inflated wording, buzzwords and copied JD sentences. Keep each skill and bullet at its original index. Tools must remain associated with their documented role. Do not add fictional production incidents or ownership. Never convert exposure to proficiency.
${OUTPUT_SCHEMA}`

const REFINE_RULES = `${RULES}
Apply ONLY the candidate's specific requested wording change. Do not rewrite other sections. A request to add a skill is not evidence that it was used at every employer. Preserve the source when the request needs facts not supplied. Add no new bullets, metrics or credentials. Return unchanged content as empty fields.`

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
  // A model sometimes echoes a line's "[idx]" tag into its text ("[154] Triaged ..."), which
  // would print into the resume, so it is stripped.
  const list = (arr: unknown) => Array.isArray(arr)
    ? arr.filter((x: unknown): x is { idx: number; text?: unknown } =>
        typeof x === "object" && x !== null && "idx" in x && typeof x.idx === "number"
      ).map(x => ({ idx: x.idx, text: str(x.text).replace(/^\s*\[(?:\d+|\+)\]\s*/, "") }))
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
  // Exactly this model id on the provider `pref` names (one lane of the tailor: see runTailor).
  exactModel?: string
  // Collects per-call token usage so the caller can total a tailor's real cost.
  usageSink?: TokenUsage[]
  // REFINEMENT: `preferences` holds ONE change request for an already-tailored resume, run
  // under REFINE_RULES instead of a full retarget. An omitted title then means "keep".
  refine?: boolean
  // FULL RETARGET, split into parallel calls by runTailor: "profile" rewrites the headline,
  // summary, and skill lines; "experience" rewrites only the bullets of zones.roles[i] for each
  // i in `roles`. One call doing everything put the JD into the skills and the current role and
  // left the older roles untouched.
  part?: "profile" | "experience"
  roles?: number[]
  // May this call append NEW bullets ("added")? Gap-fill passes, which ask for a specific number,
  // and refinements may; every other pass only edits existing lines.
  allowAdd?: boolean
}): Promise<Edits> {
  // Output ceiling — the edit JSON fits well under this. (OpenRouter is clamped lower
  // inside the provider layer.) A refinement like "shorten every bullet" can return far
  // more lines than a normal retarget, so it gets more room, and so does a bullets pass,
  // which may include several roles without imposing an edit quota.
  const part = opts.refine ? undefined : opts.part
  const roleSet = part === "experience" && opts.roles ? new Set(opts.roles) : null
  const editRoles = roleSet ? opts.zones.roles.filter((_, i) => roleSet.has(i)) : opts.zones.roles
  const cap = opts.refine ? 8192 : part === "experience" ? 6144 : 4096
  // Build the editable-lines block from the resume's zones. Only lines tagged [idx] can come
  // back as edits, so each split pass shows the other sections as plain context.
  let lines = ""
  if (opts.zones.header && part !== "experience") {
    const h = opts.zones.header
    lines += "HEADER (all identity fields are immutable; context only):\n"
    lines += `Name: ${h.name || "(kept)"}\nCurrent title: ${h.title || "(none)"}\n`
    if (h.tagline) lines += `Current tagline: ${h.tagline}\n`
    lines += "\n"
  }
  if (opts.zones.summaryText) {
    lines += part === "experience"
      ? `CANDIDATE SUMMARY (context only, do not return it):\n${opts.zones.summaryText}\n\n`
      : `SUMMARY (keep the real details; re-aim the identity only):\n${opts.zones.summaryText}\n\n`
  }
  if (opts.zones.skills.length) {
    lines += part === "experience"
      ? "SKILLS THE CANDIDATE LISTS (context only, do not return them; the bullets must PROVE these):\n" + opts.zones.skills.map(s => s.text).join("\n") + "\n\n"
      : "SKILL LINES (focus on the role; keep honest, no keyword dumping; keep each [idx]):\n" + opts.zones.skills.map(s => `[${s.idx}] ${s.text}`).join("\n") + "\n\n"
  }
  if (part === "profile") {
    if (opts.zones.roles.length) lines += "WORK HISTORY (context only; a parallel pass rewrites its bullets):\n" + opts.zones.roles.map(r => `- ${r.role.replace(/\s+/g, " ")}`).join("\n") + "\n"
  } else if (editRoles.length) {
    lines += (opts.refine || opts.mode === "quick")
      ? "EXPERIENCE BULLETS (keep each [idx]):\n"
      : "EXPERIENCE BULLETS — preserve role-specific evidence; keep each [idx] ([+] lines were already added during this tailoring: leave them and don't repeat them):\n"
    for (const r of editRoles) {
      lines += `ROLE #${opts.zones.roles.indexOf(r)}: ${r.role}${r.current ? "  (current role)" : ""}\n`
      lines += r.bullets.map(b => `[${b.idx}] ${b.text}`).join("\n") + "\n"
      if (r.added?.length) lines += r.added.map(t => `[+] ${t}`).join("\n") + "\n"
    }
    const others = roleSet ? opts.zones.roles.filter((_, i) => !roleSet.has(i)) : []
    if (others.length) lines += `\nOTHER ROLES (a parallel pass rewrites these; do not return their bullets): ${others.map(r => r.role.replace(/\s+/g, " ")).join(" | ")}\n`
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
  // A refinement gets no keyword list: it invites "absorbing" more terms, which is exactly the
  // churn a targeted change must avoid (the JD itself is still in the prompt).
  const kwLine = opts.jdKeywords?.length && !opts.refine
    ? `\n\nTOOLS THE JD CENTERS ON (absorb ONLY the ones this candidate can defend; ${part === "profile" ? "surface them in the skill lines" : "use them only in roles where their use is documented"}): ${opts.jdKeywords.join(", ")}`
    : ""
  const pref = !opts.preferences ? ""
    : opts.refine ? `\n\nCHANGE REQUEST FROM THE CANDIDATE (apply exactly this, nothing else): ${opts.preferences}`
    : `\n\nUSER PREFERENCES (honor within J1 evidence and structure constraints): ${opts.preferences}`
  // One-page mode: condense to a single page WITHOUT touching formatting — keep only the
  // most JD-relevant bullets per role (current role ≤5, older roles ≤3), make every kept
  // line tighter, and hold the summary to ~45-55 words. Edit existing lines only; do not
  // invent or remove structure (the format/length rules below still apply).
  const onePageLine = opts.onePage
    ? `\n\nONE-PAGE MODE (strict): the user wants a single-page resume. Tighten existing wording without deleting or merging lines. Aim for a shorter summary where its structure permits, and preserve every documented fact. Page count is not guaranteed; never force it by inventing or removing experience. Still edit existing lines in place only; never change names, dates, companies, or formatting.`
    : ""
  // Quick mode: a fast, focused pass on the highest-impact lines only (routed to the
  // fast/light model below). Full mode (default) does the comprehensive rewrite.
  const quickLine = opts.mode === "quick"
    ? `\n\nQUICK MODE: do a fast, focused pass — consider only the summary, the top 2-3 skill lines, and the strongest bullets in the CURRENT role. Keep the headline unchanged and return only useful, evidence-supported edits. Skip marginal edits; speed over exhaustiveness.`
    : ""
  // Split passes: say exactly which fields this call owns (see `part` above).
  const scopeLine = part === "profile"
    ? `\n\nTHIS PASS — PROFILE ONLY: keep the headline unchanged; include the user-confirmed JD skills in the existing skill lines and relevant summary wording. Return "bullets": [] (a parallel pass is rewriting the experience bullets against the same JD).`
    : part === "experience"
    ? `\n\nTHIS PASS — EXPERIENCE BULLETS ONLY, for the roles shown with [idx] lines. Return empty headline, summary and skills. Edit only bullets whose real documented experience is relevant. Leave every unsupported JD requirement out. Keep each bullet and each multi-part line at its original index.`
    : ""
  // The RESUME + the candidate's fixed experience-length are STABLE across every JD, so
  // they go in a cached block (cacheContext). Only the JD-derived hints + user prefs vary
  // per call → tailoring the same resume against many JDs re-reads the resume at ~10% cost.
  // Both limits used to be far too small for real inputs: the resume block was cut at 11,000
  // characters, so on a 4-role resume the last two roles were never sent (on a 5-role one, the
  // last three), and the JD at 4,000, which dropped its whole Required Qualifications tool list.
  const cacheContext =
    `RESUME LINES TO EDIT (each [idx] is stable — return only what you change):\n${lines.slice(0, 40000)}${yoeLine}`
  const user =
    `JOB DESCRIPTION:\n${opts.jd.slice(0, 12000)}${idLine}${kwLine}${onePageLine}${quickLine}${pref}${scopeLine}\n\n` +
    `Using the resume lines provided, return the rewrite JSON (only the [idx] lines you change).`

  // Try twice: a one-off malformed reply no longer fails the whole tailoring.
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string
    try {
      // Low temperature → CONSISTENT keyword coverage & escalation decisions run-to-run
      // (default sampling swung 93–98% coverage and 25–73s on identical input).
      text = (await callLLM({ keys: opts.keys, tier: opts.mode === "quick" ? "light" : "heavy", pref: opts.pref, system: opts.refine ? REFINE_RULES : RULES, cacheContext, user, maxTokens: cap, model: opts.model, exactModel: opts.exactModel, temperature: 0.2, usageSink: opts.usageSink })).text
    } catch (e) {
      lastErr = e
      // Auth / bad-request errors won't fix themselves on retry, and a rate limit (429) was
      // already retried inside the provider layer: repeating the whole call only burns the
      // time budget, so hand it back and let the ladder use another provider. The same goes for
      // "no credit" (402), a model that does not exist (404) and a request too large for the allowance (413), and for a
      // call that ran out of time: asking the same model again would spend the rest of the tailor's time on it.
      if (/API (400|401|402|403|404|413|429)\b|TimeoutError|AbortError|timed out|aborted/i.test(String(e))) throw e
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
      // New bullets come back as { role: <ROLE #>, text } and are anchored after that role's last
      // bullet: only for roles this call was shown, and only when adding is allowed.
      const rawAdded: unknown[] = Array.isArray((parsed as { added?: unknown }).added) ? (parsed as { added: unknown[] }).added : []
      edits.added = (opts.allowAdd || opts.refine) ? rawAdded.flatMap(a => {
        const { role, text } = (a || {}) as { role?: unknown; text?: unknown }
        const r = typeof role === "number" ? opts.zones.roles[role] : undefined
        const t = typeof text === "string" ? text.replace(/^\s*\[(?:\d+|\+)\]\s*/, "").trim() : ""
        if (!r || !r.bullets.length || !t || isFiller(t) || (roleSet && !roleSet.has(role as number))) return []
        return [{ after: r.bullets[r.bullets.length - 1].idx, text: t }]
      }) : []
      // A split pass owns only its own fields: an experience pass may touch nothing but the
      // bullets of the roles it was given, and a profile pass never touches bullets.
      if (part === "experience") {
        const allowed = new Set(editRoles.flatMap(r => r.bullets.map(b => b.idx)))
        edits.headline = { title: "", tagline: "" }
        edits.summary = ""
        edits.skills = []
        edits.bullets = (edits.bullets || []).filter(b => allowed.has(b.idx))
      } else if (part === "profile") {
        edits.bullets = []
        edits.added = []
      }
      // Preserve the years: if the model changed the experience length, restore the
      // candidate's OWN wording from the source summary (exact string, incl. any "+").
      // We never recompute from work-history dates — that only ever misled the figure.
      const computed = statedYears?.match(/\d+/)?.[0]
      if (statedYears && edits.summary) {
        edits.summary = /\b\d+\s*\+?\s*years?\b/i.test(edits.summary)
          ? edits.summary.replace(/\b\d+\s*\+?\s*years?\b/i, statedYears)
          : edits.summary
      }
      // J1 preserves the baseline identity; never infer a candidate title from the JD.
      edits.headline = { title: "", tagline: "" }
      // Enforce the CLAUDE.md text rules on the summary even if the model slips:
      // never ship a "Having …" opener (the #1 AI fingerprint), and keep it to one
      // paragraph of ≤80 words. Both are safe text-only transforms (no format change).
      if (edits.summary) {
        edits.summary = clampSummary(
          fixHavingOpener(edits.summary, { title: edits.headline.title, years: computed }),
          80,
        )
      }
      return constrainResumeEdits(edits, opts.zones)
    } catch (e) { lastErr = e }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Claude request failed")
}

// ── JD keyword EXPANSION (second prompt, runs alongside the tailor) ────────────
// The deterministic extractor in keywords.ts only sees terms literally present in the
// JD. This asks the model for the ATS keywords a recruiter would ALSO expect for this
// role — synonyms, the expanded form of an acronym (and vice-versa), and standard tools
// implied by the stack — so the tailor has a richer target list to weave in. Returns a
// plain string[]; ALWAYS resolves (never throws) so a slow/failed call can't break or
// stall a tailor — the caller just proceeds with the extracted keywords alone.
export async function expandJdKeywords(opts: {
  keys: LlmKeys
  pref?: ProviderPref
  jd: string
  known?: string[]
  model?: string
  timeoutMs?: number
  usageSink?: TokenUsage[]
}): Promise<string[]> {
  const system = `You are an ATS keyword extractor. Given a job description, list the keywords an applicant tracking system would scan for.
RULES:
- Output ONLY a minified JSON array of lowercase strings. No prose, no markdown, no keys.
- Include: hard skills, tools, platforms, frameworks, certifications, methodologies, and domain phrases.
- Include BOTH forms of an acronym when the role uses them (e.g. "iam" and "identity and access management").
- Include standard tools/technologies clearly implied by the stack even if not named verbatim.
- EXCLUDE soft skills, company names, benefits, locations, and generic words ("team", "strong", "experience").
- Keep each entry 1-4 words. Max 60 entries.
Example output: ["kubernetes","terraform","iam","identity and access management","siem"]`
  const user =
    `JOB DESCRIPTION:
${opts.jd.slice(0, 12000)}

` +
    (opts.known?.length ? `ALREADY CAPTURED (return ADDITIONAL ones, do not repeat these): ${opts.known.slice(0, 60).join(", ")}

` : "") +
    `Return the JSON array of ATS keywords.`

  const call = (async () => {
    const text = (await callLLM({
      keys: opts.keys, tier: "light", pref: opts.pref, system, user,
      maxTokens: 700, model: opts.model, temperature: 0.2, usageSink: opts.usageSink,
    })).text
    let t = text.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim()
    const a = t.indexOf("["), b = t.lastIndexOf("]")
    if (a >= 0 && b > a) t = t.slice(a, b + 1)
    const arr = JSON.parse(t)
    if (!Array.isArray(arr)) return []
    const out: string[] = []
    for (const v of arr) {
      if (typeof v !== "string") continue
      const k = v.toLowerCase().trim().replace(/[.,;:]+$/, "")
      // 2-40 chars, at most 4 words, no filler — same precision bar as the extractor.
      if (k.length < 2 || k.length > 40) continue
      if (k.split(/\s+/).length > 4) continue
      if (isFiller(k)) continue
      out.push(k)
    }
    return [...new Set(out)].slice(0, 60)
  })()

  // Hard cap: this is an ENHANCEMENT, never a reason for the tailor to wait.
  const ms = opts.timeoutMs ?? 8000
  return Promise.race([
    call.catch(() => [] as string[]),
    new Promise<string[]>(r => setTimeout(() => r([]), ms)),
  ])
}

// ── JD metadata (role / company / location) ───────────────────────────────────
// Reported back on every WhatsApp generation so the user knows which job a resume was
// built for. Cheap light-tier call; ALWAYS resolves (never throws) and self-times-out,
// so it can never block or fail a generation — worst case the fields come back empty.
export async function extractJdMeta(opts: {
  keys: LlmKeys
  pref?: ProviderPref
  jd: string
  timeoutMs?: number
  usageSink?: TokenUsage[]
}): Promise<{ role: string; company: string; location: string }> {
  const empty = { role: "", company: "", location: "" }
  const system = `Extract job posting metadata. Output ONLY minified JSON, no prose:
{"role":"","company":"","location":""}
- role: the job title only (e.g. "Senior Cloud Security Engineer"). No seniority invented.
- company: the hiring company. Use "" if it is a staffing/bench email with no named client.
- location: city/state/country, or "Remote", or "Hybrid - <city>". Use "" if absent.
Never guess. If a field is not stated, return "" for it.`
  const user = `JOB DESCRIPTION:
${opts.jd.slice(0, 3000)}

Return the JSON.`

  const call = (async () => {
    const text = (await callLLM({
      keys: opts.keys, tier: "light", pref: opts.pref, system, user,
      maxTokens: 200, temperature: 0, usageSink: opts.usageSink,
    })).text
    let t = text.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim()
    const a = t.indexOf("{"), b = t.lastIndexOf("}")
    if (a >= 0 && b > a) t = t.slice(a, b + 1)
    const o = JSON.parse(t) as Record<string, unknown>
    const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) : "")
    const clean = (v: string) => (isFiller(v) ? "" : v)
    return { role: clean(str(o.role)), company: clean(str(o.company)), location: clean(str(o.location)) }
  })()

  const ms = opts.timeoutMs ?? 8000
  return Promise.race([
    call.catch(() => empty),
    new Promise<typeof empty>(r => setTimeout(() => r(empty), ms)),
  ])
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
    `MISSING JD TERMS — include each skill explicitly listed in the submitted JD in the most relevant existing skill line. Use current-role bullets only when that role's use is documented. Related model-generated terms are not new confirmed skills: ${opts.missing.join(", ")}\n\n` +
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
      return constrainResumeEdits(edits, opts.zones)
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
  const system = `${J1_HEADER}\nYou edit ONE field of a resume. Return ONLY the revised text for that field — no quotes, no markdown, no labels, no commentary, no leading bullet glyph. Keep first person if the original is first person. Write in an authentic voice at the candidate's documented experience level: real tools and real work, no buzzwords (spearheaded, leveraged, orchestrated, utilized), no invented percentages or fake metrics. A "summary" is one tight 3-4 sentence paragraph; a "skill line" or "bullet" is a single line.`
  const jdCtx = opts.jd ? `\n\nJOB DESCRIPTION CONTEXT (for relevance):\n${opts.jd.slice(0, 1500)}` : ""
  const user =
    `FIELD: ${opts.section}\nCURRENT TEXT:\n${opts.current || "(empty)"}${jdCtx}\n\n` +
    `INSTRUCTION: ${opts.instruction}\n\nReturn ONLY the revised ${opts.section} text.`

  const route = await routeFieldEdit({ section: opts.section, instruction: opts.instruction })
  const text = (await callLLM({ keys: opts.keys, tier: route.tier, pref: opts.pref, system, user, maxTokens: 600 })).text.trim()
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
