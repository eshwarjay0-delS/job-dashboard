import test from "node:test"
import assert from "node:assert/strict"
import { naturalAnswerShape, naturalNarrationGuidance, NATURAL_NARRATION_VERSION } from "../../src/lib/kompasNaturalNarration.ts"
import { audienceGuidance } from "../../src/lib/kompasAudience.ts"

const folds = [
  ["identity","Tell me about yourself"],["identity","Walk me through your career"],["identity","Your background"],
  ["experience","Tell me about a time you challenged an IAM control owner"],["experience","Describe a situation when the rollout failed"],["experience","Give me an example from Citi"],
  ["experience","Walk me through an incident you handled"],["experience","Share an example of a difficult stakeholder decision"],
  ["follow-up","What exactly did you configure?"],["follow-up","Which logs did you inspect?"],["follow-up","What happened next?"],
  ["follow-up","How did you verify that?"],["follow-up","Who signed off?"],["follow-up","What artifacts did you create?"],
  ["scenario","How would you investigate a privileged access exception?"],["scenario","Suppose an access review says complete but admins still have access"],
  ["scenario","How do you decide whether to accept residual risk?"],["scenario","What would you monitor after deployment?"],["scenario","If you found a critical issue, what would you do?"],
  ["mechanism","How does Kerberos authentication work?"],["mechanism","Explain how the token validation chain works"],["mechanism","What is the difference between design and operating effectiveness?"],
  ["mechanism","Why does OAuth need a state parameter?"],["mechanism","How do certificates get validated?"],["mechanism","What happens when CyberArk rotation fails?"],
  ["direct","What is NIST CSF 2.0?"],["direct","Define compensating control"],["direct","Have you used ServiceNow?"],["direct","Are you local to Pittsburgh?"],["direct","When could you start?"],
  ["direct","What is IDOR?"],["direct","Compare DAST and SAST"],["direct","How many years of experience do you have?"],["direct","CRI"],
  ["scenario","How would you design a rollback without downtime?"],["scenario","Suppose the bank cannot patch until month-end"],
  ["experience","Tell me about a time a policy exception was rejected"],["experience","Walk me through an issue you found"],
  ["follow-up","How did you prove the root cause?"],["follow-up","Who approved closure?"],
  ["scenario","What would you do if the business owner disputes impact?"],["scenario","How would you challenge a missing control owner?"],
  ["mechanism","How do you reconcile nested groups and effective permissions?"],["mechanism","Why do stale tickets stay open?"],
  ["direct","Do you have any questions for us?"],["direct","Explain MFA"],["direct","What is EPM?"],
  ["scenario","What would you do if the evidence contradicts the ticket?"],["scenario","How would you handle the deployment risk?"],
  ["mechanism","Explain how logging actually proves the control operated"],
] 
test("Natural narration respects every source category and doesn't privilege one BNY question",()=>{
  assert.equal(NATURAL_NARRATION_VERSION,"kompas-workbench-v1")
  assert.equal(folds.length,50)
  for(const [shape,q] of folds){
    assert.equal(naturalAnswerShape(q),shape,q)
    const g=naturalNarrationGuidance(q,"engineer")
    assert.match(g,/WORKBENCH NARRATION OVERRIDE/)
    assert.match(g,/source|candidate evidence|documented/i)
    assert.match(g,/not.*(?:invent|fabricate)|do not fabricate/i)
    assert.match(g,/Do not force analogies/)
    assert.match(g,/AUTH|VOICE|IDENTITY|EXPERIENCE|SCENARIO|MECHANISM|FOLLOW-UP|DIRECT/)
  }
})
test("Narration adapts to the question rather than forcing STAR or an anecdote on definitions",()=>{
  const definition=naturalNarrationGuidance("What is NIST CSF?","engineer")
  assert.match(definition,/No forced STAR episode/)
  const story=naturalNarrationGuidance("Tell me about a time the control broke","engineer")
  assert.match(story,/one actually supported situation/)
  assert.match(story,/STAR is an internal structure/)
  const hypothetical=naturalNarrationGuidance("How would you check the issue?","director")
  assert.match(hypothetical,/I would/)
  assert.match(hypothetical,/testable assumption/)
  const follow=naturalNarrationGuidance("Which logs did you check?","engineer")
  assert.match(follow,/stay in the same project/)
})
test("Engineer, director, architect and mixed audience preserve different evidence priorities",()=>{
  assert.match(naturalNarrationGuidance("What evidence is enough?","director"),/decision authority/)
  assert.match(naturalNarrationGuidance("How would you test the API?","architect"),/system boundary/)
  assert.match(naturalNarrationGuidance("How would you test the API?","engineer"),/observed behavior/)
  assert.match(naturalNarrationGuidance("How would you test the API?","technical_hr"),/less technical listener/)
})
test("Narration is actually passed through the existing shared audience guidance",()=>{
  for(const audience of ["engineer","architect","director","technical_hr"]){
    const g=audienceGuidance(audience,"How would you challenge the root cause?")
    assert.match(g,/WORKBENCH NARRATION OVERRIDE/)
    assert.match(g,/SCENARIO VOICE/)
    assert.ok(g.indexOf("WORKBENCH NARRATION OVERRIDE")>g.indexOf("STORYTELLER:"),
      "Latest workbench override must follow the old forced-image storyteller text")
    assert.match(g,/The first sentence answers the question in plain words/i)
  }
})
test("Naturalness must not pretend a Notebook-style discussion is candidate experience",()=>{
  for(const question of ["What is a compensating control?","Tell me about a time the access review failed","How would you fix it?"]){
    const g=naturalNarrationGuidance(question,"engineer")
    assert.match(g,/prior generated interview answer.*NOT evidence/)
    assert.match(g,/never like two enthusiastic podcast hosts/i)
    assert.match(g,/If the interviewer asks for one fact, answer it and stop/)
  }
})
