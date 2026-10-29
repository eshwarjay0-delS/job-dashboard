/**
 * Re-discover the current interviewer's intention from the exact wording.
 *
 * This is a bounded relevance contract, NOT a semantic oracle:
 * 1) identify what the current turn is asking for;
 * 2) separate the current request from previous setup/context;
 * 3) recover an elliptical follow-up topic from interviewer history ONLY;
 * 4) choose relevant depth and evidence, excluding story/tool rotation unless asked;
 * 5) explicitly tell the writer what NOT to answer.
 */
import { focusPlan, interviewIntent, namedQuestionTerms, type ReplyIntent } from "./kompasRelevance"
export type RelevanceRecovery={
 currentAsk:string
 intent:ReplyIntent
 requestedTopics:string[]
 answerMode:"confirm"|"describe"|"compare"|"ask"|"decide"|"explain"|"demonstrate"
 contextSubject:string
 contextRelation:"none"|"follow-up"
 excludedMoves:string[]
 evidencePolicy:"source-supported-history"|"hypothetical-only"|"no-personal-story"
}
const elliptical=/^(?:and (?:then|how|why|what)|why (?:is|was) that|what (?:about|happened|changed)|how (?:so|did you (?:check|know|verify))|can you (?:expand|elaborate)|tell me more|go (?:deeper|on)|what did you do next)/i
const TOPICS=[
 ["business impact",/\b(?:business impact|business (?:services|processes)|customer impact)\b/i],
 ["root cause",/\b(?:root cause|root-cause|underlying (?:cause|failure))\b/i],
 ["compensating controls",/\b(?:compensating (?:control|measure)|temporary safeguard|interim control)\b/i],
 ["residual risk",/\b(?:residual risk|remaining (?:risk|exposure))\b/i],
 ["remediation plan",/\b(?:remediation (?:plan|strategy)|corrective action|proposed fix)\b/i],
 ["independent challenge",/\b(?:challenge|push back|question the (?:owner|team)|disagree|independently (?:assess|verify))\b/i],
 ["evidence",/\b(?:evidence|proof|supporting records|logs|validate|verify|confirm)\b/i],
 ["team collaboration",/\b(?:team collaboration|collaborat(?:ion|e|ive)|leadership|working (?:with|across) (?:the |different )?teams)\b/i],
 ["first ninety days",/\b(?:first (?:30|60|90) days|30[- ]60[- ]90|60[- ]90 days|ninety days)\b/i],
 ["current experience",/\b(?:current experience|current role|your current work)\b/i],
 ["past experience",/\b(?:past experience|prior experience|previous experience|your background)\b/i],
 ["decision criteria",/\b(?:how (?:do|would) you (?:decide|prioriti[sz]e)|criteria|trade.?off)\b/i],
] as const

function coreQuestion(q:string):string{
 const raw=String(q||"").replace(/\s+/g," ").trim()
 if(!raw)return ""
 // ASR sometimes appends "right?" to an explanation. That is not a request
 // to dump a security runbook.
 return raw.replace(/\s+(?:right|okay|you know)\s*\?\s*$/i,"").trim()||raw
}
function latestSubject(history:string):string{
 const lines=String(history||"").split(/\n+/).map(x=>x.trim()).filter(Boolean)
 const candidate=lines.slice(-8).reverse().find(x=>/\b(?:Them:|Interviewer:|question:|what|how|why|tell me|explain)\b/i.test(x))
 if(!candidate)return ""
 return candidate.replace(/^(?:Them|Interviewer|question):\s*/i,"").slice(0,240)
}
export function rediscoverRelevance(question:string,history=""):RelevanceRecovery{
 const currentAsk=coreQuestion(question)
 const intent=interviewIntent(currentAsk)
 const prior=latestSubject(history)
 const isElliptical=intent==="follow-up" && elliptical.test(currentAsk) && !!prior
 // No generic resume/JD keyword expansion. A named term is in the current
 // question only when explicitly there, never lifted from a historical answer.
 const requestedTopics=[...new Set([
  ...TOPICS.filter(([,re])=>re.test(currentAsk)).map(([name])=>name),
  ...namedQuestionTerms(currentAsk),
 ])]
 const noNewStory=["definition","comparison","acknowledgement","closing-question","logistics","value"].includes(intent)
 const evidencePolicy:RelevanceRecovery["evidencePolicy"]=intent==="experience-story"||intent==="introduction"||intent==="value"
  ?"source-supported-history":intent==="scenario"?"hypothetical-only":"no-personal-story"
 const answerMode:RelevanceRecovery["answerMode"]=
  intent==="closing-question"?"ask":
  intent==="acknowledgement"||intent==="logistics"?"confirm":
  intent==="comparison"?"compare":
  intent==="technical-process"||intent==="definition"?"explain":
  intent==="scenario"?"decide":
  intent==="experience-story"?"demonstrate":"describe"
 const excludedMoves=[
   "Do not answer an adjacent question merely because its keywords match the resume or JD.",
   "Do not introduce a technical name to sound expert; use it only to answer this specific request.",
   ...(noNewStory?["Do not import a generated project, technical bottleneck, metric, incident or detailed stack into this answer."]:[]),
   ...(intent==="closing-question"?["Do not answer the question on behalf of the interviewer; ask them one or two relevant questions."]:[]),
   ...(intent==="acknowledgement"?["The speaker is giving information, not demanding an architecture proposal. Acknowledge briefly, do not invent a task."]:[]),
   ...(intent==="experience-story"?["Do not turn a general role description into a fabricated one-time personal incident."]:[]),
 ]
 return {
  currentAsk,intent,requestedTopics,answerMode,
  contextSubject:isElliptical?prior:"",
  contextRelation:isElliptical?"follow-up":"none",
  excludedMoves,evidencePolicy,
 }
}
export function relevanceRecoveryPrompt(question:string,history=""):string{
 const c=rediscoverRelevance(question,history)
 return [
  "RELEVANCE RE-DISCOVERY — source of truth is the latest interviewer ask:",
  "Current ask: "+c.currentAsk,
  "Intent: "+c.intent+". Response action: "+c.answerMode+".",
  c.requestedTopics.length?"Explicitly requested subjects: "+c.requestedTopics.join("; "):"No listed technical terms are mandatory; answer the plain meaning.",
  c.contextRelation==="follow-up"?"Recover ONLY this prior subject for an elliptical follow-up: "+c.contextSubject:"Treat prior context as background, not a second question.",
  "Personal evidence rule: "+c.evidencePolicy+".",
  ...c.excludedMoves,
  "Before speaking, internally check: Does sentence one answer the current request? Do all explicitly named subparts have a sensible answer? Does each later sentence explain the same thing or supply necessary evidence? Drop anything else.",
  "Return only the natural first-person spoken answer, not this analysis, questions, tags or a list."
 ].join("\n")
}
