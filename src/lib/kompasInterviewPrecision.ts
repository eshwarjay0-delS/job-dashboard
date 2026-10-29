/**
 * Interview answer precision. Topic coverage is a prompt/check signal, never
 * evidence that a model claim happened in the candidate's real career.
 */
export type QuestionPart = { id: string; label: string; matches: RegExp }
const PARTS: Array<{id:string;label:string;asked:RegExp;answered:RegExp}> = [
 {id:'business-impact',label:'business impact',asked:/\b(?:business impact|impact (?:on|to|for) (?:the )?business|financial impact)\b/i,answered:/\b(?:business impact|business[- ]critical|critical business|business operations|financial (?:impact|loss|exposure)|customer (?:impact|data)|asset criticality|transaction processing|affected (?:business|service|customers?)|business services? (?:are |is )?(?:affected|impacted)|business (?:systems|functions) (?:are |is )?(?:affected|impacted))\b/i},
 {id:'root-cause',label:'root cause',asked:/\b(?:root[ -]?cause|underlying cause|why (?:the |this )?(?:control|issue|gap) (?:failed|happened|broke))\b/i,answered:/\b(?:root[ -]?cause|underlying (?:failure|cause|problem)|why (?:it|the control|this) (?:failed|happened|broke)|failure (?:came|happened|occurred) (?:from|because)|caused by)\b/i},
 {id:'compensating-controls',label:'compensating controls',asked:/\b(?:compensating (?:controls?|measures?)|interim (?:controls?|safeguards?)|temporary (?:controls?|safeguards?))\b/i,answered:/\b(?:compensating (?:controls?|measures?)|interim (?:controls?|safeguards?)|temporary (?:controls?|safeguards?)|additional (?:monitoring|restrictions|review)|short[- ]term (?:protection|controls?))\b/i},
 {id:'residual-risk',label:'residual risk',asked:/\b(?:residual risk|remaining (?:risk|exposure)|risk (?:that )?remains)\b/i,answered:/\b(?:residual risk|remaining (?:risk|exposure)|risk (?:that )?remains|exposure (?:that )?remains|still exposed|what remains exposed|leftover risk)\b/i},
 {id:'risk-validation',label:'validate the assessment',asked:/\b(?:how (?:do|would|did|can) you (?:assess whether|validate|verify|confirm)|whether (?:or not )?(?:it|that|the information|the assessment|the finding) is valid|independent(?:ly)? (?:validate|verify)|fabricat(?:ed|ing|ion)|minimi[sz](?:e|ing) risk|is (?:it|that) (?:real|valid|accurate))\b/i,answered:/\b(?:independent|source (?:evidence|records)|cross[- ]check|reconcil(?:e|ed|ing)|validate|verify|evidence|logs|records|proof|corroborat|not (?:just|simply) (?:accept|trust)|challenge)\b/i},
 {id:'remediation-plan',label:'remediation plan',asked:/\b(?:remediation (?:plan|strategy|approach)|corrective[- ]action plan|proposed fix|weak (?:plan|remediation))\b/i,answered:/\b(?:remediation|corrective actions?|permanent fix|proposed (?:plan|fix|solution)|action plan|underlying (?:issue|weakness)|long[- ]term (?:fix|change))\b/i},
 {id:'challenge',label:'how you challenged the team',asked:/\b(?:challeng(?:e|ed|ing)|disagree(?:d|ment)?|push(?:ed)? back|weak remediation plan)\b/i,answered:/\b(?:challeng(?:e|ed|ing)|push(?:ed)? back|question(?:ed)?|disagree(?:d)?|explained (?:the )?(?:gap|concern)|ask(?:ed|s)? (?:the|them|whether|why|how)|question(?:ed)? (?:whether|why|how)|pointed out|not (?:accept|approve)|raised (?:the )?concern)\b/i},
 {id:'evidence',label:'supporting evidence or validation',asked:/\b(?:evidence|proof|supporting (?:records|data))\w*/i,answered:/\b(?:evidence|verify|validat|proof|confirm|records|logs|reports|extracts?|data|reconcil|cross[- ]check|audit trail|documented)\w*/i},
 {id:'policy-deviation',label:'policy deviation',asked:/\bpolicy deviations?\b/i,answered:/\b(?:policy )?deviations?\b|\bnot (?:meeting|following|complying with) (?:the )?(?:required )?policy\b/i},
 {id:'policy-exception',label:'policy exception',asked:/\bpolicy exceptions?\b/i,answered:/\b(?:policy )?exceptions?\b|\bformally approved (?:departure|override)\b/i},
 {id:'nist-csf',label:'NIST CSF',asked:/\b(?:NIST\s*)?(?:CSF|cybersecurity framework)\b/i,answered:/\b(?:NIST\s*)?(?:CSF|cybersecurity framework)\b/i},
 {id:'nist-800-53',label:'NIST 800-53',asked:/\b(?:NIST\s*(?:SP\s*)?)?800[-‐‑–— ]53\b/i,answered:/\b(?:NIST\s*(?:SP\s*)?)?800[-‐‑–— ]53\b/i},
 {id:'cri-profile',label:'CRI Profile',asked:/\b(?:CRI|Cyber Risk Institute)(?:\s+(?:Cyber\s+)?Profile)?\b/i,answered:/\b(?:CRI|Cyber Risk Institute)(?:\s+(?:Cyber\s+)?Profile)?\b/i},
 {id:'nla',label:'NLA',asked:/\b(?:NLA|Network Level Authentication)\b/i,answered:/\b(?:NLA|Network Level Authentication)\b/i},
 {id:'servicenow',label:'ServiceNow',asked:/\bServiceNow\b/i,answered:/\bServiceNow\b/i},
 {id:'iam',label:'IAM',asked:/\b(?:IAM|identity (?:and )?access management)\b/i,answered:/\b(?:IAM|identity (?:and )?access management|access (?:reviews?|governance|permissions?))\b/i},
 {id:'vulnerability-management',label:'vulnerability management',asked:/\bvulnerabilit(?:y|ies) management\b/i,answered:/\b(?:vulnerabilit(?:y|ies|ies)|patch(?:ing|es)|exposure(?:s)?)\b/i},
 {id:'incident-response',label:'incident response',asked:/\bincident response\b/i,answered:/\b(?:incident response|incident handling|security incident|triage|containment)\b/i},
 {id:'information-protection',label:'information protection',asked:/\binformation protection\b/i,answered:/\b(?:information protection|data protection|sensitive data|data loss prevention|DLP)\b/i},
 {id:'current-experience',label:'current experience',asked:/\b(?:current experience|current role|what (?:do|are) you (?:do|doing) (?:right )?now|your (?:current |recent )?work)\b/i,answered:/\b(?:currently|at (?:Citi|my current|the bank)|present role|recent work|my current (?:work|role)|these days)\b/i},
 {id:'past-experience',label:'past experience',asked:/\b(?:past experience|previous experience|earlier experience|before (?:Citi|your current role))\b/i,answered:/\b(?:previously|before (?:that|Citi)|earlier|at (?:CVS|the City|Charter|Accenture)|prior role)\b/i},
 {id:'first-90-days',label:'first 60–90 days',asked:/\b(?:first|within)\s+(?:60\s*(?:to|[-–])\s*90|90)\s+days\b/i,answered:/\b(?:90 days|first (?:few )?months|by (?:the )?third month|60\s*(?:to|[-–])\s*90|independent ownership)\b/i},
]
export function questionParts(question: string): QuestionPart[] {
 const q=String(question||'')
 // A broad personal/career ask is not a request to recite every tool in the interviewer's setup.
 if(/\b(?:tell me about yourself|introduce yourself|what makes you (?:a )?(?:good|strong) fit|why (?:are|would) you (?:a )?(?:good|strong) fit|what questions do you have|any questions (?:for|from) me|what (?:can|would) you bring to)\b/i.test(q)) return []
 return PARTS.filter(p=>p.asked.test(q)).map(({id,label,answered})=>({id,label,matches:answered}))
}
export function missingQuestionParts(question:string,answer:string):string[] {
 return questionParts(question).filter(p=>!p.matches.test(String(answer||''))).map(p=>p.label)
}
export function questionCoverage(question:string,answer:string):{covered:number;total:number;missing:string[];percent:number} {
 const all=questionParts(question),missing=all.filter(p=>!p.matches.test(String(answer||''))).map(p=>p.label)
 return {covered:all.length-missing.length,total:all.length,missing,percent:all.length?Math.round(100*(all.length-missing.length)/all.length):100}
}
export function precisionPrompt(question:string):string {
 const parts=questionParts(question),q=String(question||'')
 const explicit=parts.length?'EXACT TOPICS THE INTERVIEWER NAMED: '+parts.map(p=>p.label).join('; ')+'. Address every one with a relevant, defensible point. A clear synonym is fine; do not repeat the words as a checklist.':''
 const comparison=/\b(?:which|more proficient|stronger|prefer|versus|vs\.?|compared? (?:to|with)|difference)\b/i.test(q)
 const story=/\b(?:tell me about a time|give me an example|when (?:did|have) you|challeng(?:ed|ing) (?:the |a )?(?:technical|cyber|control|remediation)|what did you do)\b/i.test(q)
 const short=/\b(?:what is|define|what does|stands? for)\b/i.test(q)&&q.trim().split(/\s+/).length<14
 const closing=/\b(?:what questions do you have|any questions (?:for|from) me)\b/i.test(q)
 return [
  'SPOKEN PRECISION: Answer the latest actual question in sentence one. Preserve each named concept the question actually asks about, not its long setup. Do not stuff unrelated keywords or switch to a nearby story. One natural paragraph unless requested otherwise. Short direct asks get short answers.',
  explicit,
  comparison?'COMPARISON/PREFERENCE: say which in sentence one, then one difference and an honest example. No invented framework tier or numerical result.':'',
  story?'PERSONAL EXPERIENCE: use a source-supported employer and work area. Explain the actual weakness, evidence reviewed, your specific challenge or decision and the verification. Do not upgrade resume duties into a fabricated incident, meeting or measured outcome.':'',
  short?'BRIEF DEFINITION: meaning, purpose and any exception asked for. No unsolicited runbook, fictional project or policy approval.':'',
  closing?'CLOSING QUESTION: ask one or two pointed questions about this team, priorities, ownership and success criteria. Do not make a sales pitch.':'',
  'TRUTHFUL DETAIL: Personal claims and numbers need original resume/document evidence, not the job description, transcript or earlier generated answer. A control owner provides analysis; the risk reviewer independently checks its sufficiency. If an incident detail is not established, describe the real duty and explain the mechanism conditionally.',
  'NATURAL DELIVERY: connected first-person sentences, normal spoken words and specific evidence. No [beat], [breath], Markdown, announcing what you will summarize, fake CISO ownership or unasked KPI list.'
 ].filter(Boolean).join('\n')
}
export function spokenQualityFlags(question:string,answer:string):string[] {
 const text=String(answer||''),flags=missingQuestionParts(question,text).map(p=>'missing:'+p)
 if(/\[(?:beat|breath|pause)\]|\(pause\)|__[^_]+__|\*\*[^*]+\*\*/i.test(text))flags.push('spoken-markup')
 if(/^\s*(?:I (?:will|am going to) (?:summari[sz]e|answer|explain)|the answer (?:is|would be))\b/i.test(text))flags.push('meta-opening')
 if(/\b(?:as (?:the |a )?CISO|I (?:forced|ordered) the team)\b/i.test(text))flags.push('unsupported-authority-signal')
 if(/\b(?:NIST\s*)?(?:CSF|Cybersecurity Framework)\s*2\.0\b[^.!?]{0,80}\b(?:five|5) functions\b/i.test(text))flags.push('incorrect-csf-functions')
 if(/\b800[-‐‑–— ]53\b[^.!?]{0,80}\b(?:residual[- ]risk factor|subtract(?:ion|ing)? (?:the )?mitigated)\b/i.test(text))flags.push('unsupported-risk-formula')
 return flags
}


/** Isolate a new interviewer ask from earlier candidate speech or room chatter.
 * Do not discard two genuine parts of the same interview question. */
export function latestInterviewerAsk(input: string): string {
 let text=String(input||'').replace(/\s+/g,' ').trim()
 if(!text)return ''
 const next=/\b(?:moving (?:on )?to|on to|let['’]?s (?:move|go) to) (?:the )?next question(?: is)?[,:.\s]*/gi
 let lastEnd=-1
 for(let m:RegExpExecArray|null;(m=next.exec(text));)lastEnd=next.lastIndex
 if(lastEnd>=0&&lastEnd<text.length)text=text.slice(lastEnd).trim()
 const starter=/^(?:are you familiar with|what (?:is|are|do|would|have)|how (?:do|did|would)|can you|tell me about|give me|which (?:framework|one)|why don['’]?t you)\b/i
 const boundary=/[.!?]\s+(?=(?:are you familiar with|what (?:is|are|do|would|have)|how (?:do|did|would)|can you|tell me about|give me|which (?:framework|one)|why don['’]?t you)\b)/gi
 let split:RegExpExecArray|null
 while((split=boundary.exec(text))){
  const first=text.slice(0,split.index).trim()
  const remainder=text.slice(split.index+split[0].length-(split[0].match(/\s+$/)?.[0].length||0)).trim()
  if(starter.test(remainder)&&!starter.test(first)&&!/\?/.test(first)){text=remainder;break}
 }
 const filler=/^(?:what else (?:did|do) i have\??|i don['’]?t think i (?:have|had) anything else[.!?]?)[\s,;.]*/i
 if(filler.test(text)){
  const rest=text.replace(filler,'').replace(/^i think you did a good job[^.!?]*[.!?]?[\s,;.]*/i,'')
  if(starter.test(rest))text=rest.trim()
 }
 return text
}


/** Conservative, well-established correctness fixes. Not a general hallucination detector. */
export function correctVerifiedPresentationErrors(input:string):string {
 let answer=String(input||'')
 // The CSF 2.0 functions are Govern, Identify, Protect, Detect, Respond and Recover.
 answer=answer.replace(/(\b(?:NIST\s+)?(?:CSF|Cybersecurity Framework)\s*2\.0\b[^.!?]{0,90}?)\b(?:five|5) functions\b/gi,'$1six functions')
 // There is no universal NIST SP 800-53 residual-risk subtraction factor.
 answer=answer.replace(/[^.!?]*\b(?:applying (?:the )?)?(?:NIST\s*(?:SP\s*)?)?800[-‐‑–— ]53 residual[-‐‑–— ]?risk factor\b[^.!?]*[.!?]/gi,
  ' I assess residual risk by checking what exposure remains after the actual controls are tested.')
 answer=answer.replace(/\[(?:beat|breath|pause)\]|\((?:pause|beat|breath)\)/gi,' ')
  .replace(/__([^_\n]{1,70})__/g,'$1').replace(/\*\*([^*\n]{1,100})\*\*/g,'$1')
 return answer.replace(/\s+/g,' ').replace(/\s+([,.;!?])/g,'$1').trim()
}
