// Fix 2 (defensibility cycle): follow-up interrogation simulator. One cheap model call per answer plays a skeptical
// senior interviewer: 3-4 hard follow-ups (who approved it, what exact evidence and how it was verified, what failed or
// what you'd change, what was your own part), the candidate's best consistent reply to each, and a verdict on whether the
// answer survives. Invented stories are allowed inside the real roles and tools (Eshwar's standing rule); this checks that
// they are DEFENSIBLE (consistent, technically coherent, right authority, plausible scale, own part kept separate).
// Pure prompt/parse logic; the caller supplies the model call, so the eval loop and the app share one implementation.

export const INTERROGATION_SYSTEM = `You are a skeptical senior security hiring manager. You interrogate ONE spoken interview answer from a candidate.
Rules of the game: the candidate may tell realistic stories set inside his real roles and tools (listed). You do NOT ask whether it really happened. You test whether it is DEFENSIBLE under follow-up questions:
- consistent with itself, with its story record and with what he said earlier this session (LEDGER),
- technically coherent: the tool can really show that data, the log source and event ID fit the OS and system (no PowerShell or Windows event IDs on a Linux sudo bug), the detection supports the conclusion (one blocked connection does not prove "no exfiltration"), the verification actually proves the fix (a rescan or version check, not "we monitored"),
- the right authority (who can approve a risk exception, containment, a change during a freeze), plausible scale for one engineer, and his own part kept separate from the team's.
Ask 3 or 4 hard follow-ups: (1) who approved or decided it, (2) what exact evidence showed it and how was it verified, (3) what failed or what would you change, (4) what was your own part (behavioural stories). For each, write the candidate's best reply (1-2 sentences) that stays strictly consistent with the answer. A follow-up "holds" if a consistent, technically sound reply exists without contradicting the answer or ledger and without new facts that conflict. It does NOT hold if the answer boxed him in (contradiction, impossible tooling, wrong authority, inflated role, an outcome the evidence can't support).
Also check the CHECKLIST: each part covered (answered explicitly, not just touched) or not.
Return JSON only:
{"followups":[{"q":"","reply":"","holds":true,"problem":""}],"contradictions":["quote + why"],"technical":["quote + why"],"authority":"ok" or "wrong: why","attribution":"ok" or "inflated: why","scale":"ok" or "implausible: why","parts":[{"part":"","covered":true,"quote":""}],"survives":true,"fix":"one line: the most important change"}`

export type StoryNode = { employer?: string; system?: string; primaryTool?: string; artifacts?: string[]; opposingRole?: string; compromise?: string; resolution?: string; outcome?: string }
export type InterrogationInput = { question: string; answer: string; roles: string; ledger?: string; checklist?: string[]; node?: StoryNode | null; prevTurn?: { q: string; a: string } | null }
export type FollowUp = { q: string; reply: string; holds: boolean; problem: string }
export type Interrogation = {
  followups: FollowUp[]; contradictions: string[]; technical: string[]; authority: string; attribution: string; scale: string
  parts: Array<{ part: string; covered: boolean; quote: string }>; partsMissed: string[]; fix: string
  held: number; asked: number; collapse: boolean; survives: boolean; passParts: boolean; pass: boolean
  issues: Array<{ code: string; fix: string }>; error?: string
}

export function interrogationUser(i: InterrogationInput): string {
  const n = i.node
  return `ROLES AND TOOLS (the only real ones):\n${i.roles}\n\nLEDGER (said earlier this session${n?.employer ? ` at ${n.employer}` : ""}):\n${i.ledger || "(none)"}\n${i.prevTurn ? `\nPREVIOUS TURN: Q: ${i.prevTurn.q}\nA: ${String(i.prevTurn.a).slice(0, 600)}\n` : ""}\nQUESTION: ${i.question}\n\nCHECKLIST (each must be covered):\n${(i.checklist || []).map((p) => "- " + p).join("\n") || "- (single ask)"}\n\nSTORY RECORD: ${n ? JSON.stringify({ employer: n.employer, system: n.system, primaryTool: n.primaryTool, artifacts: n.artifacts, opposingRole: n.opposingRole, compromise: n.compromise, resolution: n.resolution, outcome: n.outcome }) : "(no story)"}\n\nANSWER: ${i.answer}`
}

const notOk = (x: unknown): boolean => !!x && !/^ok\b/i.test(String(x))
const realList = (x: unknown): string[] => (Array.isArray(x) ? x : []).map(String).filter((s) => s.trim() && !/^(?:none|ok|no contradictions?)\b/i.test(s.trim()))

export function parseInterrogation(text: string): Interrogation | null {
  const m = String(text || "").match(/\{[\s\S]*\}/)
  if (!m) return null
  let j: Record<string, unknown> | null = null
  for (const t of [m[0], m[0].replace(/,\s*([}\]])/g, "$1")]) { try { j = JSON.parse(t); break } catch { /* try the next repair */ } }
  if (!j) return null
  const fu: FollowUp[] = (Array.isArray(j.followups) ? j.followups : []).map((x: Record<string, unknown>) => ({ q: String(x.q || ""), reply: String(x.reply || ""), holds: x.holds !== false, problem: String(x.problem || "") }))
  const parts = (Array.isArray(j.parts) ? j.parts : []).map((p: Record<string, unknown>) => ({ part: String(p.part || ""), covered: p.covered !== false, quote: String(p.quote || "") }))
  const contradictions = realList(j.contradictions), technical = realList(j.technical)
  const authority = String(j.authority || "ok"), attribution = String(j.attribution || "ok"), scale = String(j.scale || "ok")
  const held = fu.filter((x) => x.holds).length
  const collapse = fu.length > 0 && held < fu.length
  const survives = !collapse && !contradictions.length && !technical.length && !notOk(authority) && !notOk(attribution) && !notOk(scale)
  const partsMissed = parts.filter((p) => !p.covered).map((p) => p.part)
  const issues = [
    ...contradictions.map((c) => ({ code: "contradiction", fix: `Contradiction: ${c}` })),
    ...technical.map((c) => ({ code: "technical-incoherence", fix: `Technically incoherent: ${c}` })),
    ...(notOk(authority) ? [{ code: "authority-wrong", fix: `Authority: ${authority}` }] : []),
    ...(notOk(attribution) ? [{ code: "attribution", fix: `Attribution: ${attribution}. Keep his own part separate from the team's.` }] : []),
    ...(notOk(scale) ? [{ code: "implausible-scale", fix: `Scale: ${scale}` }] : []),
    ...fu.filter((x) => !x.holds).map((x) => ({ code: "followup-collapse", fix: `Follow-up "${x.q}" breaks it: ${x.problem}` })),
    ...partsMissed.map((p) => ({ code: "part-missed", fix: `Answer this part explicitly: ${p}` })),
  ]
  return { followups: fu, contradictions, technical, authority, attribution, scale, parts, partsMissed, fix: String(j.fix || ""), held, asked: fu.length, collapse, survives, passParts: !partsMissed.length, pass: survives && !partsMissed.length, issues }
}

// Run one interrogation with a caller-supplied model call. A failed call returns survives=false with the error, never a pass.
export async function interrogate(generate: (system: string, user: string) => Promise<string>, input: InterrogationInput): Promise<Interrogation> {
  const empty: Interrogation = { followups: [], contradictions: [], technical: [], authority: "ok", attribution: "ok", scale: "ok", parts: [], partsMissed: [], fix: "", held: 0, asked: 0, collapse: false, survives: false, passParts: false, pass: false, issues: [] }
  if (!input.answer) return { ...empty, error: "empty answer" }
  try {
    const r = parseInterrogation(await generate(INTERROGATION_SYSTEM, interrogationUser(input)))
    return r || { ...empty, error: "unparsed interrogation" }
  } catch (e) {
    return { ...empty, error: String((e as Error)?.message || e) }
  }
}

// The retry message: the generator gets the interrogator's findings and fixes them once.
export function interrogationRetry(question: string, draft: string, issues: Array<{ fix: string }>): string {
  return `QUESTION: ${question}\n\nYOUR DRAFT:\n${String(draft).slice(0, 2500)}\n\nA skeptical interviewer's follow-ups broke this draft. Fix every problem, keep what was fine, and return the full answer again:\n- ${issues.map((i) => i.fix).join("\n- ")}`
}
