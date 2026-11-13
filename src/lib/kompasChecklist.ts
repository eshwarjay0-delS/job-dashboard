// Fix 1 (defensibility cycle): question decomposition BEFORE generation, validation AFTER.
// A question like "What do you do first, who has the authority, and how do you confirm it worked without inventing a
// metric?" is four requirements. decompose() turns it into a mandatory checklist the prompt carries; validate() checks
// the finished answer against it. Any missed mandatory item fails the answer, however good the rest sounds.
import { contentWords, DECIDE, FIRST_ACT, SIGNER, sentences, stem, subQuestions, toolsIn, VERIFY, words } from "./kompasDefendText.ts"

export type ChecklistItem = { key: string; text: string; mandatory: boolean; source: "rule" | "bank" | "sub-question"; re?: string }
export type ChecklistRow = ChecklistItem & { covered: boolean }
export type PrevTurn = { q: string; a: string }
type Rule = { key: string; re: RegExp; text: string; test: (s: string[], t: string, q: string, prev?: PrevTurn | null) => boolean }

const SEC: Record<string, number> = { ten: 10, fifteen: 15, twenty: 20, thirty: 30 }
const PAST_I = /\b(?:I|we)\s+(?:\w+\s+)?(?:[a-z]+ed|ran|wrote|built|found|took|kept|saw|got|caught|pulled|sent|told|held|brought|shut|cut|set|put|spent|had)\b/i

export const RULES: Rule[] = [
  { key: "first-action", text: "the first action, in the first two sentences",
    re: /\b(?:what (?:do|would|did) you do first|do first|first (?:thing|step|move|action|call|hour|minutes?|\d+|ten|fifteen|thirty|24)|where (?:do|would) you start|what's (?:your|the) first|what do you do (?:right now|immediately)|in the first (?:hour|\d+|ten|fifteen|thirty))\b/i,
    test: (s) => s.slice(0, 2).some((x) => FIRST_ACT.test(x) || /\b(?:first|start(?:s|ed)? (?:by|with)|right away|immediately|before anything|my first)\b/i.test(x)) },
  { key: "authority", text: "who has the authority (a named role that signs or decides)",
    re: /\b(?:who (?:has|holds|owns|gets) (?:the )?(?:authority|decision|final (?:say|call)|call|risk)|who (?:signs|approves|decides|accepts|owns|makes the (?:call|decision)|can (?:approve|sign|accept))|whose (?:call|decision|risk|authority)|who(?:'s| is) accountable|has the authority|who has authority)\b/i,
    test: (s) => s.some((x) => SIGNER.test(x) && DECIDE.test(x)) },
  { key: "verification", text: "how it was (or will be) confirmed, with a concrete check",
    re: /\b(?:how (?:do|would|did|will|can) you (?:confirm|know|verify|prove|check|tell|validate|show)|how do you know|confirm (?:it|that|the fix|the change)? ?worked|prove (?:it|that)|what evidence|evidence (?:that|it)|how (?:was|is) it (?:verified|confirmed)|know it was contained)\b/i,
    test: (s) => s.some((x) => VERIFY.test(x) && !/^\s*(?:I|we) (?:just )?(?:monitor|watch)/i.test(x)) },
  { key: "no-invented-metric", text: "no invented metric; a non-numeric check instead",
    re: /\bwithout (?:inventing|making up|quoting|citing|giving) (?:a |any )?(?:metric|number|figure|percentage|stat)s?/i,
    test: (s, t) => !/\b\d+(?:\.\d+)?\s*(?:%|percent)|\bMTTR\b|\b(?:reduced|cut|dropped|improved) (?:it |them )?by \d|\b\d+x\b/i.test(t) && s.some((x) => VERIFY.test(x)) },
  { key: "time-limit", text: "fits the time limit (about 2.8 spoken words per second)",
    re: /\b(?:in (?:20|twenty|15|fifteen|30|thirty|ten|10) seconds|in one sentence|one-sentence|in a sentence|in two sentences)\b/i,
    test: (_s, t, q) => {
      const sec = (q.match(/\b(20|twenty|15|fifteen|30|thirty|10|ten) seconds/i) || [])[1]
      const lim = /one sentence|a sentence/i.test(q) ? 40 : /two sentences/i.test(q) ? 55 : sec ? Math.round((SEC[sec.toLowerCase()] || Number(sec)) * 2.8) : 60
      return words(t) <= lim
    } },
  { key: "no-jargon", text: "no jargon (at most one acronym, no tool names or event IDs)",
    re: /\b(?:without (?:the )?(?:technical )?(?:jargon|terminology|acronyms|tech(?:nical)? terms)|plain (?:English|language|words)|non-technical (?:person|audience|executive|manager)|like I'm (?:five|not technical)|to my (?:mom|mother|grandmother))\b/i,
    test: (_s, t) => (t.match(/\b(?:SIEM|EDR|XDR|IAM|PAM|MFA|SSO|CVE|IOC|TTP|SOC|DLP|CASB|SOAR|IDS|IPS|WAF|API|C2|RCE|CVSS|KQL|SPL|GPO|TGS|TGT|SPN|RC4|TLS|VPN)\b/g) || []).length + (/\bEvent ID|\b4(?:6|7)\d{2}\b/.test(t) ? 2 : 0) + toolsIn(t).length <= 1 },
  { key: "one-tool", text: "names exactly one tool", re: /\b(?:pick one tool|one tool|single tool|just one tool|too many tools|name one tool)\b|\bPick one\.?$/i,
    test: (_s, t) => toolsIn(t).length === 1 },
  { key: "concrete-example", text: "one concrete past example with what he personally did",
    re: /\b(?:give me a (?:concrete|specific|real) example|concrete example|specific example|actual example|real example|what exactly did you do|what did you actually do)\b/i,
    test: (s) => s.some((x) => PAST_I.test(x)) && s.some((x) => /\b(?:Citi|CVS|San Diego|Charter|Accenture|ticket|alert|scan|account|host|server|rule|finding|exception|review|patch|release)\b/i.test(x)) },
  { key: "containment-proof", text: "containment evidence: scope checked, no further activity, and what is still unknown",
    re: /\b(?:how do you know (?:it was|it's|that it was|it is|when it's|when it is) contained|(?:was|is) contained\. how do you know|prove (?:it was )?contain\w*)\b/i,
    test: (_s, t) => /\b(?:no (?:further|new|more)|stopped|scop\w*|every (?:host|account|device)|across (?:the|all)|egress|outbound|beacon\w*|re-?image|rotated|timeline|sessions?|tokens?|still (?:watching|open|not sure))\b/i.test(t) && /\b(?:check|confirm|look|saw|showed|query|search|reviewed)\w*/i.test(t) },
  { key: "re-answer", text: "sentence one answers the original question directly",
    re: /\b(?:that's not what I asked|not what I asked|you didn't answer|answer the question)\b/i,
    test: (s, _t, _q, prev) => {
      const cw = (x: string) => (String(x).toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !/^(?:about|would|could|should|which|their|there|where|asked|answer|question|thing|stop)$/.test(w)).map((w) => w.slice(0, 5))
      const ow = new Set(cw(prev?.q || ""))
      return !!s[0] && cw(s[0]).some((w) => ow.has(w))
    } },
  { key: "personal-part", text: "his own part, separated from the team's",
    re: /\b(?:what (?:exactly )?(?:did you|was your) (?:personally )?(?:do|part|role|contribution)|your (?:personal|own) (?:part|role|contribution)|I don't believe that was your responsibility)\b/i,
    test: (s) => s.some((x) => /\bI (?:personally |myself )?(?:pulled|wrote|ran|built|checked|found|traced|drafted|configured|tested|owned|did|was the one|handled|reviewed|mapped|compared|kept|raised|chased|isolated|reset|blocked|disabled|called|sat|took)\b|\bmy (?:part|piece|job|role) (?:was|is)\b/i.test(x)) },
  { key: "failure-what-now", text: "the fallback when the first plan fails",
    re: /\b(?:assume (?:your|the) (?:proposed )?(?:solution|fix|plan) fails|if (?:that|it|your fix) (?:fails|doesn't work)|now what)\b/i,
    test: (_s, t) => /\b(?:fall ?back|roll ?back|plan B|next (?:step|option|layer)|then I'd|then we|instead|escalat\w*|revert\w*|second option)\b/i.test(t) },
  { key: "what-was-wrong", text: "owns what he got wrong, plainly",
    re: /\b(?:turned out to be wrong|were wrong|was wrong|your (?:initial|first) (?:assessment|read|call|investigation) was (?:incorrect|wrong)|(?:a|the) (?:vulnerability|thing|finding|threat|risk) you missed|mistake|wrong call|admit you didn't know|changed your mind|manager [^?.]* was right)\b/i,
    test: (_s, t) => /\b(?:I was wrong|I got (?:it|that|the \w+) wrong|my (?:mistake|call was wrong|read was wrong|assumption|first read|error)|I (?:\w+ )?(?:missed|misconfigured|misjudged|misread|overlooked|underestimated|overestimated|assumed|jumped to)|I'd (?:assumed|misread)|I had assumed|I should have|I didn't know|I changed my mind|they were right|(?:he|she) was right|(?:it|that) was on me|my fault)\b/i.test(t) },
  { key: "what-changed", text: "what he changed afterwards",
    re: /\b(?:turned out to be wrong|(?:a|the) (?:vulnerability|thing|finding|threat) you missed|mistake|wrong call|failed under your ownership|caused an operational problem|incorrect|changed your mind|what (?:did you|would you) (?:change|do differently)|what you'd change|change afterwards)\b/i,
    test: (_s, t) => /\b(?:now I|now we|since then|I (?:changed|added|started|updated|rewrote|introduced|set up|built|moved|stopped|made it a rule|began)|these days I|I'd (?:now|do it differently)|next time|what I do differently|I no longer|I learned to|after(?:wards| that)?,? (?:I|we) (?:\w+ed|built|wrote|set|made|began))\b/i.test(t) },
]

export function decompose(question: string, bank: Array<{ key: string; text: string; re: string; mandatory?: boolean }> = []): ChecklistItem[] {
  const items: ChecklistItem[] = RULES.filter((r) => r.re.test(question)).map((r) => ({ key: r.key, text: r.text, mandatory: true, source: "rule" }))
  for (const c of bank) items.push({ key: c.key, text: c.text, mandatory: c.mandatory !== false, source: "bank", re: c.re })
  const subs = subQuestions(question)
  if (subs.length > 1) subs.forEach((s, i) => items.push({ key: `sub-${i + 1}`, text: s, mandatory: true, source: "sub-question" }))
  return items
}

// Lexical sub-question coverage: a sentence shares two content words with the sub-question, or one plus a concrete noun.
const CONCRETE = /\b(?:ticket|record|log|scan|rescan|rule|alert|owner|manager|CISO|CAB|lead|exception|change|rollback|evidence|report|control|policy|access|account|MFA|host|server|patch|finding|audit|team|vendor|legal|system|data|approval|decision|risk|deadline|window|release)\b|\bI(?:'d| would| check| pull| run)\b|\d/i
const PARAPHRASE: Array<[RegExp, RegExp]> = [
  [/\b(?:find out|found out|how did you know|realiz\w*|discover\w*)\b/i, /\b(?:found out|realiz\w*|noticed|showed|came back|caught|pointed out|flagged|saw|spotted)\b/i],
  [/\b(?:change|differently|learn\w*)\b/i, /\b(?:now I|since then|I (?:changed|added|started|updated|stopped|learned)|these days|next time)\b/i],
  [/\b(?:criteria|why|decide|choose)\b/i, /\b(?:because|since|the reason|that's why|so that)\b/i],
  [/\b(?:prioriti\w*)\b/i, /\b(?:first|ahead of|over|before|won out|deferred|parked)\b/i],
]
function subCovered(sub: string, s: string[]): boolean {
  const t = s.join(" ")
  const rule = RULES.find((r) => r.re.test(sub))
  if (rule && rule.test(s, t, sub, null)) return true
  if (PARAPHRASE.some(([q, a]) => q.test(sub) && a.test(t))) return true
  const w = contentWords(sub).map(stem)
  if (!w.length) return true
  if (/\b(?:what (?:do|did|would) you do|how (?:do|did|would) you (?:handle|go about|manage))\b/i.test(sub)) return s.filter((x) => FIRST_ACT.test(x)).length >= 2
  return s.some((x) => { const hit = contentWords(x).filter((y) => w.includes(stem(y))).length; return hit >= 2 || (hit >= 1 && CONCRETE.test(x)) })
}

export function validate(question: string, answer: string, opts: { bank?: Array<{ key: string; text: string; re: string; mandatory?: boolean }>; prev?: PrevTurn | null } = {}): { rows: ChecklistRow[]; missed: ChecklistRow[]; coverage: number; pass: boolean } {
  const s = sentences(answer), t = s.join(" ")
  const rows: ChecklistRow[] = decompose(question, opts.bank || []).map((it) => {
    const rule = RULES.find((r) => r.key === it.key)
    const covered = it.source === "sub-question" ? subCovered(it.text, s) : it.re ? new RegExp(it.re, "i").test(t) : rule ? rule.test(s, t, question, opts.prev || null) : true
    return { ...it, covered }
  })
  const missed = rows.filter((r) => r.mandatory && !r.covered)
  const coverage = rows.length ? Math.round((100 * rows.filter((r) => r.covered).length) / rows.length) : 100
  return { rows, missed, coverage, pass: !missed.length }
}

// Prompt block: the checklist travels with the question so every item gets its own explicit sentence.
export function checklistPrompt(question: string, bank: Array<{ key: string; text: string; re: string }> = []): string {
  const items = decompose(question, bank)
  if (!items.length) return ""
  return `CHECKLIST (mandatory; the answer fails if any item is missing). Answer each one explicitly, in the order asked, with its own sentence; respect constraints literally (a time limit is a word limit, "without jargon" means no acronyms or tool names, "pick one tool" means exactly one tool):\n${items.map((i) => `- ${i.text}`).join("\n")}`
}
