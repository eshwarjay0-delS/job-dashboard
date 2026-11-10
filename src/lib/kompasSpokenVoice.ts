// Spoken delivery. No model call.
// Starters are the ones that actually open sentences in Eshwar's 20 dossiers and the
// recovered M4A deep-dives (So, Then, That, What I, Where), plus the five carry-overs
// Lens named. The pass does not add an employer or a tool.

import { interviewSignOff, SIGN_OFF_LINE } from "./kompasSheetMatch.ts"
import { STYLE_OPENERS, STYLE_TRANSITIONS } from "./kompasStyleLibrary.ts"

export const CARRY_STARTERS = [...new Set([...STYLE_OPENERS, ...STYLE_TRANSITIONS, "So", "Then", "So the first thing I'd", "That way", "On top of that", "What I'd check next is", "And the reason I trust it is", "At the end of the day"])]

export const VOICE_RULES = `SPOKEN VOICE: Sound like one employee explaining the issue to a coworker. Plain words, one picture then the term, not a memo. Sentence one answers the exact question with no warm-up. Then a concrete example, three or four points, action and result weighted, and the last sentence is the result. Each later sentence hooks to the previous one with a carry-over starter, and the same starter is not used twice: ${CARRY_STARTERS.join("; ")}. Keep most sentences between eight and twenty words, with contractions. One shop-talk move (where it breaks, or what the check proves) and only when the resume supports it; otherwise say it as what you would usually do. End on what the check proves, not a slogan. Never write In conclusion, Furthermore, Moreover, Additionally, It is important to note, leverage, utilize, or robust. No bullets and no headings.`

const BANNED = /\b(?:in conclusion|furthermore|moreover|additionally|it is important to note|leverag\w*|utiliz\w*|robust)\b[,:]?\s*/gi
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/
const HEADING = /^\s*#{1,4}\s+/

const SWAP: Array<[RegExp, string]> = [
  [/\bdo not\b/gi, "don't"],
  [/\bcan not\b/gi, "can't"],
  [/\bcannot\b/gi, "can't"],
  [/\bI would\b/g, "I'd"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
  [/\bwe are\b/gi, "we're"],
  [/\bI am\b/g, "I'm"],
  [/\byou are\b/gi, "you're"],
]

const UNSOURCED: Array<[RegExp, string]> = [
  [/\bmicrosoft entra id\b/gi, "our identity platform"],
  [/\bentra id\b/gi, "our identity platform"],
  [/\bmicrosoft entra\b/gi, "our identity platform"],
]

function hasSource(sources: string, name: string): boolean {
  return sources.toLowerCase().includes(name.toLowerCase())
}

function sentencesOf(text: string): string[] {
  return String(text || "")
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((line) => {
      const clean = line.replace(HEADING, "").replace(BULLET, "").trim()
      if (!clean) return []
      return clean.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
    })
}

function startsWithStarter(sentence: string): string {
  const lower = sentence.toLowerCase()
  const found = CARRY_STARTERS.filter((s) => lower.startsWith(s.toLowerCase()))
  found.sort((a, b) => b.length - a.length)
  return found[0] || ""
}

function shorten(sentence: string): string[] {
  const words = sentence.split(/\s+/)
  if (words.length <= 24) return [sentence]
  const cut = sentence.search(/, | and /i)
  if (cut < 12) return [sentence]
  const left = sentence.slice(0, cut).trim().replace(/,$/, "")
  const right = sentence.slice(cut).replace(/^(?:,\s*| and )/i, "").trim()
  if (left.split(/\s+/).length < 6 || right.split(/\s+/).length < 6) return [sentence]
  const end = /[.?!]$/.test(left) ? left : left + "."
  return [end, right]
}

function dropStock(text: string, question: string, sources: string): string {
  let s = String(text || "")
  s = s.replace(/\bI would want to confirm that\b[^.?!]*[.?!]?/gi, "")
  s = s.replace(/\b(?:The takeaway is|The key takeaway is|The key point is|The key is)\b[:,]?\s*/gi, "")
  if (!/\bmfa\b|multi-factor|multifactor/i.test(question)) {
    s = s.replace(/[^.?!]*\bMFA alone\b[^.?!]*[.?!]?/gi, "")
    s = s.replace(/[^.?!]*\bmulti-factor authentication alone\b[^.?!]*[.?!]?/gi, "")
    s = s.replace(/[^.?!]*\bjust (?:requiring |enforcing )?MFA\b[^.?!]*[.?!]?/gi, "")
  }
  const has = (name: string) => sources.toLowerCase().includes(name.toLowerCase())
  if (!/\bjust-in-time\b|\bjit\b/i.test(sources)) s = s.replace(/\bjust-in-time elevation\b/gi, "the access the resume describes")
  if (!/\bci\/?cd\b/i.test(sources)) s = s.replace(/\bintegrated[^.?!]*\bCI\/CD\b[^.?!]*/gi, "kept the work in the tools the resume names")
  s = s.replace(/\bEvent IDs?\s*(\d+)\b/gi, (m, n) => (sources.includes(n) ? m : "the log event"))
  s = s.replace(/\b(\d+)\s*(?:hours?|days?|minutes?)\b/gi, (m, n) => (sources.includes(n) ? m : "the window the resume shows"))
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*%/g, (m, n) => (sources.includes(n) ? m : "the change"))
  s = s.replace(/\b(?:a quarter|three-quarters|one half)\b/gi, (m) => (sources.toLowerCase().includes(m.toLowerCase()) ? m : "part"))
  return s
}

function scrub(sentence: string, sources: string): string {
  let s = sentence.replace(BANNED, "").replace(/\s+/g, " ").trim()
  for (const [re, to] of SWAP) s = s.replace(re, to)
  for (const [re, to] of UNSOURCED) {
    if (!hasSource(sources, "entra")) s = s.replace(re, to)
  }
  if (!hasSource(sources, "citi")) s = s.replace(/\b(?:at|@)\s+citi\b[,:]?\s*/gi, "").replace(/^Citi,? /i, "")
  for (const name of ["CrowdStrike", "Snyk", "ServiceNow", "Jira", "Splunk", "CyberArk", "SailPoint", "Qualys", "Burp", "Fortify"]) {
    if (!hasSource(sources, name)) s = s.replace(new RegExp(`\\b${name}\\b,?\\s*`, "gi"), "")
  }
  return s.replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").trim()
}

/** First sentence stays the answer. Later sentences pick up a starter that has not been used. */
export function spokenVoice(text: string, question: string, sources = ""): string {
  if (interviewSignOff(question)) return SIGN_OFF_LINE
  const raw = sentencesOf(dropStock(text, question, sources)).map((s) => scrub(s, sources)).filter((s) => s.split(/\s+/).length >= 3)
  if (!raw.length) return String(text || "").trim()
  const used = new Set<string>()
  const out: string[] = []
  let pool = 0
  for (let i = 0; i < raw.length; i++) {
    for (const part of shorten(raw[i])) {
      let sentence = part
      const existing = startsWithStarter(sentence)
      if (i === 0 && out.length === 0) {
        if (existing) sentence = sentence.slice(existing.length).replace(/^[,:\s]+/, "")
        if (!sentence) continue
        if (!/[.?!]$/.test(sentence)) sentence += "."
        out.push(sentence.charAt(0).toUpperCase() + sentence.slice(1))
        continue
      }
      if (existing) {
        if (used.has(existing.toLowerCase())) {
          sentence = sentence.slice(existing.length).replace(/^[,:\s]+/, "")
        } else {
          used.add(existing.toLowerCase())
          out.push(sentence.charAt(0).toUpperCase() + sentence.slice(1))
          continue
        }
      }
      let starter = ""
      for (let n = 0; n < CARRY_STARTERS.length; n++) {
        const candidate = CARRY_STARTERS[(pool + n) % CARRY_STARTERS.length]
        if (!used.has(candidate.toLowerCase())) { starter = candidate; pool += n + 1; break }
      }
      if (!starter) starter = "So"
      used.add(starter.toLowerCase())
      const body = sentence.charAt(0).toLowerCase() + sentence.slice(1)
      const joined = /[.?!]$/.test(body) ? `${starter}, ${body}` : `${starter}, ${body}.`
      out.push(joined)
    }
  }
  return out.join(" ").replace(/\s+/g, " ").trim()
}
