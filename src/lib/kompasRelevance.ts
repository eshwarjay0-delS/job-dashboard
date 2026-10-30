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
const EXPERIENCE=/\b(?:tell me about a time|share an example|give me an example of (?:when|a time)|describe a situation|have you ever|how have you|what did you do when|walk me through (?:an|a) (?:[\w-]+\s+){0,6}?(?:issue|incident|project|challenge|failure)(?:\s+you|\s+where|\s+that|\s+when)?|a time (?:you|when you)|walk me through a (?:situation|time) (?:where|when)|(?:tell me about|what (?:is|was)) your (?:biggest|worst|proudest|hardest|greatest) (?:mistake|failure|achievement|success|challenge|win|regret))\b/i
const CLOSING=/\b(?:what questions (?:do|would|might|can) you have|any questions (?:for|from) me|what would you (?:like to )?ask (?:me|us)|anything you(?:'d| would) (?:like|want) to ask|questions about (?:the|this) (?:role|team|company))\b/i
const INTRO=/\b(?:tell me about yourself|introduce yourself|walk (?:me|us) through your (?:career|background)|your professional background|career (?:journey|overview)|self introduction)\b/i
const VALUE=/\b(?:what (?:would|can|do) you bring to|what you can bring|highlight .{0,40}(?:bring|experience)|what (?:can|would) you contribute|why (?:are|would|should) (?:we hire you|you be (?:a )?(?:good|strong) fit)|what makes you (?:a )?(?:good|strong) fit|what sets you apart|highlight (?:for me )?anything|anything (?:else )?(?:i|we) should (?:know|be aware of)|what else should (?:i|we) know|why (?:do|would) you want (?:this|to work)|why (?:bny|this role|our team))\b/i
const LOGISTICS=/\b(?:relocat(?:e|ion)|on.?site|hybrid|notice period|start date|available to start|sponsorship|work authorization|where are you based|where do you live|are you a(?:n| a)? (?:u\.?s\.? )?citizen|(?:u\.?s\.?|united states)\s+citizens?|travel|salary|compensation|clearance|working (?:hours|days))\b/i
const DEFINE=/\b(?:what (?:exactly |precisely )?is|what (?:exactly |precisely )?are|what(?: does|'s| is) .{1,55} mean|define|stands? for|explain (?:the term|what .{1,60} is))\b/i
const COMPARE=/\b(?:which (?:one|framework|tool|approach|option|is)|which of those|which would you (?:choose|pick|prefer|start)|stronger (?:in|with)|more (?:proficient|comfortable|familiar)|difference between|compare|versus|vs[.]?|how do .+ differ|how is .{1,80} different|how\b[^?]{0,110}\bdiffer(?:s|ed)?\b|prefer .+ (?:or|over))\b/i
const SCENARIO=/\b(?:how would you|what would you do|suppose|imagine|if you (?:were|had|found|saw)|hypothetical|in that situation|how should (?:we|the team)|scenario)\b/i
const DEEP=/\b(?:step by step|walk me through|under the hood|exact (?:logs|fields|mechanics|steps|flow)|deep dive|debug|troubleshoot|design|implement|packet|query|architecture|how (?:does|do|did) .+ work|how exactly)\b/i
const ACK=/^\s*(?:yeah|right|okay|ok|great|thanks|thank you|that makes sense|absolutely|so that's|you(?:'ll| will)|we(?:'ll| will)|the team|our team|it's important|i expect|i would expect)\b/i
const FOLLOW=/^\s*(?:and (?:then|how|why|what)|what (?:about|happened)|what did you (?:check|see|do) first|how (?:so|did you verify)|can you (?:expand|elaborate)|(?:go|dig) deeper|go on|tell me more|why is that|why is that important|explain (?:that|this|it)|walk me through (?:that|this|it)|say that again)\b/i
const QUESTION=/\?|^\s*(?:what|why|how|when|where|which|who|tell|describe|explain|give|walk|could|can|would|will|are|is|do|does|have|has|should)\b/i

/** The press phrase, not the quoted earlier question glued on after it. */
function askWithoutPrior(question: string): string {
  const q = String(question || "").trim()
  const lead = q.split(/\s*—\s*following up on\s*:/i)[0].trim()
  return lead || q
}

const BARE_FOLLOW=/^(?:(?:and|so|but|ok(?:ay)?|right|well|then|now|um+|uh+|yeah|yes)[, ]+)*(?:how come|how so|why not|why though|and why|and how|why|how)(?:\s+though)?[.?!]*$/i

export function interviewIntent(question: string): ReplyIntent {
  const q=askWithoutPrior(question)
  if(!q) return "direct"
  // Stress round 2 (29 Oct 2026): "Hi, can you hear me okay?" and "How are you doing today?" were answered as direct
  // questions. A greeting or line check gets a brief acknowledgement, never a work answer.
  if(/^\s*(?:(?:hi|hello|hey|good (?:morning|afternoon|evening))\b[,.!\s]*)?(?:(?:can|could) you hear me(?: okay| ok| alright| well)?|(?:are you|is it) able to hear me|how are you(?: doing)?(?: today)?|how(?:'s| is) (?:it going|your day(?: going)?)|is my (?:audio|mic|video) (?:okay|ok|working))[\s?.!]*$/i.test(q)) return "acknowledgement"
  // "Why?" is glued onto the previous question, then classified as a new direct ask.
  // The prompt then tells the answer to start over. A bare why or how come stays a follow-up.
  if(BARE_FOLLOW.test(q)) return "follow-up"
  // The interviewer marked the earlier words as not the question. The ask is what follows.
  if(/\b(?:any questions|what questions do you have|do you have any questions)\b[^.?!]*\??\s*$/i.test(q) && !INTRO.test(q)) return "closing-question"
  // "How would you explain residual risk to a business owner" asks for the meaning, said so they can use it.
  if(/\bhow would you explain\b/i.test(q)) return "definition"
  // Several named checks in one assess question need the mechanism of each, not a yes/no.
  if(/\bhow (?:do|did|would) you (?:typically )?(?:assess|evaluate|measure|validate|determine)\b/i.test(q)) return "technical-process"
  // Round 13: "how do you know the test is enough … and who signs off" was read as a comparison.
  if(/\b(?:are you familiar with|(?<!\bhow )do you know)\b.+\b(?:and|or|versus|vs\.?)\b/i.test(q)) return "comparison"
  // Interviewers vary the wording across disciplines; route the requested action,
  // not the job-specific vocabulary. These patterns complement the baseline.
  if(/\b(?:any questions for (?:us|the team)|do you have any questions|anything you(?:'d| would) like to ask\??)\b/i.test(q) && !INTRO.test(q)) return "closing-question"
  if(/\b(?:give me (?:a )?(?:(?:quick|brief|short) )?overview of your (?:background|career|experience)|summari[sz]e your (?:background|career|experience)|what(?:'s| is) your background)\b/i.test(q)) return "introduction"
  if(/\b(?:why are you interested in (?:this|the|our) (?:position|job|role|team|company)|how would you contribute to (?:this|the|our|a|an)\b)\b/i.test(q)) return "value"
  if(/\b(?:describe (?:a|an) (?:project|incident|challenge|failure|achievement|situation) (?:you|where|that|when)|walk me through (?:a|an) (?:project|incident|failure|challenge) (?:you|where|that))\b/i.test(q)) return "experience-story"
  if(/\bwhen (?:can|could|would) you start\b/i.test(q)) return "logistics"
  if(/^\s*(?:why was that important|what did you do next|how did you (?:measure|test|check|confirm) (?:that|it|the result))\b/i.test(q)) return "follow-up"
  if(/\b(?:explain how|describe how)\b/i.test(q) && !COMPARE.test(q)) return "technical-process"
  if(CLOSING.test(q) && !INTRO.test(q)) return "closing-question"
  if(INTRO.test(q) || /^(?:(?:big|brief|short|quick|full|personal|detailed|self)\s+)?intro(?:duction)?[.?!]*$/i.test(q)) return "introduction"
  if(VALUE.test(q)) return "value"
  if(EXPERIENCE.test(q)) return "experience-story"
  if(LOGISTICS.test(q) && !/\b(?:how (?:does|do)|why|difference|design|troubleshoot)\b/i.test(q)) return "logistics"
  if(COMPARE.test(q)) return "comparison"
  if(DEFINE.test(q) && !/\bwhat(?:'s| is| are) (?:your|you)\b/i.test(q)) return "definition"
  // Round 6 (29 Oct 2026): "what's the residual risk" was a direct ask while "what is the residual risk" was a definition.
  // A short "what's X" with no "you/your" is the same ask as "what is X".
  if(/^\s*what's\s+(?:an?\s+|the\s+)?(?!your\b|you\b)[a-z0-9][\w\s-]{1,40}\??\s*$/i.test(q) && q.trim().split(/\s+/).length<=7) return "definition"
  if(FOLLOW.test(q) && q.split(/\s+/).length<=12) return "follow-up"
  if(SCENARIO.test(q)) return "scenario"
  if(DEEP.test(q)) return "technical-process"
  // Director statements often trail off with "right?" without asking the
  // candidate a substantive question. Do not introduce a full technical story.
  if(!QUESTION.test(q) && /\b(?:tells you|asks you|disagrees with (?:you|your))\b/i.test(q)) return "scenario"
  // r5 (29 Oct 2026): "You will see X come up a lot. Tell me about Y." was read as a statement and got a line-check reply.
  // A later sentence that opens with an imperative ask (tell, describe, explain, walk, give) is a real ask.
  const laterAsk=/[.!;]\s+(?:so,?\s+)?(?:tell me|describe|explain|walk me|give me)\b/i.test(q)
  const noSubstantiveAsk=!QUESTION.test(q.replace(/\b(?:right|okay|yeah)\s*\?\s*$/i,"")) && !laterAsk
  const words=q.split(/\s+/).filter(Boolean)
  const greeting=/^(?:hi|hello|hey|ok(?:ay)?|thanks|thank you|yeah|yes|no|right|great)[.!]*$/i.test(q)
  const told=ACK.test(q) || /^(?:you will|we\b|i\b|the team|our team|the first)\b/i.test(q)
  if(noSubstantiveAsk && !greeting && !told && words.length>=1 && words.length<=8) return "direct"
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
 // Full self-introductions are career-spanning; do not flatten them just to
 // satisfy the default short-answer ceiling. An explicitly brief intro remains short.
 if(intent==="introduction" && tier===0){
  const brief=/\b(?:brief|briefly|quick|short|30 seconds|half a minute)\b/i.test(question)
  return {intent,minWords:brief?65:240,maxWords:brief?110:250,opening,proof,technicalDepth:"surface"}
 }
 const lead=askWithoutPrior(question)
 const askedDeeper=intent==="follow-up" && /\b(?:go deeper|dig deeper|more detail|elaborate|explain (?:that|this|it))\b/i.test(lead)
 const detailed=askedDeeper || (DEEP.test(question)&&["scenario","technical-process","experience-story","follow-up"].includes(intent)) || (intent==="comparison"&&/\b(?:technically|at the protocol level|under the hood|in detail|how .+ differ|how is .{1,80} different)\b/i.test(question)) || (intent==="definition"&&/\b(?:why|how|disable)\b/i.test(lead)) || intent==="technical-process"
 // Technical depth may grow when specifically requested, not merely because
 // the session is in Director/Engineer mode. Preserve full source-backed intros.
 const adjusted=detailed?max+40:max
 const minWords=tier===0 && ["experience-story","technical-process","scenario"].includes(intent)
  ? Math.min(adjusted,Math.max(min,115)) : min
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
  ...(namedQuestionTerms(question).length ? ["EXACT NAMED CONCEPTS: "+namedQuestionTerms(question).join(", ")+". Address each directly if it is one of the requested subjects; no unrelated resume/technology inventory."] : []),
  "When the question asks for independent challenge, distinguish the control owner's claims from evidence you personally reviewed; do not claim to approve risk on behalf of leadership.",
  "An explanation is not a demonstration of personal history. Only original resume/documents support employers, responsibilities, incidents, achievements or figures.",
  "Spoken length guide: "+p.minWords+"–"+p.maxWords+" words unless user explicitly asks for more. Do not fill space to reach a token or word quota. Stop when the requested parts are complete.",
  "Technical depth: "+p.technicalDepth+". An explicitly requested implementation drill-down may be detailed; a general invitation, a bare definition, a logistics question, or a closing question must stay on the surface.",
  "DEPTH WITH RELEVANCE: Sentence one answers this question. Later sentences add only the mechanism, the reason, or the evidence that sentence needs. A job description does not prove the work. Do not invent a decision owner, a person's name, a metric, a formula, or a title the resume does not hold.",
  p.intent==="definition" ? "Open with what it is. If the question also asks why or how, give that mechanism next, in concrete terms, not a leadership lecture." : "",
  p.intent==="comparison" ? "Name every option in the question. The first sentence is the difference or the one you use more. No unrelated person." : "",
  p.intent==="value" || p.intent==="introduction" ? "Open with the relevant experience. Name a tool only when it shows that fit." : "",
  INTRO.test(question) && CLOSING.test(question) ? "The interviewer also asked what questions you have. After the introduction, ask one specific question about this team." : "",
  p.intent==="experience-story" ? "One supported story: what was weak, what you reviewed, what changed. Do not promote yourself to an authority the resume does not give." : "",
  p.intent==="technical-process" ? "Cover each named part in order, with the check and the failure mode for that part. Do not replace the parts with a formula or a metric." : "",
  p.intent==="follow-up" && p.technicalDepth==="deep" ? "The interviewer asked to go deeper on the same subject. Sentence one adds the mechanism or reason the previous answer did not already give. Do not repeat that answer's opening." : "",
 ].filter(Boolean).join("\n")
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
 return excess.length >= (["closing-question","acknowledgement","logistics","definition"].includes(intent) ? 1 : 2) ? excess : []
}


/**
 * Explicit question nouns: retain exactly named concepts without a general
 * keyword-stuffing requirement. Only concepts actually named by interviewer
 * enter this register; résumé and JD technologies do not.
 */
const NAMED_CONCEPTS: Array<{id:string;ask:RegExp;answer:RegExp}>=[
 {id:"NIST CSF",ask:/\b(?:NIST\s*)?(?:CSF|Cybersecurity Framework)\b/i,answer:/\b(?:NIST\s*)?(?:CSF|Cybersecurity Framework)\b/i},
 {id:"CRI Profile",ask:/\b(?:CRI(?:\s+Profile)?|Cyber Risk Institute(?:\s+Profile)?)\b/i,answer:/\b(?:CRI(?:\s+Profile)?|Cyber Risk Institute(?:\s+Profile)?)\b/i},
 {id:"NIST 800-53",ask:/\b(?:NIST\s*(?:SP\s*)?)?800[-\u2010-\u2015 ]53\b/i,answer:/\b(?:NIST\s*(?:SP\s*)?)?800[-\u2010-\u2015 ]53\b/i},
 {id:"ServiceNow",ask:/\bServiceNow(?:\s+GRC)?\b/i,answer:/\bServiceNow(?:\s+GRC)?\b/i},
 {id:"IAM",ask:/\b(?:IAM|identity (?:and )?access management)\b/i,answer:/\b(?:IAM|identity (?:and )?access management|access governance)\b/i},
 {id:"PAM",ask:/\b(?:PAM|privileged access management)\b/i,answer:/\b(?:PAM|privileged access management|privileged access)\b/i},
 {id:"MFA",ask:/\b(?:MFA|multi.factor authentication)\b/i,answer:/\b(?:MFA|multi.factor authentication|second.factor authentication)\b/i},
 {id:"EDR",ask:/\b(?:EDR|endpoint detection and response)\b/i,answer:/\b(?:EDR|endpoint detection and response|endpoint detection)\b/i},
 {id:"SIEM",ask:/\b(?:SIEM|security information and event management)\b/i,answer:/\b(?:SIEM|security information and event management|centralized security logs)\b/i},
 {id:"TLS",ask:/\b(?:TLS|Transport Layer Security)\b/i,answer:/\b(?:TLS|Transport Layer Security)\b/i},
 {id:"PKI",ask:/\b(?:PKI|Public Key Infrastructure)\b/i,answer:/\b(?:PKI|Public Key Infrastructure|certificate trust)\b/i},
 {id:"DHCP",ask:/\b(?:DHCP|Dynamic Host Configuration Protocol)\b/i,answer:/\b(?:DHCP|Dynamic Host Configuration Protocol|IP address leasing)\b/i},
 {id:"DNS",ask:/\b(?:DNS|Domain Name System)\b/i,answer:/\b(?:DNS|Domain Name System|name resolution)\b/i},
 {id:"Kerberos",ask:/\bKerberos\b/i,answer:/\bKerberos\b/i},
 {id:"NLA",ask:/\b(?:NLA|Network Level Authentication)\b/i,answer:/\b(?:NLA|Network Level Authentication)\b/i},
 {id:"RDP",ask:/\b(?:RDP|Remote Desktop Protocol)\b/i,answer:/\b(?:RDP|Remote Desktop Protocol|Remote Desktop)\b/i},
 {id:"SAML",ask:/\bSAML\b/i,answer:/\bSAML\b/i},
 {id:"OAuth",ask:/\bOAuth(?:\s*2\.0)?\b/i,answer:/\bOAuth(?:\s*2\.0)?\b/i},
 {id:"OIDC",ask:/\b(?:OIDC|OpenID Connect)\b/i,answer:/\b(?:OIDC|OpenID Connect)\b/i},
 {id:"JWT",ask:/\b(?:JWT|JSON Web Token)\b/i,answer:/\b(?:JWT|JSON Web Token)\b/i},
 {id:"CVE",ask:/\bCVE[- ]\d{4}[- ]\d{4,}\b/i,answer:/\bCVE[- ]\d{4}[- ]\d{4,}\b/i},
 {id:"SQL",ask:/\bSQL\b/i,answer:/\bSQL\b/i},
 {id:"XSS",ask:/\b(?:XSS|cross.site scripting)\b/i,answer:/\b(?:XSS|cross.site scripting)\b/i},
 {id:"IDOR",ask:/\b(?:IDOR|insecure direct object references?)\b/i,answer:/\b(?:IDOR|insecure direct object references?)\b/i},
 {id:"Zero Trust",ask:/\bZero[- ]Trust\b/i,answer:/\bZero[- ]Trust\b/i},
 {id:"Azure Policy",ask:/\bAzure Policy\b/i,answer:/\bAzure Policy\b/i},
 {id:"Power BI",ask:/\bPower BI\b/i,answer:/\bPower BI\b/i},
 {id:"CyberArk",ask:/\bCyberArk\b/i,answer:/\bCyberArk\b/i},
 {id:"Qualys",ask:/\bQualys\b/i,answer:/\bQualys\b/i},
 {id:"Splunk",ask:/\bSplunk\b/i,answer:/\bSplunk\b/i},
 {id:"Microsoft Sentinel",ask:/\b(?:Microsoft|Azure) Sentinel\b/i,answer:/\b(?:Microsoft|Azure) Sentinel\b/i},
]
export function namedQuestionTerms(question:string):string[]{
 const q=String(question||'')
 return NAMED_CONCEPTS.filter(t=>t.ask.test(q)).map(t=>t.id)
}
export function missingNamedQuestionTerms(question:string,answer:string):string[]{
 if(["introduction","closing-question","acknowledgement","value","logistics"].includes(interviewIntent(question)))return []
 const q=String(question||''),a=String(answer||'')
 return NAMED_CONCEPTS.filter(t=>t.ask.test(q)&&!t.answer.test(a)).map(t=>t.id)
}
