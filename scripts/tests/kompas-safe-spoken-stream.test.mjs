import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  answerStreamPolicy, releaseProvisionalDelta,
  mustEmitFinalReplacement, candidateEvidenceForVerification,
} from '../../src/lib/kompasStreamIntegrity.ts'
import { verifyAnswer } from '../../src/lib/kompasGuards.ts'

const scenarios = [
  [0, 'Tell me about yourself.', 'guarded-final'],
  [0, 'Introduction', 'guarded-final'],
  [1, 'Tell me about a time you challenged the technical team.', 'guarded-final'],
  [1, 'Describe a difficult security control issue you owned.', 'guarded-final'],
  [1, 'Tell me how you approached a conflict.', 'guarded-final'],
  [3, 'What happened after that?', 'guarded-final'],
  [3, 'How did you verify that?', 'guarded-final'],
  [4, 'Have you worked with NIST CSF?', 'guarded-final'],
  [4, 'Which framework do you use most in your work?', 'guarded-final'],
  [4, 'What clients have you worked with?', 'guarded-final'],
  [2, 'What did you personally achieve in that project?', 'guarded-final'],
  [2, 'What would you bring to our team?', 'guarded-final'],
  [2, 'What would you bring to BNY?', 'guarded-final'],
  [2, 'Tell me about your biggest achievement.', 'guarded-final'],
  [2, 'What is NIST CSF?', 'progressive'],
  [2, 'Explain the difference between CRI and NIST.', 'progressive'],
  [2, 'How would you validate a remediation plan?', 'progressive'],
  [2, 'Explain an IAM policy exception.', 'progressive'],
  [2, 'Describe how Kerberos authentication works.', 'progressive'],
  [2, 'How does DNS resolution work?', 'progressive'],
  [2, 'Compare impact, likelihood, and residual risk.', 'progressive'],
]
for(let n=1;n<=scenarios.length;n++){
 test('safe spoken streaming cumulative round '+n+' / 21',()=>{
  for(const [tier,q,want] of scenarios.slice(0,n)){
    // Speed r6: the held set is unchanged; with sentence streaming off it is exactly guarded-final, and on (default) the
    // same set is guarded-sentence, which never releases a raw delta and always ends in the final replacement.
    const got=answerStreamPolicy(tier,q,{sentenceStream:false})
    const on=answerStreamPolicy(tier,q)
    assert.equal(on,want==='progressive'?'progressive':'guarded-sentence',q)
    assert.equal(releaseProvisionalDelta(on),want==='progressive',q)
    assert.equal(mustEmitFinalReplacement(on,'Same answer','Same answer'),want!=='progressive',q)
    assert.equal(got,want,q)
    assert.equal(releaseProvisionalDelta(got),want==='progressive',q)
    assert.equal(mustEmitFinalReplacement(got,'Same answer','Same answer'),want==='guarded-final',q)
    assert.equal(mustEmitFinalReplacement(got,'Clean','Raw'),true,q)
  }
 })
}
test('fact checking accepts only candidate-owned original evidence, not the interviewer or JD',()=>{
 const only=candidateEvidenceForVerification('At Citi I reviewed access controls.','')
 assert.match(only,/RESUME:/)
 assert.doesNotMatch(only,/JOB DESCRIPTION|BACKGROUND/)
 assert.equal(candidateEvidenceForVerification('',''),'')
 assert.match(candidateEvidenceForVerification('', 'Original access review evidence.'),/ORIGINAL SOURCE DOCUMENTS:/)
})
test('optional verification preserves spoken paragraph, does not create bullets',async()=>{
 const source=candidateEvidenceForVerification('I reviewed identity access controls.', '')
 const output=await verifyAnswer(async()=>JSON.stringify({lines:[{i:1,invented:[{span:'at InventedBank',plain:'in financial services'}]}]}),
  source,'I worked at InventedBank and reviewed identity access controls.')
 assert.ok(output)
 assert.equal(output.fixed,1)
 assert.equal(output.text,'I worked in financial services and reviewed identity access controls.')
 assert.doesNotMatch(output.text,/^[-•]/)
})
test('optional verifier preserves original bullet style when it existed',async()=>{
 const output=await verifyAnswer(async()=>JSON.stringify({lines:[{i:2,invented:[{span:'15%',plain:'a measurable amount'}]}]}),
  'RESUME: security risk reviews','- Access reviews\nWe reduced exposure by 15%.')
 assert.ok(output)
 assert.equal(output.text,'- Access reviews\nWe reduced exposure by a measurable amount.')
})
test('verifier source contract challenges fabricated one-time events without censoring general technique explanations',()=>{
 const source=readFileSync(new URL('../../src/lib/kompasGuards.ts',import.meta.url),'utf8')
 assert.match(source,/specific claimed incidents or projects/)
 assert.match(source,/A listed skill or responsibility is NOT evidence/)
 assert.match(source,/Do NOT change explicitly hypothetical examples/)
})
test('verifier makes no structural edits when no claim is flagged',async()=>{
 const output=await verifyAnswer(async()=>JSON.stringify({lines:[]}),
 'RESUME: worked in cybersecurity','I check owner evidence. I review the control gap.')
 assert.deepEqual(output,{text:null,fixed:0})
})
test('shared answer service never emits personal model deltas before final guards',()=>{
 const service=readFileSync(new URL('../../src/lib/kompasAnswerService.ts',import.meta.url),'utf8')
 assert.match(service,/if \(releaseProvisionalDelta\(job\.streamPolicy\)\)\s*\{[\s\S]{0,240}emit\(\{ type: "delta", text: d \}\)/)
 assert.match(service,/mustEmitFinalReplacement\(job\.streamPolicy, finalText, raw\)/)
 assert.match(service,/streamPolicy: answerStreamPolicy\(tier, question\)/)
 assert.match(service,/streamPolicy: job\.streamPolicy/)
 assert.match(service,/visible_first_ms/)
 assert.match(service,/if \(!timing\.visible_first_ms && finalText\)/)
})
test('interviewer-suggested achievements are not automatically whitelisted as personal metrics',()=>{
 const service=readFileSync(new URL('../../src/lib/kompasAnswerService.ts',import.meta.url),'utf8')
 // Speed r6: the list is built once per content in kompasSessionCache from the same two inputs, never the question.
 assert.match(service,/const \{ guardFacts, allowed \} = sessionFacts\(resumeSrc, docsSrc\)/)
 const cache=readFileSync(new URL('../../src/lib/kompasSessionCache.ts',import.meta.url),'utf8')
 assert.match(cache,/allowed: allowedNumbers\(resume, documents\)/)
 assert.doesNotMatch(service,/allowedNumbers\([^)]*question/)
 assert.doesNotMatch(service,/allowedNumbers\(resumeSrc, docsSrc, question\)/)
})
test('the candidate fact-check evidence excludes unverified JD and generated dossier background',()=>{
 const service=readFileSync(new URL('../../src/lib/kompasAnswerService.ts',import.meta.url),'utf8')
 assert.match(service,/const factsText = candidateEvidenceForVerification\(resumeSrc, docsSrc\)/)
 assert.doesNotMatch(service,/jdSrc && `JOB DESCRIPTION:\\n/)
 assert.doesNotMatch(service,/grounding && `BACKGROUND:\\n/)
})
