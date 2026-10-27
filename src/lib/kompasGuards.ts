// Kompas grounding guards — anti-hallucination code ported from perfACT's
// interview engine (copilot/api/answer.js). Prompt rules are wishes; these are
// guarantees: figures, employers, titles, dates and places in a spoken answer
// must come from the candidate's own material, or they are rewritten into
// natural wording that claims nothing. Never a blank, never a placeholder.
//
// _guard.js (allowedNumbers/guardText/needsGuard) was not in the Drive source,
// so the figures allowlist is reconstructed from its call sites and the
// FIGURES prompt it feeds. Everything else is a verbatim port.

export interface SpeakFacts {
  employer: string
  title: string
  /** lowercase concatenation of every source — resume, JD, documents, heard text */
  known: string
}

// ---------------------------------------------------------------- figures ---
// The ONLY result numbers the answer may state are these, from the
// candidate's own material. Same extraction perfACT feeds its FIGURES prompt.
const FIGURE_RE = /\b\d[\d,.]*\+?(?:\s*(?:%|x\b|years?|yrs?|months?|k\b|M\b))?/g
const normFigure = (f: string) => f.toLowerCase().replace(/\s+/g, " ").trim()

export function allowedNumbers(...sources: Array<string | undefined>): Set<string> {
  const out = new Set<string>()
  for (const s of sources) {
    const m = String(s || "").match(FIGURE_RE)
    if (m) for (const f of m) out.add(normFigure(f))
  }
  return out
}

// Technical constants are fine (perfACT's FIGURES prompt says so): ports,
// versions, CVEs, event IDs, error codes, rule thresholds. A bare number next
// to one of these words — or inside a hyphenated identifier — is not a claim.
function isTechnicalConstant(line: string, fig: string, at: number): boolean {
  const before = line.slice(Math.max(0, at - 28), at)
  const after = line.slice(at + fig.length, at + fig.length + 14)
  const value = fig.replace(/[.,]+$/, "")
  if (/\b(port|ports|version|v\.?|cve[-\s]?|event(?:\s*id)?|error|code|rule|threshold|severity|p[0-4]|build|ticket|case|change)\s*$/i.test(before)) return true
  if (/^x[0-9a-f]/i.test(after)) return true
  if (/^\s*(port|ports)\b/i.test(after)) return true
  // Structural numbers are labels, not result claims — the guard rewrote them
  // all to "several" (26 Oct 2026 live rounds: "Hypothesis several", "Tier
  // several", "several:several UTC", "id=several"). A result claim ("cut by
  // 40%", "5 rules created") still has no label word before it, so it stays
  // guarded; only a number that IS the label, the time, the id or the
  // threshold passes through.
  if (/\b(?:hypothes(?:is|es)|options?|steps?|phases?|tiers?|rules?|controls?|requirements?|items?|cases?)\s*:?\s*$/i.test(before)) return true
  // A bare ordinal back-reference ("For 1 I check the event log") points at
  // a hypothesis by its number, exactly like "For Hypothesis 1" does; the
  // label word is absent only because the sentence is elliptical. Kept
  // narrow on purpose: "For 5 years" has a unit after the figure, not a
  // first-person test verb, so durations still guard.
  if (/\bfor\s*$/i.test(before) && /^,?\s+i\s+(check|query|inspect|review|test|verify|examine|rule)\b/i.test(after)) return true
  if (/\d:$/.test(before) || /^:\d/.test(after)) return true
  if (/\bid\s*[=#:]\s*$/i.test(before)) return true
  if (/[\u2265\u2264<>]\s*$/.test(before)) return true
  // HTTP responses and product versions describe a mechanism, not a result
  // claimed from the candidate's career. Do not turn `returns 403` into
  // `returns several` while guarding unsupported achievement metrics.
  if (/^[1-5]\d{2}$/.test(value) && /\b(?:http|status|returns?|responds?(?: with)?|receives?|expects?)(?: an?)?\s*$/i.test(before)) return true
  if (/^[1-5]\d{2}$/.test(value) && (/\b(?:forbidden|unauthorized|responses?|status|http)\b/i.test(after) || /(?:expect\w*|return\w*|respond\w*|receiv\w*|status|http)[^.\n]{0,20}$/i.test(before))) return true
  if (/^\d+\.\d+(?:\.\d+)?$/.test(value) && /\b(?:kubernetes|istio|nginx|splunk(?: es)?|python|node(?:\.js)?|java|postgres(?:ql)?|kong|tls)\s*$/i.test(before)) return true
  if (/\b(?:invoice_id|customer_id|tenant_id|owner_id)\s*=\s*$/i.test(before) || /\/invoices\/\s*$/i.test(before)) return true
  if (/[-_#]$/.test(before) || /^[-_]/.test(after)) return true
  return false
}

export function needsGuard(line: string, allowed: Set<string>): boolean {
  const figs = String(line || "").match(FIGURE_RE) || []
  for (const f of figs) {
    const fig = f as string
    if (allowed.has(normFigure(fig))) continue
    const at = String(line).indexOf(fig)
    if (isTechnicalConstant(String(line), fig, at)) continue
    return true
  }
  return false
}

function plainFor(fig: string, hasArticle: boolean): string {
  const f = fig.toLowerCase().trim()
  const num = f.replace(/[,.]/g, "")
  if (/%$/.test(f)) return hasArticle ? "noticeable" : "noticeably"
  if (/\byears?\b/.test(f) || /\byrs?\b/.test(f)) return "several years"
  if (/\bmonths?\b/.test(f)) return "a few months"
  if (/\bdays?\b/.test(f)) return "several days"
  if (/\bhours?\b/.test(f)) return "several hours"
  if (/x$/i.test(f)) return "multiple times"
  if (/k$/i.test(f)) return "thousands"
  if (/m$/i.test(f)) return "millions"
  if (/^\d{4}$/.test(num) && +num >= 1900 && +num <= 2100) return "a few years ago"
  if (/^\d+$/.test(num)) return "several"
  return "several"
}

// Unsupported figures become natural wording — never a blank. The model only
// ever sees the FIGURES allowlist; this is the backstop when it invents one.
export function guardText(line: string, allowed: Set<string>): { text: string; removed: number } {
  let removed = 0
  const re = new RegExp(FIGURE_RE.source, "g")
  let text = String(line || "").replace(re, (fig: string, offset: number, full: string) => {
    // A trailing period that ends a sentence is punctuation, not part of the
    // figure: "3." at a sentence end must not lose its period when the
    // figure is rewritten ("3. Hypothesis 1" must never become "several
    // Hypothesis 1"). Decimals ("3.5") never end in a period, so they are
    // untouched by this split.
    let core = fig
    let suffix = ""
    if (/\.$/.test(fig) && !/\d/.test(full[offset + fig.length] || "")) {
      core = fig.slice(0, -1)
      suffix = "."
    }
    const n = normFigure(core)
    if (allowed.has(n) || allowed.has(normFigure(fig))) return fig
    if (isTechnicalConstant(full, fig, offset)) return fig
    removed++
    const before = full.slice(0, offset)
    const after = full.slice(offset + fig.length)
    const hasArticle = /\b(a|an|the)\s+$/i.test(before)
    let plain: string
    if (/%$/.test(core)) {
      // A percentage replacement must fit its sentence: "route 10% of
      // traffic" becomes "route a share of traffic", not "route noticeably
      // of traffic"; "increase to 10%" becomes "increase to a higher
      // share", not "increase to noticeably".
      if (/^\s+of\b/.test(after)) plain = "a share"
      else if (/\bto\s+(a|an|the\s+)?$/.test(before)) plain = "a higher share"
      else plain = plainFor(core, hasArticle)
    } else plain = plainFor(core, hasArticle)
    if (hasArticle) plain = plain.replace(/^(a|an|the)\s+/i, "")
    return plain + suffix
  })
  text = text.replace(/\bin a few years ago/gi, "back then")
  return { text, removed }
}

// ------------------------------------------------------------ placeholders ---
// Last line of defence: an old dossier answer can still carry "[the X you
// used]" — never show one. Only fill-in PLACEHOLDERS are folded away; real
// bracket content ("[Event ID 4625]", "logs[idx]") is left exactly as written.
// An employer/title placeholder is filled with the real one, never dropped.
export function unbracket(s: string, facts?: SpeakFacts | null): string {
  const isPlaceholder = (x: string) =>
    /\b(you|your)\b/i.test(x) ||
    /^(the|a|an|some|specific|insert)\s/i.test(x) ||
    /^\s*(blank|tbd|tba|n\/?a|x|n|metric|number|percent(age)?|date|year|company|employer|tool|name|value|amount|timeframe|duration)\s*$/i.test(x) ||
    /^[a-z]+(?:\s+[a-z]+){1,8}$/.test(x.trim())
  let hit = false
  const out = String(s || "").replace(/\[([^\]\n]{1,90})\]/g, (m, inner: string) => {
    if (!isPlaceholder(inner)) return m
    hit = true
    if (facts?.employer && /\b(client|company|employer|organi[sz]ation|firm|bank|current (job|role|workplace))\b/i.test(inner) && !/\b(role|title|position)\b/i.test(inner))
      return facts.employer
    if (facts?.title && /\b(title|role|position|designation)\b/i.test(inner)) return facts.title
    if (!/\b(you|your)\b/i.test(inner)) return ""
    const t = inner.replace(/\s+(that |which |who )?(you|your)\b.*$/i, "").replace(/^(your|the)\s+/i, "the ").trim()
    return t.split(/\s+/).length >= 2 && !/^(how|what|when|why|where)\b/i.test(t) ? t : ""
  })
  if (!hit) return out
  return out
    .replace(/\bby\s*%/g, "significantly")
    .replace(/(^|\s)%/g, "$1")
    .replace(/[,;]\s*([.!?;:])/g, "$1")
    .replace(/ +([,.;:!?])(?=\s|$)/g, "$1")
    .replace(/ {2,}/g, " ")
}

// --------------------------------------------------------------- orphans ---
// Never leave markup or a dangling word behind: "at ****", "** **", "at ,".
export function cleanOrphans(line: string): string {
  return String(line)
    .replace(/\bseveral\s+(?=Hypothesis \d+:)/gi, "")
    .replace(/\*{4,}/g, "")
    .replace(/\*\*\s+\*\*/g, " ")
    .replace(/(^|[^*])\*\s*\*(?!\*)/g, "$1")
    .replace(/\b(at|with|for|from|in|by|of)\s+(?=[,.;:!?])/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/ {2,}/g, " ")
}

// ------------------------------------------------------------------ title ---
// "I'm a Senior CyberArk Engineer" when the resume says Senior Security
// Engineer: his present title is the resume's, exactly.
export function fixTitle(line: string, facts?: SpeakFacts | null): string {
  if (!facts?.title) return line
  return String(line).replace(
    /\b(I['’]m|I am|I work as|I'm working as|I am working as|my (?:current )?title is|currently (?:a|an))\s+(an?\s+)?((?:\*\*)?(?:(?:Senior|Sr\.?|Lead|Principal|Staff|Chief)\s+)?(?:[A-Z][\w&/-]*\s+){0,3}(?:Engineer|Analyst|Architect|Consultant|Specialist|Administrator|Manager|Developer)(?:\*\*)?)(?=[\s,.;]|$)/g,
    (m, lead: string, _art: string, said: string) =>
      said.replace(/\*/g, "").toLowerCase() === facts.title.toLowerCase()
        ? m
        : `${lead} ${/^[aeiou]/i.test(facts.title) ? "an" : "a"} ${facts.title}`,
  )
}

// ---------------------------------------------------------------- versions ---
// Owner, 2026-09-30: "never say fillers like 12.x — use a real one like
// 12.6". A wildcard version becomes a real release of that line (CyberArk PAM
// self-hosted, the product these interviews ask about); for any other product
// the ".x" is dropped rather than a release invented.
const CYBERARK_RELEASE: Record<string, string> = { 9: "9.10", 10: "10.10", 11: "11.7", 12: "12.6", 13: "13.2", 14: "14.2" }
export function fixVersions(line: string, facts?: SpeakFacts | null): string {
  const ark = /cyberark|\bpam\b|\bpas\b|vault|pvwa|\bcpm\b|\bpsm/i.test(line) || (facts && /cyberark/.test(facts.known || ""))
  return String(line)
    .replace(/\bthe\s+v?(\d{1,2})\.x\s+(?:line|release|series|branch|stream)\b/gi, (_m, maj: string) =>
      ark && CYBERARK_RELEASE[maj] ? CYBERARK_RELEASE[maj] : `version ${maj}`)
    .replace(/\bv?(\d{1,2})\.x\b/gi, (_m, maj: string) =>
      ark && CYBERARK_RELEASE[maj] ? CYBERARK_RELEASE[maj] : `version ${maj}`)
}

// ---------------------------------------------------------------- prestige ---
export function dropUnsourcedPrestige(line: string, facts?: SpeakFacts | null): string {
  if (!facts) return line
  return String(line).replace(/\b(an?\s+)?Fortune[\s-]?(\d{2,4})\s+/gi, (m, art: string, n: string) =>
    facts.known.includes(`fortune ${n}`) || facts.known.includes(`fortune-${n}`)
      ? m
      : art ? art.replace(/an/i, "a") + "large " : "large ",
  )
}

// ------------------------------------------------------------------- place ---
// "based in New York" when neither the resume, the JD nor the call says New
// York: dropped (a 646 area code is not a location).
export function dropUnsourcedPlace(line: string, facts?: SpeakFacts | null): string {
  if (!facts) return line
  return String(line).replace(
    /,?\s*(?:and\s+)?(?:I['’]m\s+|I am\s+)?(?:currently\s+)?based (?:in|out of) ((?:[A-Z][\w.'-]*\s?){1,4})/g,
    (m, place: string) => {
      const pl = place.trim().replace(/[.,]$/, "").toLowerCase()
      return pl && facts.known.includes(pl) ? m : ""
    },
  )
}

// ------------------------------------------------------------ word budget ---
// An answer must never stop mid-thought. Past 1.4x the plan, it ends on the
// last whole sentence inside it. Code is never cut.
export function withinWords(text: string, max: number): string {
  const t = String(text || "")
  const count = (s: string) => s.split(/\s+/).filter(Boolean).length
  if (!max || /```/.test(t) || count(t) <= max) return t
  const end = /[.!?…]["”')\]*_]*(?=\s|$)/g
  let m: RegExpExecArray | null
  let cut = 0
  while ((m = end.exec(t))) {
    const at = m.index + m[0].length
    if (count(t.slice(0, at)) > max) break
    cut = at
  }
  if (!cut) {
    end.lastIndex = 0
    m = end.exec(t)
    cut = m ? m.index + m[0].length : t.length
  }
  return t.slice(0, cut).trimEnd()
}

export function finishCleanly(text: string): string {
  if ((String(text).match(/^\s*```/gm) || []).length % 2 === 1)
    return String(text).replace(/\s+$/, "") + "\n```" // cut off inside code: close the block
  if (/```\s*$/.test(String(text))) return String(text).replace(/\s+$/, "") // ends on a code block: finished
  const lines = String(text || "").replace(/\s+$/, "").split("\n")
  for (let n = 0; n < 3 && lines.length; n++) {
    const last = lines[lines.length - 1]
    const t = last.trim()
    if (!t || /^(#{1,3}\s|\((pause|beat)\)$)/i.test(t)) { lines.pop(); continue } // a dangling heading or pause mark
    if (/[.!?…"”')\]]$/.test(t.replace(/\*+$/, ""))) break // ends a sentence: finished
    const cut = Math.max(last.lastIndexOf(". "), last.lastIndexOf("! "), last.lastIndexOf("? "))
    if (cut > 0) { lines[lines.length - 1] = last.slice(0, cut + 1); break }
    lines.pop() // a fragment with no complete sentence
  }
  return lines.join("\n")
}

// ------------------------------------------------------- resume role parse ---
// One parser for every common resume layout (perfACT self-play over 15
// resumes, 2026-09-30): "Cigna Healthcare — IAM Team Lead | Texas | Sep 2023 –
// Present", "Fifth Bank" / "Senior Security Engineer | Nov 2023 – Present",
// "Security Analyst, Acme | 2019 - 2021". Section headers, locations and
// education lines are skipped.
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s+"
const ROLE_DATES = new RegExp(
  `\\b(?:${MONTH})?(?:19|20)\\d{2}\\s*(?:[–—-]|to)\\s*(?:(?:${MONTH})?(?:19|20)\\d{2}|present|current|now|till date|date)\\b`, "i")
const TITLE_WORDS = /\b(engineer|analyst|developer|manager|architect|lead|consultant|specialist|administrator|admin|intern|director|officer|associate|scientist|designer|tester|responsibilities|experience|summary|education)\b/i
const HEADER_LINE = /^[A-Z0-9 &/,.()'-]{4,}$/
const EDU_LINE = /\b(university|college|institute|school|academy|b\.?\s?tech|b\.?\s?e\.?\b|m\.?\s?s\.?\b|m\.?\s?tech|bachelor|master'?s?|ph\.?\s?d|degree|diploma)\b/i
const LOCATION_SEG = /^(remote|hybrid|on-?site|onsite|[A-Z][A-Za-z.]+(?:\s[A-Z][A-Za-z.]+)?(?:,\s*[A-Z][A-Za-z.]{1,})?)$/

interface ParsedRole { at: number; headAt: number; org: string; title: string; dates: string; current: boolean }

function parseRoles(lines: string[]): ParsedRole[] {
  const out: ParsedRole[] = []
  lines.forEach((l, i) => {
    if (l.length > 160 || !ROLE_DATES.test(l)) return
    const bare = l.replace(/^[•▪●\-*\uFFFD]\s*/, "")
    if (EDU_LINE.test(bare)) return
    let p = i - 1
    while (p >= 0 && !lines[p]) p--
    const prev = p >= 0 ? lines[p] : ""
    const dates = (bare.match(ROLE_DATES) || [""])[0]
    let segs = bare.replace(ROLE_DATES, "").split(/\s*[|•·]\s*/).map((x) => x.replace(/^[\s,–—-]+|[\s,–—-]+$/g, "").trim()).filter(Boolean)
    segs = segs.filter((x, k) => !(k > 0 && LOCATION_SEG.test(x) && !TITLE_WORDS.test(x)))
    const first = segs[0] || ""
    const dash = first.split(/\s+[—–]\s+|\s+-\s+/)
    let org = ""
    let title = ""
    let oneLine = true
    if (dash.length >= 2) {
      const a = dash[0]
      const b = dash.slice(1).join(" — ")
      if (TITLE_WORDS.test(a) && !TITLE_WORDS.test(b)) { title = a; org = b } else { org = a; title = b }
    } else if (segs.length >= 2) {
      if (TITLE_WORDS.test(segs[0]) && !TITLE_WORDS.test(segs[1])) { title = segs[0]; org = segs[1] } else { org = segs[0]; title = segs[1] }
    } else {
      oneLine = false
      title = first
      org = HEADER_LINE.test(prev) || ROLE_DATES.test(prev) ? "" : prev
      if (org && TITLE_WORDS.test(org) && !TITLE_WORDS.test(title)) [org, title] = [title, org]
    }
    org = org.replace(/^[•▪●\-*\uFFFD]\s*/, "").split(/\s*,\s*/)[0].trim()
    out.push({ at: i, headAt: oneLine || !org ? i : p, org, title: title.trim(), dates, current: /present|current|now|till date/i.test(dates) })
  })
  return out
}

export interface ResumeRoles { employers: string[]; current: string; currentRole: ParsedRole | null; list: ParsedRole[] }

export function resumeRoles(resume: string | undefined): ResumeRoles {
  const lines = String(resume || "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim())
  const list = parseRoles(lines)
  const employers = [...new Set(list.map((r) => r.org).filter(Boolean))]
  const cur = list.find((r) => r.current) || null
  const current = cur ? `${cur.org || ""} — ${cur.title} | ${cur.dates}`.replace(/^ — /, "") : ""
  return { employers, current, currentRole: cur, list }
}

// "Fifth Third" = the resume's "Fifth Third Bank": how the call says an employer.
function employerAliases(employers: string[], text: string): Array<{ said: string; resume: string }> {
  const out: Array<{ said: string; resume: string }> = []
  const seen = new Set<string>()
  for (const e of employers) {
    if (TITLE_WORDS.test(e)) continue
    const toks = e.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").split(/\s+/).filter(Boolean)
    if (toks.length < 2 || toks.length > 5) continue
    const m = String(text || "").match(new RegExp("\\b" + toks.join("(?:\\s+[a-z0-9&]+){0,2}?\\s+") + "\\b", "i"))
    if (!m) continue
    const said = m[0].replace(/\s+/g, " ").trim()
    if (said.toLowerCase() === toks.join(" ") || seen.has(said.toLowerCase())) continue
    seen.add(said.toLowerCase())
    out.push({ said: said.replace(/\b[a-z]/g, (c) => c.toUpperCase()), resume: e })
  }
  return out
}

// The facts a placeholder may be filled with, and the places he may be "based in".
export function speakFacts(opts: {
  resume?: string; jd?: string; documents?: string; heard?: string;
  identity?: string; projects?: string;
}): SpeakFacts {
  const heardAll = `${opts.heard || ""}`
  const roles = resumeRoles(opts.resume)
  const alias = employerAliases(roles.employers, heardAll)[0]
  const cr: ParsedRole | null = roles.currentRole
  const employer = alias ? alias.said : (cr?.org || "")
  const title = cr?.title || ""
  const known = `${opts.resume || ""}\n${opts.jd || ""}\n${opts.documents || ""}\n${opts.identity || ""}\n${opts.projects || ""}\n${heardAll}`.toLowerCase()
  return { employer, title, known }
}

// ------------------------------------------------------------ full pipeline ---
// perfACT's streaming settle() chain, run per line on the finished text:
// unbracket → place → versions → prestige → title → orphans → figures.
export function applyGuards(
  text: string, facts: SpeakFacts | null, allowed: Set<string>,
): { text: string; guarded: number } {
  let guarded = 0
  const lines = String(text || "").split("\n")
  const out = lines.map((rawLine) => {
    let line = rawLine
    const fence = /^\s*```/.test(line)
    if (fence) return line // code is shown exactly as written
    if (/^\s*(?:def |class |import |from |return\b|if |elif |else:|for |while |print\()/.test(line) || /\b(?:<=|>=|==|%)\b/.test(line)) return line
    if (line.includes("[")) line = unbracket(line, facts)
    line = cleanOrphans(fixTitle(dropUnsourcedPrestige(fixVersions(dropUnsourcedPlace(line, facts), facts), facts), facts))
    if (!line.trim() || !needsGuard(line, allowed)) return line
    guarded++
    return guardText(line, allowed).text
  })
  return { text: out.join("\n"), guarded }
}

// ------------------------------------------------- post-generation fact check ---
// Runs AFTER the answer is finished, so it never delays the first words. The
// model only POINTS at unsupported phrases; code does the replacement, so the
// fix is guaranteed. Checks only facts that must match the candidate's own
// material (employers, titles, dates, years, numbers, certs) and rewrites an
// unsupported one into natural wording — NEVER a blank. Tools, platforms and
// processes are the filled-in specifics the owner wants, so they are left alone.
const VERIFY_SYSTEM = `You check a job candidate's interview answer against their own FACTS (resume, job description, documents).
Flag ONLY these claims when FACTS does not support them: an employer or client name, a job title or seniority, a date or year, a years-of-experience figure, a number or metric (%, counts, time saved, money), a certification or degree. Do NOT flag tools, products, platforms, vendors, systems, processes, techniques or general technical knowledge.
For each unsupported claim give the EXACT substring from the line ("span") and a natural replacement phrase that fits the sentence grammatically and claims nothing unsupported ("plain"), e.g. {"span":"at JPMorgan","plain":"at a large bank"}, {"span":"by 40%","plain":"noticeably"}, {"span":"in 2019","plain":"a few years ago"}. Never use brackets or placeholders.
Return JSON only: {"lines":[{"i":1,"invented":[{"span":"...","plain":"..."}]}]} — list only lines with unsupported claims; {"lines":[]} if none.`

export interface VerifyResult { text: string | null; fixed: number }

export async function verifyAnswer(
  generate: (system: string, user: string) => Promise<string>,
  factsText: string,
  answerText: string,
): Promise<VerifyResult | null> {
  const all = String(answerText || "").split("\n").map((l) => l.trim()).filter(Boolean)
  const bare = (l: string) => l.replace(/^\s*[-•*]\s*/, "")
  const isHead = (l: string) => /^(QUESTION:|#{1,3}\s)/i.test(bare(l))
  const lines = all.filter((l) => !isHead(l)).map(bare)
  if (!lines.length || !factsText.trim()) return null
  const user = `FACTS:\n${factsText.slice(0, 9000)}\n\nLINES:\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}`
  let content = ""
  try {
    content = await generate(VERIFY_SYSTEM, user)
  } catch { return null }
  if (!content) return null
  let j: { lines?: Array<{ i?: number; invented?: Array<{ span?: string; plain?: string }> }> }
  try { j = JSON.parse(content) } catch { return null }
  if (!Array.isArray(j.lines)) return null
  let fixed = 0
  const out = lines.map((line, i) => {
    const v = j.lines!.find((x) => Number(x.i) === i + 1)
    if (!v || !Array.isArray(v.invented)) return line
    let l = line
    for (const c of v.invented!) {
      const span = String((c && c.span) || "").trim()
      const plain = String((c && (c.plain ?? "")) || "").replace(/[[\]]/g, "").trim().slice(0, 60)
      if (span.length < 3) continue
      const at = l.toLowerCase().indexOf(span.toLowerCase())
      if (at < 0) continue
      const before = l.slice(0, at)
      const words = /\b(the|a|an)\s+$/i.test(before) ? plain.replace(/^(the|a|an)\s+/i, "") : plain
      l = (before + words + l.slice(at + span.length)).replace(/\s+([,.;:])/g, "$1").replace(/ {2,}/g, " ").trim()
      fixed++
    }
    return l
  })
  if (!fixed) return { text: null, fixed }
  let k = 0 // put back the headings (QUESTION: / ##) the check skipped
  return { text: all.map((l) => (isHead(l) ? bare(l) : "- " + out[k++])).join("\n"), fixed }
}
