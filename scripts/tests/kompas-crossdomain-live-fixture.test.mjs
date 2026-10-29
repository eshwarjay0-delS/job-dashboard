import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fixtureName,caseInput } from "../lib/evaluation-fixtures.mjs"
const cases=JSON.parse(readFileSync(new URL("../fixtures/kompas-evaluation/crossdomain-50.json",import.meta.url),"utf8"))
test("Authenticated evaluation runner supports fifty distinct cross-domain questions",()=>{
 assert.equal(fixtureName("crossdomain-50"),"crossdomain-50")
 assert.equal(cases.length,50)
 assert.equal(new Set(cases.map(c=>c.question.toLowerCase())).size,50)
 assert.ok(new Set(cases.map(c=>c.criteria.domain)).size>=9)
 assert.ok(cases.some(c=>c.category==="follow-up"))
 for(const level of ["engineer","architect","director"])assert.ok(cases.some(c=>c.level===level))
})
test("Each case requires an explicitly provided approved source; no cross-role source leaks",()=>{
 for(const c of cases){
  const approved={resume:"Synthetic resume",jd:"Synthetic role description"}
  if(c.category==="follow-up")approved.history=[{q:"Reviewed earlier question",a:"Reviewed earlier answer"}]
  assert.throws(()=>caseInput(c,{},"crossdomain-50"),/Missing approved resume\/JD bundle/)
  const result=caseInput(c,{[c.id]:approved},"crossdomain-50")
  assert.equal(result.key,c.id)
  assert.equal(result.config.resume,"Synthetic resume")
  assert.equal(result.config.jd,"Synthetic role description")
  assert.equal(result.historyMode,c.category==="follow-up"?"reviewed":"isolated")
  assert.equal(result.history.length,c.category==="follow-up"?1:0)
 }
})
test("Follow-ups fail closed without reviewed history; ordinary cases reject history leakage",()=>{
 const follow=cases.find(c=>c.category==="follow-up")
 const regular=cases.find(c=>c.category==="isolated")
 assert.throws(()=>caseInput(follow,{[follow.id]:{resume:"Synthetic",jd:"Synthetic"}},"crossdomain-50"),/Missing explicit reviewed history/)
 assert.throws(()=>caseInput(regular,{[regular.id]:{resume:"Synthetic",jd:"Synthetic",history:[{q:"Private earlier turn",a:"Untrusted text"}]}},"crossdomain-50"),/must not include prior history/)
})
