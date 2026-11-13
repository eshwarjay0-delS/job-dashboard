// Fix 6 (defensibility cycle): story variety. Real careers include calls that were wrong, overrules where the business
// was reasonable, delays the security side caused, issues still open at handover. The one reusable screenplay (find ->
// pushback -> escalate -> CISO agrees -> exception -> monitoring) is penalised across a session.

export const OUTCOMES: Record<string, string> = {
  "wrong-call": "His first read was WRONG (he misjudged severity, blamed the wrong cause or missed something), he says so plainly, and says what he changed afterwards.",
  "overruled": "He was OVERRULED and the business call was REASONABLE (say why it was reasonable); he made sure the risk was recorded with an owner.",
  "security-delay": "The security side, his own review or his team, CAUSED the delay or the friction; he owns that and says what he changed.",
  "open-at-handover": "The issue was STILL OPEN when he handed over or moved on: say exactly what was left, who owned it, and what he'd have done next.",
  "control-failed": "A control he put in place FAILED or partly failed afterwards; say how it was found and what he changed.",
  "partial": "A partial fix: one part landed, one part didn't; say what is still a gap and who owns it.",
}
export type Outcome = keyof typeof OUTCOMES

const BEATS: Record<string, RegExp> = {
  find: /\b(?:flagged|found|detected|spotted|noticed|surfaced|showed (?:a|an|that))\b/i,
  pushback: /\b(?:pushed back|push back|pushback|wanted to (?:wait|delay|skip|ship|keep|push)|refused|didn't want|objected|resisted|insisted)\b/i,
  escalate: /\b(?:escalat\w*|took (?:it|this|that) to|brought (?:it|this|in) (?:to )?the (?:CISO|IR lead|VP|director)|looped in the (?:CISO|IR lead))\b/i,
  agree: /\b(?:CISO|IR lead|VP|director|board)\b[^.]{0,50}\b(?:agreed|approved|signed|backed|sided)\b|\b(?:agreed|approved|signed off)\b/i,
  exception: /\b(?:exception|risk acceptance|accepted the risk|temporary (?:waiver|exception))\b/i,
  monitoring: /\b(?:monitor\w*|daily (?:check|review)|watch\w*|added (?:a )?(?:detection|alert|rule)|alert(?:ing)? on)\b/i,
}
const OFF_SCRIPT = /\b(?:I was wrong|I got (?:it|that) wrong|my (?:mistake|read was wrong)|I missed|they were right|(?:he|she) was right|overruled|went with (?:their|the business'?s?) call|the business call was (?:reasonable|right)|we (?:caused|were) the (?:delay|bottleneck)|my team (?:caused|was) the|our (?:review|team) (?:slowed|held)|still open (?:when|at) (?:I|handover)|handed (?:it )?over (?:still|open|unresolved)|never got (?:fixed|resolved)|the control (?:failed|broke)|didn't hold|I had to reverse|reversed (?:my|the) (?:decision|call))\b/i
export function screenplay(answer: string): { beats: string[]; formula: boolean; offScript: boolean } {
  const t = String(answer || "")
  const beats = Object.entries(BEATS).filter(([, re]) => re.test(t)).map(([k]) => k)
  const offScript = OFF_SCRIPT.test(t)
  return { beats, formula: beats.length >= 5 && !offScript, offScript }
}

// Least-used outcome first in a per-question rotation, so a session spreads across outcomes. Mistake questions get "wrong-call".
export function pickOutcome(question: string, id: string, used: Partial<Record<string, number>> = {}): string {
  if (/\b(?:wrong|mistake|missed|incorrect|admit you didn't know|changed your mind|was right)\b/i.test(question)) return "wrong-call"
  if (/\b(?:failed under your ownership|control failed|operational problem)\b/i.test(question)) return "control-failed"
  const keys = Object.keys(OUTCOMES)
  const h = [...String(id || question)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const order = keys.map((_k, i) => keys[(i + h) % keys.length])
  return order.sort((a, b) => (used[a] || 0) - (used[b] || 0))[0]
}

// Session penalty: the formula is a major finding once it has already been told twice this session.
export function sessionScreenplayPenalty(answers: string[]): number[] {
  let seen = 0
  return answers.map((a) => { const f = screenplay(a).formula; const pen = f && seen >= 2 ? 1 : 0; if (f) seen++; return pen })
}
export const VARIETY_PROMPT = `STORY OUTCOME: real careers are not one screenplay. Don't default to "I found it, they pushed back, I escalated, the CISO agreed, we took an exception and added monitoring". Outcomes where you were wrong at first, were overruled and the business call was reasonable, your own side caused the delay, or the issue was still open at handover are good answers when they fit.`
