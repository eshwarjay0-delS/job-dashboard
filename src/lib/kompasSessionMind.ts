// Inner mind for the context panel. Local, deterministic, no network.
// Claims already spoken in this session win over a new line that would contradict them.
// Reasons stay off the spoken line. Nothing here is written to disk.

export type SessionClaim = {
  span: string
  place: string
  onSite: boolean
  negative: boolean
}

export type ScreenedLine = {
  line: string
  blocked: boolean
  rewritten: boolean
  why: string
}

export type StatementCue = {
  long: boolean
  words: number
  seconds: number
  summary: string
  sayNow: string
  mode: "questions" | "boosters"
}

const WORD = /[A-Za-z][A-Za-z'-]*/g
const PRIVATE = /@|\b(?:\+?1[\s.-]*)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b|\b(?:visa|h-?1b|green card|salary|compensation(?!\s+controls?)|relocation|citizenship|notice period)\b/i

function words(text: string): string[] {
  return String(text || "").toLowerCase().match(WORD)?.filter((w) => w.length >= 4) || []
}

export function negativeLine(text: string): boolean {
  return /\b(?:not|never|no|can't|cannot|won't|wouldn't|haven't|hasn't|isn't|aren't|remote only|only remote)\b/i.test(text)
}

function placeOf(text: string): string {
  const m = text.match(/\b(?:available in(?: the)?|based in|live in|located in)\s+([A-Za-z][A-Za-z .'-]{2,40})/i)
  if (!m) return ""
  return m[1].replace(/\b(?:area|region|office)\b/gi, "").trim().split(/\s+/)[0].toLowerCase()
}

/** Claims from the candidate's mic lines and from answers he already chose. */
export function extractClaims(transcript: string, said: readonly string[] = []): SessionClaim[] {
  const chunks: string[] = []
  for (const raw of String(transcript || "").split("\n")) {
    const line = raw.trim()
    if (/^You:/i.test(line)) chunks.push(line.replace(/^You:\s*/i, ""))
  }
  for (const line of said) chunks.push(String(line || ""))
  const out: SessionClaim[] = []
  const seen = new Set<string>()
  for (const chunk of chunks) {
    for (const span of chunk.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)) {
      const place = placeOf(span)
      const onSite = /\bon[\s-]?site\b/i.test(span)
      const aboutAvailability = place || onSite || /\bavailable\b/i.test(span)
      if (!aboutAvailability && words(span).length < 4) continue
      if (!aboutAvailability) continue
      const key = span.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ span, place, onSite, negative: negativeLine(span) })
    }
  }
  return out
}

function overlaps(line: string, claim: SessionClaim): boolean {
  const mine = new Set(words(line))
  let shared = 0
  for (const word of words(claim.span)) if (mine.has(word)) shared++
  if (claim.place && mine.has(claim.place)) shared += 2
  return shared >= 2
}

function conflicts(line: string, claim: SessionClaim): boolean {
  const place = placeOf(line)
  if (claim.place && place && place !== claim.place) return true
  if (claim.onSite && /\b(?:remote only|only(?:\s+\w+){0,2}\s+remote|not on[\s-]?site|can't be on[\s-]?site|cannot be on[\s-]?site)\b/i.test(line)) return true
  if (claim.place && new RegExp(`\\bnot\\b[^.]{0,40}\\b${claim.place}\\b`, "i").test(line)) return true
  if (!overlaps(line, claim)) return false
  return negativeLine(line) !== claim.negative
}

/** Block or rewrite one line so it cannot contradict an earlier claim or leak a private fact he did not say. */
export function screenSuggestion(line: string, transcript: string, said: readonly string[] = []): ScreenedLine {
  const text = String(line || "").replace(/\s+/g, " ").trim()
  const claims = extractClaims(transcript, said)
  const why = claims[0] ? `You: ${claims[0].span}` : ""
  if (!text) return { line: "", blocked: false, rewritten: false, why }
  const stated = `${transcript}\n${said.join("\n")}`.toLowerCase()
  if (PRIVATE.test(text) && !PRIVATE.test(stated)) return { line: "", blocked: true, rewritten: false, why: "private fact was not already said" }
  const hit = claims.find((claim) => conflicts(text, claim))
  if (!hit) return { line: text, blocked: false, rewritten: false, why }
  const kept = hit.span.replace(/[.?!]+$/, "")
  return {
    line: `I'll stay with what I already said: ${kept}.`,
    blocked: false,
    rewritten: true,
    why: `You: ${hit.span}`,
  }
}

export function screenLines(lines: readonly string[], transcript: string, said: readonly string[] = []): { lines: string[]; trace: Array<{ line: string; why: string }> } {
  const out: string[] = []
  const trace: Array<{ line: string; why: string }> = []
  for (const line of lines) {
    const screened = screenSuggestion(line, transcript, said)
    if (!screened.line || out.includes(screened.line)) continue
    out.push(screened.line)
    if (screened.why) trace.push({ line: screened.line, why: screened.why })
  }
  return { lines: out, trace }
}

/** A finished long turn. Local template only. Words at 2.5 per second. */
export function longStatementCue(text: string, mode: "questions" | "boosters" = "boosters"): StatementCue {
  const clean = String(text || "").replace(/\s+/g, " ").trim()
  const list = clean ? clean.split(/\s+/) : []
  const seconds = list.length / 2.5
  const long = list.length >= 28 || seconds >= 12
  const summary = long ? `${list.slice(0, 12).join(" ")}.` : ""
  const sayNow = !long
    ? ""
    : mode === "questions"
      ? "Want me to answer that in one pass, or take the last part first?"
      : "Yeah, I'd stay with that point."
  return { long, words: list.length, seconds: Math.round(seconds * 10) / 10, summary, sayNow, mode }
}

export function claimPrompt(transcript: string, said: readonly string[] = []): string {
  const claims = extractClaims(transcript, said)
  if (!claims.length) return ""
  return `ALREADY SAID, do not contradict: ${claims.map((c) => c.span.replace(/\s+/g, " ").trim()).join(" | ")}`
}
