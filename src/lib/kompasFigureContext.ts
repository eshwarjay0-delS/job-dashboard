/**
 * Guards r9 (29 Oct 2026): a figure is backed only by the same number WITH the same unit or noun in the sources.
 * Before r9 a bare "4" anywhere in the resume let an invented "4 weeks" or "4 regions" pass, because the allowlist held
 * numbers without what they counted. Now each source number also records the words around it (three before, three
 * after, inside its sentence), and a figure in an answer that counts something ("4 regions", "3-5 weeks", "a 4-week
 * rollout", "$2 million", "75 percent of tickets") is supported only when the sources hold that number near that noun
 * (and a "$" when the answer says money). A number with no noun after it ("cut it by 40%.") needs the number, as before.
 * Pure functions; failsafe: anything that throws reads as "not supported" (stricter, never looser).
 */
export const CTX = "\u0001ctx:"
const STOP = new Set(("a an the of and or to in on at by for with from over across per within into than then but so as is was were be been " +
  "it its this that these those which who our my their his her your we i you he she they me us them also more less about around roughly nearly " +
  "almost under up down out off times x how what when why where while because if since after before during until who whom whose " +
  "did do does done can could would should will may might must had has have are am not no").split(" "))
const SKIP_BEFORE_HEAD = new Set(["of", "the", "of the"])
export const stem = (w: string): string => {
  let s = String(w || "").toLowerCase().replace(/[^a-z]/g, "")
  if (s === "people" || s === "persons") return "person"
  if (s === "percent" || s === "pct") return "%"
  if (s.length > 4 && s.endsWith("ies")) s = s.slice(0, -3) + "y"
  else if (s.length > 3 && /(?:ses|xes|ches|shes)$/.test(s)) s = s.slice(0, -2)
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1)
  return s
}
const NUM = /(?<![\w.])(\$\s?)?(\d[\d,]*(?:\.\d+)?)\+?(\s*%|\s*(?:percent|per cent)\b)?/gi
export const normNum = (n: string) => String(n || "").replace(/,/g, "").replace(/\.0+$/, "")
// hyphen-joined unit: "a 4-week rollout", "a 3-person team"
const HYPHEN_UNIT = /^[-\u2010\u2011]\s?(second|minute|hour|day|week|month|quarter|year|person|people|member|engineer|analyst|region|country|site|node|server|team|office|state|cluster|account)s?\b/i

export const STRUCTURAL = /^\s+(?:window|sla|slas|deadline|retention|notification|rotation|shift|cycle|limit|timeout|ttl|period|lookback|grace|cadence|sprint|on-call|cooldown|expiry|lifetime|token)\b/i
export interface FigureMention { n: string; pct: boolean; money: boolean; head: string[]; at: number; end: number; raw: string; label: boolean; claim: string }
// A number that is part of a standard or product name is a label, not a count ("ISO 27001", "SOC 2", "NIST 800-53",
// "PCI DSS 4.0", "Windows Server 2019", "Type II"): it keeps the number-only check it had before r9.
const LABEL_BEFORE = /\b(?:ISO(?:\/IEC)?|IEC|SOC|PCI(?: DSS)?|DSS|NIST(?: SP| CSF)?|SP|CSF|RFC|FIPS|CIS|IL|FedRAMP|Server|Windows|Office|SQL|RHEL|Ubuntu|macOS|iOS|Android|Exchange|SharePoint|OWASP Top|Top|Article|Section|Level|Type|Gen|Wave|Release|Sprint|Round|Q|v|version|port|CVE|TLS|SSL|Python|Java|Node|IPv)[\s-]*$/i

function wordsAfter(text: string, from: number, max: number, clause = false): string[] {
  const tail = text.slice(from).split(clause ? /[.!?;:\n,]/ : /[.!?;:\n]/)[0]
  return tail.split(/[\s,()"]+/).filter(Boolean).slice(0, max)
}
function wordsBefore(text: string, to: number, max: number): string[] {
  const parts = text.slice(0, to).split(/[.!?;:\n]/)
  const head = parts[parts.length - 1] || ""
  return head.split(/[\s,()"$]+/).filter(Boolean).slice(-max)
}
/** The noun(s) a figure counts: up to two content words straight after it (skipping "of"/"of the"); [] when none. */
function headAfter(text: string, end: number): { stems: string[]; end: number } {
  const after = text.slice(end)
  const hy = after.match(HYPHEN_UNIT)
  // a policy window is a mechanism, not a result ("a 72-hour window", "a 30-day retention"): not a count (as before r9)
  if (hy && STRUCTURAL.test(after.slice(hy[0].length))) return { stems: [], end }
  if (hy) return { stems: [stem(hy[1])], end: end + hy[0].length }
  // a range: "3-5 weeks", "3 to 5 weeks" — the head is the noun after the second number
  const rng = after.match(/^\s?(?:[-\u2013\u2014]|to\b)\s?\$?\d[\d,]*(?:\.\d+)?\s*%?(?=\s)/)
  if (!rng && /^[-\u2010\u2011\w/]/.test(after)) return { stems: [], end }
  const from = rng ? end + rng[0].length : end
  const ws = wordsAfter(text, from, 4, true)
  const out: string[] = []
  let stop = from
  let i = 0
  if (ws[i] && ws[i].toLowerCase() === "of") { i++; if (ws[i] && ws[i].toLowerCase() === "the") i++ }
  for (; i < ws.length && out.length < 2; i++) {
    const w = ws[i]
    if (!/^[A-Za-z][A-Za-z'-]*$/.test(w)) break
    const s = stem(w)
    if (!s || STOP.has(w.toLowerCase())) break
    out.push(s)
    const k = text.indexOf(w, stop)
    if (k >= 0) stop = k + w.length
  }
  void SKIP_BEFORE_HEAD
  return { stems: out, end: out.length ? stop : end }
}

export function figureMentions(text: string): FigureMention[] {
  const t = String(text || "")
  const out: FigureMention[] = []
  for (const m of t.matchAll(NUM)) {
    const at = (m.index || 0) + (m[1] ? m[1].length : 0)
    const end = (m.index || 0) + m[0].length
    const label = LABEL_BEFORE.test(t.slice(Math.max(0, at - 24), at)) || /\b(?:NIST(?: SP)?|SP|ISO(?:\/IEC)?|IEC|PCI DSS|RFC)\s*[\d.]*[-.]$/i.test(t.slice(Math.max(0, at - 24), at)) || /^\/\s?7\b/.test(t.slice(end)) || /\d\/$/.test(t.slice(0, at))
    const h = m[3] || label ? { stems: [], end } : headAfter(t, end)
    let head = h.stems
    let pct = !!m[3]
    if (head[0] === "%") { pct = true; head = head.slice(1) }
    if (pct && !head.length) {
      const w = wordsAfter(t, end, 4)
      let i = 0
      if (w[i] && w[i].toLowerCase() === "of") { i++; if (w[i] && /^(the|our|my|all)$/i.test(w[i])) i++ ; if (w[i] && /^[a-z]+$/i.test(w[i]) && !STOP.has(w[i].toLowerCase())) head = [stem(w[i])] }
    }
    const money = !!m[1] || /\b(?:usd|dollars?|eur|euros?|gbp|pounds?)\b/i.test(t.slice(end, end + 24).split(/[.!?;]/)[0].split(/\s+/).slice(0, 3).join(" "))
    const claim = t.slice(m.index || 0, Math.max(end, h.end)).trim()
    out.push({ n: normNum(m[2]) + (pct ? "%" : ""), pct, money, head, at, end, raw: m[0].trim(), label, claim })
  }
  return out
}

/** Context keys for every number in the sources: CTX+"n|word" for words within three of it in its sentence, CTX+"n|$" for money. */
export function figureContextKeys(...sources: Array<string | undefined>): string[] {
  const out = new Set<string>()
  for (const src of sources) {
    const t = String(src || "")
    if (!t) continue
    for (const f of figureMentions(t)) {
      out.add(`${CTX}${f.n}|`)
      if (f.money) out.add(`${CTX}${f.n}|$`)
      // a count names its noun after the number ("4 analysts"); a share or money often names it before ("cut alerts by 40%")
      const near = f.pct || f.money ? wordsBefore(t, f.at - (t.slice(0, f.at).endsWith("$") ? 1 : 0), 3) : []
      // money keeps its nouns apart: "$2 million" does not back "2 million users"
      const tag = f.money ? "$" : ""
      for (const w of [...near, ...f.head]) { const s = stem(w); if (s && s.length > 1) out.add(`${CTX}${f.n}|${tag}${s}`) }
    }
  }
  return [...out]
}
/**
 * One claim per figure: when a bare-number claim ("50") and its counted form ("50 engineers") are both listed, the
 * counted form is dropped so the claim reads as before r9. A counted form whose bare number is NOT listed stays.
 */
export function dropCoveredFigureClaims(claims: string[]): string[] {
  const bare = new Set(claims.filter((c) => /^\$?\d[\d,.]*%?$/.test(c)).map((c) => c.replace(/^\$/, "").replace(/,/g, "")))
  return claims.filter((c) => {
    if (/^\$?\d[\d,.]*\s?(?:k|m|bn|million|billion|thousand)$/i.test(c)) return true // the pre-r9 money claim stays as it was
    const m = c.match(/^\$?(\d[\d,.]*%?)[\s-]+\S/)
    return !m || !bare.has(m[1].replace(/,/g, ""))
  })
}
export const isContextKey = (k: string) => String(k).startsWith(CTX)
/** The figures list without the context keys (for prompts and anything shown). */
export function figureList(allowed: Iterable<string>): string[] { return [...allowed].filter((k) => !isContextKey(k)) }
/** True when the allowlist holds any context keys (built by allowedNumbers r9). */
export function hasContext(allowed: Set<string>): boolean { for (const k of allowed) if (isContextKey(k)) return true; return false }

/**
 * Does the allowlist back this mention with the same meaning? Needs the number, plus (when the answer names what it
 * counts) that noun near the same number in the sources, plus "$" when the answer says money. Throws → false.
 */
export function mentionSupported(f: FigureMention, allowed: Set<string>): boolean {
  try {
    if (!allowed.has(`${CTX}${f.n}|`)) return false
    if (f.money && !allowed.has(`${CTX}${f.n}|$`)) return false
    if (!f.head.length) return true
    const tag = f.money ? "$" : ""
    return f.head.some((h) => allowed.has(`${CTX}${f.n}|${tag}${h}`))
  } catch { return false }
}
/** Mention at a character offset of a line (the figure starting there), or null. */
export function mentionAt(line: string, at: number): FigureMention | null {
  try { return figureMentions(line).find((f) => f.at === at) || null } catch { return null }
}
