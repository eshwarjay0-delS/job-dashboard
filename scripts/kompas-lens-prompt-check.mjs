// Lens r3 (29 Oct 2026): a stricter checker than the stand-in composer. It scans the REAL prompt text the engines send
// (kompasAudience, kompasDesktopResponse, kompasOpener, the RESPONSE CRAFT / QUESTION FIRST / INTENT constants and the
// service SYSTEM string read from source) for pairs of instructions a model cannot both obey. OFFLINE: text only, no model.
import { readFileSync } from "node:fs"
import { audienceGuidance, EVIDENCE_POLICY } from "../src/lib/kompasAudience.ts"
import { desktopResponsePolicy, desktopDelivery, desktopCraft } from "../src/lib/kompasDesktopResponse.ts"
import { openerPrompt } from "../src/lib/kompasOpener.ts"
import { RESPONSE_CRAFT_POLICY, INTENT_BOUNDARY, TECHNICAL_ANSWER_BOUNDARY, PERSONAL_EXPERIENCE_POLICY } from "../src/lib/kompasAnswer.ts"
import { QUESTION_FIRST_POLICY } from "../src/lib/kompasIntent.ts"

const svc = readFileSync(new URL("../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
export const SERVICE_SYSTEM = (svc.match(/const SYSTEM = `([\s\S]*?)`/) || [, ""])[1]

// r7: a quoted opener is one unit; its inner full stops do not end the instruction sentence.
const sentences = (t) => String(t).match(/(?:"[^"\n]*"|[^"])+?(?:[.!?](?=\s|$)|$)/g)?.map((s) => s.trim()).filter(Boolean) || []
const find = (t, re) => sentences(t).find((s) => re.test(s)) || null

/**
 * Each rule: two instructions that clash, unless the newer instruction itself says how they fit together.
 * `a` and `b` find the clashing sentences; `ok` is the reconciliation the newer sentence must carry. A rule fires only
 * when both sides are present in the same assembled prompt, so it measures the text the model actually gets.
 */
export const RULES = [
  { id: "assume-before-answer", why: "'answer first' vs 'name your assumption, then answer'",
    a: /\b(?:first sentence answers|answers? first|Sentence one is the answer|direct answer first|Answer that request first)/i,
    b: /\bname (?:your|the) assumption\b[^.]*\bthen answer\b/i, ok: /\b(?:inside|within|in) (?:the|that) (?:first|opening) sentence|\bAssuming\b/ },
  { id: "body-metric-vs-numbers", why: "'fuller body with the metric' vs 'a number only if the sources have it'",
    a: /\b(?:a number only if|metric is named only when|metrics only when supplied|only supplied facts and metrics)/i,
    b: /\bbody with the metric\b/i, ok: /\b(?:only (?:if|when) (?:a|the) source|sources? hold|supplied)\b/i },
  { id: "fuller-body-vs-stop", why: "'then a fuller body' vs 'then stop' on a surface or narrow question",
    a: /\bThen stop\b|\bstop after the first sentence\b|\bcan stop after\b/i,
    b: /\bfuller body\b/i, ok: /\b(?:narrow|surface|definition)\b[^.]*\bstop/i },
  { id: "close-rung-vs-takeaway", why: "'close with the next rung' vs 'the last sentence is the takeaway / returns to the subject'",
    a: /\bThe last sentence (?:is the plain takeaway|returns to the question)/i,
    b: /\b(?:Close with one short line offering the next rung|Then offer the next rung)\b/i, ok: /\b(?:inside|within|clause (?:of|in)|before) the (?:last|takeaway)/i },
  { id: "simple-picture-before-answer", why: "DEPTH simple puts the picture first vs 'sentence one answers' / Define before Picture",
    a: /\b(?:Sentence one is the answer|first sentence answers|Define the term in one plain line)/i,
    b: /^DEPTH simple\b|\bDEPTH simple:/i, ok: /\bafter (?:the|a) (?:plain|one-line) answer\b|\bplain answer first\b/i },
  { id: "simple-vs-technical-name", why: "DEPTH simple 'no jargon' vs 'keep the technical name' / required JD terms",
    a: /\bKeep the technical name\b|\bfoundational keywords\b/i,
    b: /\bNo jargon\b/i, ok: /\bterm (?:the question|they) used\b|\bexcept the (?:real )?term\b/i },
  { id: "hr-acronyms-vs-jd-keywords", why: "LENS HR 'avoid acronyms' vs technical HR knows the JD keywords",
    a: /\bfoundational keywords in the job description\b/i,
    b: /\bavoid acronyms\b/i, ok: /\bacronyms? the job description (?:does not|doesn't) use\b/i },
  { id: "deep-mechanism-vs-director", why: "DEPTH deep 'the mechanism' vs Director 'at most one sentence on how it works'",
    a: /\bAt most one sentence on how it works\b|\bDo not recite (?:how it was built|the build steps)\b/i,
    b: /\bDEPTH deep\b/i, ok: /\bDirector\b[^.]*\b(?:decision|tradeoff)\b/i },
  { id: "placeholder-in-spoken", why: "a [ ___ ] placeholder instruction in a spoken prompt vs 'never a placeholder' (guards unbracket it)",
    a: /\bspeak|out loud|spoken|they will say\b/i,
    b: /\[\s*_{2,}/, ok: /$^/ },
  { id: "opener-vs-first-sentence", why: "'opener already spoken, start at the next point' vs 'the first sentence answers the question'",
    a: /\b(?:first sentence answers|Sentence one is the answer|direct answer first)/i,
    b: /\bOPENER ALREADY SPOKEN\b/, ok: /\bopener (?:is|counts as|was) the (?:answer's )?first sentence\b/i },
  { id: "challenge-number", why: "Challenge line may carry a number, which the figures guard rewrites to 'several' / 'noticeably'",
    a: /\bChallenge:/, b: /\bChallenge:/, ok: /\bno (?:number|figure)\b/i },
  { id: "quoted-number", why: "no rule says a number the question quotes is not a source (the figures guard accepts asked figures)",
    a: /\bNUMBERS \(hard\)/, b: /\bNUMBERS \(hard\)/, ok: /\bnumber the question (?:quotes|says)\b/i },
]

export function contradictions(text) {
  const out = []
  for (const r of RULES) {
    const a = find(text, r.a), b = find(text, r.b)
    if (!a || !b) continue
    // The reconciliation must live in the newer instruction itself (sentence b, or the next sentence after it).
    const ss = sentences(text), i = ss.indexOf(b)
    const near = [b, ss[i + 1] || ""].join(" ")
    if (!r.ok.test(near)) out.push({ id: r.id, why: r.why, a: a.slice(0, 120), b: b.slice(0, 120) })
  }
  return out
}

const OPENER = { text: "Led digital forensic investigations involving payment fraud and insider threats.", sourceId: "r1", sourceDoc: "resume", category: "experience-story", verbatim: true }
/** The assembled prompt for one request, as the service builds it (desktop path live today, the web path, and the proposed desktop+lens). */
export function assembled(audience, question, path = "desktop", opener = null) {
  const pol = desktopResponsePolicy(audience, question)
  const common = [SERVICE_SYSTEM, QUESTION_FIRST_POLICY, EVIDENCE_POLICY, INTENT_BOUNDARY]
  const boundary = pol.kind === "experience" || pol.kind === "topic" ? PERSONAL_EXPERIENCE_POLICY : TECHNICAL_ANSWER_BOUNDARY
  const op = opener === undefined ? "" : openerPrompt(opener)
  if (path === "web") return [...common, audienceGuidance(audience, question), boundary, RESPONSE_CRAFT_POLICY, op].join("\n\n")
  // r4: the real wiring (desktopDelivery), switch on for "desktop+lens", off (today) for "desktop"
  const w = desktopDelivery(pol, audience, question, { on: path === "desktop+lens" })
  return [...common, w.delivery, boundary, desktopCraft(pol.kind), op, w.tail].filter(Boolean).join("\n\n")
}
export const CHECK_AUDIENCES = ["hr", "technical_hr", "engineer", "analyst", "architect", "developer", "director", "lead", "hiring_manager"]
export const CHECK_QUESTIONS = ["What is zero trust?", "Explain Kerberos simply.", "Go deeper on that.", "Security?", "Tell me about a time you led an incident.",
  "Have you configured CyberArk?", "Zero trust versus VPN, what's the difference?", "How would you secure AKS?", "Why does MFA fail?", "Introduce yourself."]
export function sweep() {
  const hits = new Map()
  for (const a of CHECK_AUDIENCES) for (const q of CHECK_QUESTIONS) for (const path of ["desktop", "web", "desktop+lens"]) for (const op of [undefined, null, OPENER]) {
    for (const c of contradictions(assembled(a, q, path, op))) {
      const k = c.id; if (!hits.has(k)) hits.set(k, { ...c, n: 0, example: `${path} | ${a} | ${q} | opener=${op === undefined ? "none" : op ? "spoken" : "empty"}` })
      hits.get(k).n++
    }
  }
  return [...hits.values()]
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const s = sweep()
  console.log(`OFFLINE prompt-contradiction sweep: ${CHECK_AUDIENCES.length} audiences x ${CHECK_QUESTIONS.length} questions x 3 paths x 3 opener states`)
  for (const h of s) console.log(`- ${h.id} (${h.n}): ${h.why}\n    e.g. ${h.example}\n    A: ${h.a}\n    B: ${h.b}`)
  if (!s.length) console.log("no contradictions")
}
