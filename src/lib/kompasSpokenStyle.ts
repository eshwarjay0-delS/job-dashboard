// Fix 5 (defensibility cycle): spoken style. Paraphrase disagreements instead of theatrical dialogue (at most one short
// quote), no slogan closers ("time-boxed and visible", "the compromise held"), the tool never opens as the subject, and
// the answer carries reasoning: observed, meaning, alternatives, why, trade-off, owner, unresolved.
import { DECIDE, SIGNER, sentences, toolsIn, words } from "./kompasDefendText.ts"

export type StyleFinding = { code: string; severity: "hard" | "major"; quote: string; why: string }
export const SLOGANS = /\b(?:time-?boxed and visible|visible and time-?boxed|the compromise held|that compromise held|compromise held|accepting short-term risk|short-term friction|the tension was (?:speed|between)|speed versus process|I don't bury (?:them|people) in (?:logs|data)|I quantified the exposure|we couldn't ignore (?:active|the)|the fix accepted|that's the balance|that balance held|the trade-?off held|risk stayed visible|kept the risk visible|that's how I (?:operate|work|think)|security and the business (?:both )?(?:won|got what)|everyone (?:left|walked away) (?:aligned|happy)|that's what (?:good|real) security (?:looks|is)|progress over perfection|risk is a business decision)\b/i

export function styleFindings(answer: string): StyleFinding[] {
  const t = String(answer || ""), S = sentences(t), f: StyleFinding[] = []
  const add = (code: string, severity: StyleFinding["severity"], quote: string, why: string) => f.push({ code, severity, quote: String(quote || "").slice(0, 180), why })
  const quotes = (t.match(/["\u201c][^"\u201d]{6,}["\u201d]/g) || []).filter((x) => words(x) >= 3)
  if (quotes.length > 1) add("theatrical-quotes", "major", quotes.slice(0, 2).join(" "), "paraphrase the disagreement; at most one short quote")
  else if (quotes.length === 1 && words(quotes[0]) > 16) add("long-quote", "major", quotes[0], "a quote longer than a real person remembers; paraphrase it")
  const sl = S.find((s) => SLOGANS.test(s))
  if (sl) add("slogan", "hard", sl, "slogan closer or anchor label spoken aloud; say the consequence instead")
  const tools = toolsIn(t)
  const subj = (s: string) => tools.some((tl) => {
    const n = tl.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`^(?:(?:An?|The) (?:\\w+ ){0,3}(?:in|from) )?(?:the )?${n}\\b[^.]{0,25}?\\b(?:flagged|showed|detected|raised|caught|surfaced|alerted|found|fired|lit up|reported|triggered|popped)`, "i").test(s)
      || new RegExp(`^(?:An?|The) (?:incident|alert|finding|ticket) (?:triggered|fired|opened|popped) in ${n}`, "i").test(s)
      || new RegExp(`\\bwhen (?:the )?${n}\\b[^.]{0,20}\\b(?:flagged|showed|detected|raised|caught|alerted|found|fired)`, "i").test(s.split(/[,.]/)[0])
  })
  if (S[0] && subj(S[0])) add("tool-protagonist", "major", S[0], "the tool opens as the subject; start with the decision or the conflict")
  else if (S.filter(subj).length >= 2) add("tool-protagonist", "major", S.filter(subj)[0], "the tool keeps being the subject; make it support his decision")
  return f
}

const REASON: Record<string, RegExp> = {
  observed: /\b(?:I (?:saw|noticed|found|spotted|could see)|(?:showed|flagged|came back|had (?:a|an|no))\b|the (?:logs?|scan|alert|data|review|export|record) (?:showed|had)|was (?:still|running|exposed|open|unpatched|active))/i,
  meaning: /\b(?:which meant|that meant|meant (?:that|we|the|it)|so (?:the|it|we|this|that) (?:was|wasn't|could|had|needed)|told (?:me|us) (?:that|it)|pointed (?:to|at)|indicat\w*|suggest\w*|it looked like|my read was|the read was|in other words|that's (?:a sign|why))\b/i,
  alternatives: /\b(?:instead of|rather than|the other option|alternative\w*|(?:we|I) could have|considered|the option (?:was|of)|either \w+ or|versus|vs\.?|or wait|or (?:we|I) (?:could|wait|accept|push))\b/i,
  why: /\b(?:because|since|so that|the reason|that's why|given that)\b/i,
  tradeoff: /\b(?:trade-?off|at the cost of|cost (?:us|them|a)|meant (?:waiting|losing|giving up|delaying|slower)|the price was|in exchange|we gave up|gave up|accept(?:ed|ing)? (?:the|some|a|that) (?:risk|delay|downtime|gap|exposure)|downside|slower|more friction)\b/i,
  owner: new RegExp(`(?:${SIGNER.source})[^.]{0,60}(?:${DECIDE.source})|(?:${DECIDE.source})[^.]{0,40}(?:${SIGNER.source})|\\bmy (?:call|decision)\\b|\\bI (?:decided|made the call|chose)\\b`, "i"),
  unresolved: /\b(?:still (?:open|unresolved|wasn't|weren't|hadn't|didn't|isn't|needed|pending|there)|never (?:fully|got|really)|open (?:item|question|finding|ticket|risk)|left open|unresolved|at handover|handed (?:it )?over|remain(?:ed|s)? (?:open|unpatched|exposed|a gap|unresolved)|until (?:the )?next|wasn't (?:fixed|resolved)|didn't (?:fix|solve|resolve)|not (?:yet )?(?:fixed|resolved|closed)|follow-up|residual)\b/i,
}
export function reasoning(answer: string): { hit: Record<string, boolean>; n: number; score: number; missing: string[] } {
  const t = String(answer || "")
  const hit = Object.fromEntries(Object.entries(REASON).map(([k, re]) => [k, re.test(t)]))
  const n = Object.values(hit).filter(Boolean).length
  return { hit, n, score: Math.round((100 * n) / 7), missing: Object.keys(hit).filter((k) => !hit[k]) }
}
export const needsReasoning = (question: string): boolean => /\b(?:tell me about|describe a|walk me through|time when|what (?:do|would|did) you do|how (?:do|would|did) you (?:handle|decide|respond|deal)|disagree|push|conflict|risk|exception|decide|wrong|mistake)\b/i.test(question) && !/^(?:what is|what are|define|explain the difference)\b/i.test(question.trim())

export const SPOKEN_STYLE_PROMPT = `SPOKEN STYLE: paraphrase disagreements the way a senior engineer remembers them ("I explained that skipping the ticket meant we couldn't roll back cleanly"); at most one short quote, usually none. The tool is never the subject of the opening sentence; open with the decision, the conflict or your responsibility. Give the reasoning, not just actions: what you observed, what it meant, the alternative you didn't take and why, the trade-off, who owned the decision, what stayed unresolved. End on a concrete consequence, never a slogan ("time-boxed and visible", "the compromise held", "accepting short-term risk").`
