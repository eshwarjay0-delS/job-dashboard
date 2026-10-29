/**
 * Answer-intent routing for Kompas.
 *
 * This is a scope/voice contract, NOT a claim that regexes understand meaning.
 * The incoming question controls depth; the original resume/docs control facts.
 * Generic questions must not trigger unrelated technical project inventories.
 */
export type ReplyIntent =
  | "introduction" | "closing-question" | "acknowledgement" | "value"
  | "experience-story" | "comparison" | "definition" | "scenario"
  | "technical-process" | "logistics" | "follow-up" | "direct"
export type FocusPlan = {
  intent: ReplyIntent
  minWords: number
  maxWords: number
  opening: string
  proof: string
  technicalDepth: "surface" | "asked-only" | "deep"
}
const EXPERIENCE=/\b(?:tell me about a time|share an example|give me an example of (?:when|a time)|describe a situation|have you ever|what did you do when|walk me through (?:an|a) (?:issue|incident|project|challenge)|a time (?:you|when you))\b/i
const CLOSING=/\b(?:what questions (?:do|would|might|can) you have|any questions (?:for|from) me|what would you (?:like to )?ask (?:me|us)|anything you(?:'d| would) (?:like|want) to ask|questions about (?:the|this) (?:role|team|company))\b/i
const INTRO=/\b(?:tell me about yourself|introduce yourself|walk (?:me|us) through your (?:career|background)|your professional background|career (?:journey|overview)|self introduction)\b/i
const VALUE=/\b(?:what (?:would|can|do) you bring to|what (?:can|would) you contribute|why (?:are|would|should) (?:we hire you|you be (?:a )?(?:good|strong) fit)|what makes you (?:a )?(?:good|strong) fit|what sets you apart|highlight (?:for me )?anything|anything (?:else )?(?:i|we) should (?:know|be aware of)|why (?:do|would) you want (?:this|to work)|why (?:bny|this role|our team))\b/i
const LOGISTICS=/\b(?:relocat(?:e|ion)|on.?site|hybrid|notice period|start date|available to start|sponsorship|work authorization|travel|salary|compensation|clearance|working (?:hours|days))\b/i
const DEFINE=/\b(?:what is|what are|what does .{1,55} mean|define|stands? for|explain (?:the term|what .{1,60} is))\b/i
const COMPARE=/\b(?:which (?:one|framework|tool|approach|option)|stronger (?:in|with)|more (?:proficient|comfortable|familiar)|difference between|compare|versus|vs[.]?|how do .+ differ|prefer .+ (?:or|over))\b/i
const SCENARIO=/\b(?:how would you|what would you do|suppose|imagine|if you (?:were|had|found|saw)|hypothetical|in that situation|how should (?:we|the team)|scenario)\b/i
const DEEP=/\b(?:step by step|walk me through|under the hood|exact (?:logs|fields|mechanics|steps|flow)|deep dive|debug|troubleshoot|design|implement|packet|query|architecture|how (?:does|do|did) .+ work|how exactly)\b/i
const ACK=/^\s*(?:yeah|right|okay|ok|great|thanks|thank you|that makes sense|absolutely|so that's|you(?:'ll| will)|we(?:'ll| will)|the team|our team|it's important|i expect|i would expect)\b/i
const FOLLOW=/^\s*(?:and (?:then|how|why|what)|what (?:about|happened)|how (?:so|did you verify)|can you (?:expand|elaborate)|go (?:deeper|on)|tell me more|why is that)\b/i
const QUESTION=/\?|^\s*(?:what|why|how|when|where|which|who|tell|describe|explain|give|walk|could|can|would|will|are|is|do|does|have|has|should)\b/i

export function interviewIntent(question: string): ReplyIntent {
  const q=String(question||'').trim()
  if(!q) return "direct"
  if(CLOSING.test(q)) return "closing-question"
  if(INTRO.test(q) || /^intro(?:duction)?[.?!]?$/i.test(q)) return "introduction"
  if(VALUE.test(q)) return "value"
  if(EXPERIENCE.test(q)) return "experience-story"
  if(LOGISTICS.test(q) && !/\b(?:how (?:does|do)|why|difference|design|troubleshoot)\b/i.test(q)) return "logistics"
  if(COMPARE.test(q)) return "comparison"
  if(DEFINE.test(q)) return "definition"
  if(FOLLOW.test(q) && q.split(/\s+/).length<=12) return "follow-up"
  if(SCENARIO.test(q)) return "scenario"
  if(DEEP.test(q)) return "technical-process"
  // Director statements often trail off with "right?" without asking the
  // candidate a substantive question. Do not introduce a full technical story.
  const noSubstantiveAsk=!QUESTION.test(q.replace(/\b(?:right|okay|yeah)\s*\?\s*$/i,""))
  if(noSubstantiveAsk || (ACK.test(q) && !/\b(?:what|how|why|tell me|can you|do you|would you)\b/i.test(q)))return "acknowledgement"
  return "direct"
}

const BUDGET: Record<ReplyIntent,[number,number,string,string,"surface"|"asked-only"|"deep"]>={
 "introduction":[115,175,"Give a career-wide introduction, present role and prior breadth.","Use only employers and responsibilities supported by original sources.","surface"],
 "closing-question":[35,85,"Ask one or two specific questions about this team and its work.","Use what the interviewer has already explained; do not pitch or invent details.","surface"],
 "acknowledgement":[22,65,"Acknowledge the point and connect it to the relevant work, briefly.","Do not introduce a fresh project, tool stack, metrics or unasked story.","surface"],
 "value":[70,125,"State two or three relevant strengths and why they help this role.","Synthesize current and prior supported experience, not one random project.","surface"],
 "experience-story":[95,170,"State the real situation and your own specific action.","Describe a source-supported work area, evidence, challenge and outcome; do not invent the moment.","asked-only"],
 "comparison":[45,100,"Make the choice or distinction in the first sentence.","Explain the single relevant difference with one practical example.","surface"],
 "definition":[25,75,"Define the term plainly in the first sentence.","Add why it matters only if needed to answer.","surface"],
 "scenario":[75,155,"Start with what you would actually do in the given situation.","Use conditional steps, checks, decision points and verification; do not pretend the scenario happened.","asked-only"],
 "technical-process":[85,175,"Explain the requested mechanism in the order it operates.","Use necessary technical fields or tools only if asked for that level of depth.","deep"],
 "logistics":[12,55,"Answer the practical yes/no or availability question directly.","No unrelated technical background or fabricated personal constraint.","surface"],
 "follow-up":[35,115,"Answer the immediate follow-up using the same subject as the prior answer.","Do not switch employers, systems or projects without being asked.","asked-only"],
 "direct":[40,115,"Answer the latest actual question immediately.","Give only enough evidence to make the answer credible.","asked-only"],
}
export function focusPlan(question:string,tier:number,level:string):FocusPlan{
 const intent=interviewIntent(question)
 const [min,max,opening,proof,depth]=BUDGET[intent]
 const detailed=DEEP.test(question)&&["scenario","technical-process","experience-story","follow-up"].includes(intent)
 // Technical depth may grow when specifically requested, not merely because
 // the session is in Director/Engineer mode. Preserve full source-backed intros.
 const adjusted=detailed?max+40:max
 const minWords=tier===0?Math.max(min,115):min
 return {intent,minWords,maxWords:adjusted,opening,proof,technicalDepth:detailed?"deep":depth}
}
export function applyFocusBudget(original:number,plan:FocusPlan):number{
 if(!Number.isFinite(original)||original<=0)return plan.maxWords
 return Math.max(plan.minWords,Math.min(original,plan.maxWords))
}
export function focusPrompt(question:string,tier:number,level:string):string{
 const p=focusPlan(question,tier,level)
 return [
  "QUESTION-FIRST SCOPE (OVERRIDES generic breadth, jargon quotas, forced project stories, and mechanical templates):",
  "Intent: "+p.intent+". "+p.opening+" "+p.proof,
  "Never turn a short/direct/soft question into a technical architecture lecture. One answer thread, no accidental second topic.",
  "Use the interviewer's exact technical nouns when essential. Otherwise translate concepts into ordinary speech. A term or tool never earns a sentence merely because it appears in the resume, JD or earlier conversation.",
  "Every technical name must either answer a named part of THIS question or explain the immediately preceding decision; otherwise omit it. Define an unfamiliar acronym in a short clause if it is indispensable.",
  "When the question asks for independent challenge, distinguish the control owner's claims from evidence you personally reviewed; do not claim to approve risk on behalf of leadership.",
  "An explanation is not a demonstration of personal history. Only original resume/documents support employers, responsibilities, incidents, achievements or figures.",
  "Spoken length guide: "+p.minWords+"–"+p.maxWords+" words unless user explicitly asks for more. Do not fill space to reach a token or word quota. Stop when the requested parts are complete.",
  "Technical depth: "+p.technicalDepth+". An explicitly requested implementation drill-down may be detailed; a general invitation, definition, logistics question, or closing question must stay on the surface."
 ].join("\n")
}

/** Diagnostics only; never silently censor legitimate specialist material. */
const UNEXPECTED_JARGON=[
 "AS-REP roasting","DCSync","Golden Ticket","Silver Ticket","Cobalt Strike","Kerberoasting",
 "pass-the-hash","hash dumping","reverse shell","NTLM relay","LSASS dumping",
 "EDR bypass","SQL injection","XSS","packet injection","YARA rules","Kubernetes",
 "Terraform","service mesh","Kafka","Snowflake","SAML assertion","JWT claims",
 "OAuth scopes","GraphQL introspection","BloodHound"
]
export function tangentSignals(question:string,answer:string):string[]{
 const intent=interviewIntent(question)
 if(!["introduction","value","closing-question","acknowledgement","logistics","definition"].includes(intent))return []
 const q=String(question||'').toLowerCase(),a=String(answer||'')
 const excess=UNEXPECTED_JARGON.filter(term=>a.toLowerCase().includes(term.toLowerCase())&&!q.includes(term.toLowerCase()))
 // One legitimately relevant term in a role overview is okay; two unsupported
 // high-specificity terms in a soft question indicate likely jargon drift.
 return excess.length>=2?excess:[]
}
