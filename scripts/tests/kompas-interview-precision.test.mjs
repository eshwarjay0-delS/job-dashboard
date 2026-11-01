import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
const require=createRequire(import.meta.url)
const ts=require('typescript')
const source=readFileSync(new URL('../../src/lib/kompasInterviewPrecision.ts',import.meta.url),'utf8')
const narrationSource=readFileSync(new URL('../../src/lib/kompasNaturalNarration.ts',import.meta.url),'utf8')
const compilerOptions={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
const narration={exports:{}}
// Load the actual narration implementation, not a mock; the precision test
// isolates CommonJS modules inside a VM and must explicitly resolve this import.
runInNewContext(ts.transpileModule(narrationSource,{compilerOptions}).outputText,
  {module:narration,exports:narration.exports,console})
const mod={exports:{}}
runInNewContext(ts.transpileModule(source,{compilerOptions}).outputText,{
 module:mod,exports:mod.exports,console,
 require:(id)=> {
  if(id==='./kompasNaturalNarration.ts')return narration.exports
  throw Error('Unexpected precision dependency '+id)
 },
})
const {questionParts,missingQuestionParts,questionCoverage,precisionPrompt,spokenQualityFlags,latestInterviewerAsk,correctVerifiedPresentationErrors}=mod.exports

const cases=[
 ['business impact and cause plus controls and residual risk','How do you assess business impact, root cause, compensating controls and residual risk?','I check business impact, establish the root cause from evidence, verify compensating controls and assess residual risk.','I use ServiceNow.',['business-impact','root-cause','compensating-controls','residual-risk']],
 ['policy distinction','Are you familiar with policy deviations and policy exceptions?','A policy deviation is a requirement gap; an exception is a formally approved temporary departure.','An exception is documented.',['policy-deviation','policy-exception']],
 ['framework preference','Which are you stronger with, NIST CSF or CRI Cyber Profile?','I am more familiar with NIST CSF from control mapping and have also supported CRI Profile assessments.','I am familiar with NIST CSF.',['nist-csf','cri-profile']],
 ['NIST mapping experience','Did you perform control mapping with NIST CSF and NIST 800-53?','I used NIST CSF to group findings and NIST 800-53 for detailed control review.','I used NIST CSF.',['nist-csf','nist-800-53']],
 ['challenging remediation evidence','Tell me about a time you challenged a weak remediation plan. What evidence did you check?','I challenged the remediation using entitlement records and access certification evidence.','I support risk reporting.',['remediation-plan','challenge','evidence']],
 ['remaining exposure','What residual risk would remain after the fix?','I assess the remaining risk after verifying what controls actually work.','We closed the ticket.',['residual-risk']],
 ['interim protection','What compensating controls would you consider?','I would evaluate interim safeguards such as restricted access and monitoring.','I would speak to management.',['compensating-controls']],
 ['business-critical assessment','How do you assess business impact?','I check which critical business operations and customers would be affected.','I review technical alerts only.',['business-impact']],
 ['root cause diagnosis','How do you assess the root cause?','I compare the evidence to establish the underlying cause, not just the symptom.','I update the ticket.',['root-cause']],
 ['evidence-based validity','How can you verify whether the information is valid?','I independently reconcile the source records before agreeing it is valid.','I trust the owner.',['risk-validation']],
 ['NLA technical definition','What is NLA and why disable NLA?','NLA is Network Level Authentication, and it should normally remain enabled.','We disable RDP sometimes.',['nla']],
 ['ServiceNow issue records','How do you track risks in ServiceNow?','I keep the owner, status, dates and supporting evidence in ServiceNow.','I use a ticketing system.',['servicenow']],
 ['IAM and vulnerability management','How are IAM and vulnerability management controls different?','IAM is about access governance; vulnerability management is about exposure and patching.','Both are important.',['iam','vulnerability-management']],
 ['incident and data protection','What about incident response and information protection controls?','I have supported incident response investigations and information protection reviews.','I worked in security.',['incident-response','information-protection']],
 ['career breadth','Tell me about your current experience and past experience.','Currently at Citi, I review control issues. Previously at CVS Health, I worked on risk records.','My background is broad.',['current-experience','past-experience']],
 ['remediation alternative','How do you challenge the remediation strategy?','I ask whether the proposed remediation addresses the real weakness.','I track the dates.',['remediation-plan','challenge']],
 ['closure evidence','Which supporting evidence would you require to close it?','I check the entitlement extracts and audit logs as supporting evidence.','I trust the status.',['evidence']],
 ['early ownership','What would you do in your first 90 days?','In the first 90 days I would learn the controls, take ownership of submissions and independently review issues.','I would learn quickly.',['first-90-days']],
 ['role fit without keyword stuffing','What makes you a good fit for a cyber risk analyst? We also oversee IAM, incident response and information protection.','My technical security background helps me challenge control-owner remediation and understand business risk.','I list every technology. ',[]],
 ['closing question is not a skills dump','Across 27 control areas we cover IAM and vulnerability management. What questions do you have for me?','Which control area is the biggest remediation challenge today, and what would you expect by day 90?','I know IAM and vulnerability management.',[]],
]
for(let n=1;n<=cases.length;n++)test('Kompas precise spoken regression fold '+String(n).padStart(2,'0')+' / 20',()=>{
 for(const [label,q,good,bad,ids] of cases.slice(0,n)){
  assert.deepEqual(Array.from(questionParts(q),p=>p.id).sort(),[...ids].sort(),label+' part extraction')
  assert.deepEqual(Array.from(missingQuestionParts(q,good)),[],label+' good answer')
  if(ids.length)assert.ok(missingQuestionParts(q,bad).length>0,label+' incomplete answer')
  assert.equal(questionCoverage(q,good).percent,100)
  assert.match(precisionPrompt(q),/SPOKEN PRECISION/)
 }
})
test('new ask is isolated from prior speech but compound question is retained',()=>{
 assert.equal(latestInterviewerAsk('Not blindly present in everything. Are you familiar with policy deviations?'),'Are you familiar with policy deviations?')
 assert.equal(latestInterviewerAsk('Moving to the next question, what is NLA?'),'what is NLA?')
 assert.equal(latestInterviewerAsk('How do you assess the business impact? How do you understand root cause?'),'How do you assess the business impact? How do you understand root cause?')
 assert.equal(latestInterviewerAsk('Have you configured CyberArk? What is least privilege?'),'Have you configured CyberArk? What is least privilege?')
 assert.equal(latestInterviewerAsk('A permission fix passes unit tests but fails for one tenant. How would you diagnose it?'),'A permission fix passes unit tests but fails for one tenant. How would you diagnose it?')
})
test('wrong framework count is corrected and pseudo risk formula is removed',()=>{
 assert.match(correctVerifiedPresentationErrors('NIST CSF 2.0 has five functions.'),/six functions/)
 assert.doesNotMatch(correctVerifiedPresentationErrors('I calculate it applying the 800-53 residual-risk factor.'),/residual-risk factor/)
 assert.match(correctVerifiedPresentationErrors('I calculate it applying the 800-53 residual-risk factor.'),/exposure remains/)
})
test('spoken stage markers and faux emphasis are stripped',()=>{
 assert.equal(correctVerifiedPresentationErrors('I checked __ownership__ [beat] and **access**.'),'I checked ownership and access.')
 assert.ok(spokenQualityFlags('NIST CSF 2.0','NIST CSF 2.0 has five functions.').includes('incorrect-csf-functions'))
 assert.ok(spokenQualityFlags('What makes you a good fit?','I will summarize my experience.').includes('meta-opening'))
})
test('service uses precision contract and does not pass prior speech into the current answer prompt',()=>{
 const s=readFileSync(new URL('../../src/lib/kompasAnswerService.ts',import.meta.url),'utf8')
 assert.match(s,/precisionPrompt\(question\)/)
 assert.match(s,/latestInterviewerAsk\(questionForAnswer\(/)
 assert.match(s,/questionCoverage\(job\.question, finalText\)/)
 assert.doesNotMatch(s,/JUST SAID \(a constraint here may matter/)
})
test('Director owner is never automatically forced by structural repair',()=>{
 const a=readFileSync(new URL('../../src/lib/kompasAnswer.ts',import.meta.url),'utf8')
 const rule=a.slice(a.indexOf('export function missingStructure'),a.indexOf('export const STRUCTURE_REPAIR_SYSTEM'))
 assert.doesNotMatch(rule,/decision owner named in sentence one/)
 assert.match(a,/Name a decision owner only if the interviewer asks/)
})
