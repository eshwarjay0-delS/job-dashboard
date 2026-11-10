// Prepared-sheet lookup. Exact key only: same intent, same objects, same contrast.
// A neighbour (authorization vs UI/API testing, scanner outage vs scanner tuning) is not a match.

const INTRO = /\b(?:about yourself|introduce yourself|your (?:background|resume|career)|tell me about you)\b/i
const WHY_ROLE = /\bwhy (?:do you want|this role|our role|this position|this company|us)\b|\bwhy (?:are you|you'?re) (?:interested|here)\b/i

/** Canonical object id, then the spellings that count as that object. */
const OBJECTS: Array<[string, RegExp]> = [
  ["authentication", /\b(?:authenticat\w*|authn|log(?:ging)? in|logins?|sign-ins?)\b/i],
  ["authorization", /\b(?:authori[sz]\w*|authz|access controls?)\b/i],
  ["ui", /\b(?:\bui\b|user interface|\bbuttons?\b)\b/i],
  ["api", /\b(?:\bapis?\b|\bendpoints?\b)\b/i],
  ["sast", /\bsast\b/i],
  ["dast", /\bdast\b/i],
  ["scanner", /\bscanners?\b/i],
  ["outage", /\boutages?\b/i],
  ["tuning", /\b(?:tun(?:e|ing)|noisy)\b/i],
  ["syslog", /\b(?:syslog|log aggregator)\b/i],
  ["siem", /\b(?:\bsiem\b|splunk)\b/i],
  ["otp", /\b(?:one-time passwords?|one time passwords?|\botp\b)\b/i],
  ["mfa", /\b(?:\bmfa\b|multi-factor|multifactor)\b/i],
  ["iam", /\b(?:\biam\b|joiner|mover|leaver|identity lifecycle)\b/i],
  ["remote-access", /\b(?:remote access|privileged access|\bcyberark\b|privileged session)\b/i],
  ["phishing", /\bphishing\b/i],
  ["ransomware", /\bransomware\b/i],
  ["tprm", /\b(?:\btprm\b|third-party risk|vendor questionnaire)\b/i],
  ["nist", /\b(?:\bnist\b|iso 27001)\b/i],
  ["vulnerability", /\bvulnerabilit\w*\b/i],
  ["threat", /\bthreats?\b/i],
  ["pipeline", /\b(?:ci\/?cd|pipelines?)\b/i],
  ["package", /\b(?:packages?|dependenc(?:y|ies))\b/i],
  ["java", /\bjava\b/i],
  ["zero-trust", /\bzero trust\b/i],
  ["compensating", /\bcompensating controls?\b/i],
  ["risk-acceptance", /\brisk acceptance\b/i],
  ["least-privilege", /\bleast privilege\b/i],
  ["soc", /\b\bsoc\b/i],
  ["when-to-use", /\bwhen would you use\b/i],
  ["impossible-travel", /\bimpossible-travel\b/i],
  ["stakeholder", /\bstakeholders?\b/i],
  ["duties", /\b(?:separate duties|separation of duties)\b/i],
]

const CONTRAST_PAIRS = [
  ["ui", "api"],
  ["authentication", "authorization"],
  ["sast", "dast"],
  ["vulnerability", "threat"],
  ["mfa", "otp"],
]

export type SheetKey = { intent: string; objects: string[]; contrast: string[] }

export function sheetObjects(value: string): string[] {
  const text = String(value || "")
  const found: string[] = []
  for (const [id, re] of OBJECTS) if (re.test(text) && !found.includes(id)) found.push(id)
  return found.sort()
}

function contrastOf(text: string, objects: string[]): string[] {
  const asked = /\b(?:difference|versus|\bvs\b|compared|across both|instead of)\b/i.test(text)
  const sides: string[] = []
  for (const [a, b] of CONTRAST_PAIRS) {
    if (objects.includes(a) && objects.includes(b) && (asked || /\bacross both\b/i.test(text))) {
      sides.push(a, b)
    }
  }
  return [...new Set(sides)].sort()
}

export function sheetKey(value: string): SheetKey {
  const text = String(value || "").trim()
  const objects = sheetObjects(text)
  const contrast = contrastOf(text, objects)
  let intent = "direct"
  if (INTRO.test(text)) intent = "intro"
  else if (WHY_ROLE.test(text)) intent = "value"
  else if (contrast.length) intent = "contrast"
  else if (/\b(?:tell me about a time|a time (?:you|when)|something went wrong)\b/i.test(text)) intent = "story"
  else if (/\b(?:disagree|disputes?|push(?:ed)? back|stakeholder)\b/i.test(text)) intent = "disagreement"
  else if (/\b(?:prioriti[sz]e|which applications|triage)\b/i.test(text)) intent = "triage"
  else if (/\b(?:incident response|ransomware|compromised|encrypted a file)\b/i.test(text)) intent = "incident"
  else if (/\b(?:what(?:'s| is| are)|define)\b/i.test(text) && !/\bhow (?:would|do|did)\b/i.test(text)) intent = "definition"
  else if (/\b(?:how (?:would|do|did)|walk me through|implement|handle)\b/i.test(text)) intent = "howto"
  return { intent, objects, contrast }
}

/** True only when the prepared entry is this ask. Glue overlap is not enough. */
export function sheetTopicMatch(asked: string, entry: string): boolean {
  const a = String(asked || "").trim()
  const b = String(entry || "").trim()
  if (!a || !b) return false
  const left = sheetKey(a)
  const right = sheetKey(b)
  if (left.intent !== right.intent) return false
  if (left.intent === "intro" || left.intent === "value") return true
  if (!left.objects.length || !right.objects.length) return false
  if (left.objects.join("|") !== right.objects.join("|")) return false
  return left.contrast.join("|") === right.contrast.join("|")
}

export function looksLikeSheetQuestion(text: string): boolean {
  const head = String(text || "").split(/\n/)[0].replace(/^Q:\s*/i, "").trim()
  if (head.length < 12 || head.length > 280) return false
  if (/\?\s*$/.test(head)) return true
  return /^(?:what|how|why|who|tell me|walk me|describe|explain|can you|could you|would you|do you|have you)\b/i.test(head)
}

export const ANSWER_SHAPE = `ANSWER SHAPE: Sentence one answers the question above in plain words. No warm-up and no restating. Then the steps, first person, like one employee talking to a coworker. Name a tool only when this resume contains it. One short example only from this resume, on this same topic. Sixty to one hundred and twenty spoken words. If the resume does not cover the question, answer it directly and do not invent an employer or a tool. Microsoft Entra ID at Citi is not a source fact unless both strings are in the resume; otherwise say our identity platform and do not name Citi.`

export const SIGN_OFF_LINE = "Thank you, I appreciated the conversation. I enjoyed learning more about the role, and I look forward to hearing about the next steps. Have a good rest of your day."

/** The interviewer closed the conversation. Not a technical question. */
export function interviewSignOff(question: string): boolean {
  const text = String(question || "").trim()
  if (!text || /\?/.test(text)) return false
  if (/\b(?:what|how|why|when|where|which|who|can you|could you|would you|tell me|describe|explain|walk me)\b/i.test(text)) return false
  return /\b(?:that(?:'s| is) (?:going to be |gonna be |about )?it for (?:the |my |our )?questions|appreciate (?:our|the|this) conversation|thank you for taking the time|thanks for taking the time|i will (?:speak|talk) to|we will get back to you|(?:hear|talk) about the next steps|have a (?:great|good) (?:rest of your )?day)\b/i.test(text)
}

const GLUE = new Set(
  ("what when where which with have your about would could should tell explain describe please there their this that some give walk through between experience yourself into from does work used using interview question role time just also very they them then than here over under after before been being were was are can will may might must more most much many such only onto within without did has had its who why not but the and for you how are was his her our out all any one two").split(" "),
)

export function sheetTopicTerms(value: string): Set<string> {
  const words = String(value || "").toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []
  const out = new Set<string>()
  for (const word of words) {
    if (GLUE.has(word) || word.length < 3) continue
    out.add(word.slice(0, 6))
  }
  return out
}
