import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mkdtemp,writeFile,readFile,stat,rm } from "node:fs/promises"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import path from "node:path"
import { REVIEW_AXES,scoreReviewedPairs,runCli } from "../kompas-score-review.mjs"

const fixtureBytes=readFileSync(new URL("../fixtures/kompas-evaluation/crossdomain-50.json",import.meta.url))
const fixture=JSON.parse(fixtureBytes.toString("utf8"))
const fixtureSha=createHash("sha256").update(fixtureBytes).digest("hex")
const sourceSha="a".repeat(64)
function sample() {
 const pairs=fixture.map(c=>({
  id:c.id,question:c.question,
  reference:"Reference example for "+c.id+". Safe and grounded explanation.",
  kompas:"Kompas example for "+c.id+". Safe and grounded explanation."
 }))
 const scores=Object.fromEntries(REVIEW_AXES.map(k=>[k,{score:4,reason:"Supported by explicit original answer content for this dimension."}]))
 const review={reviewerId:"human-reviewer-1",reviewedAt:"2026-10-29T12:00:00Z",
  signedOff:true,sourceSha256:sourceSha,fixtureSha256:fixtureSha,
  cases:pairs.map(p=>({id:p.id,question:p.question,domain:"synthetic",
    reference:structuredClone(scores),kompas:structuredClone(scores),hardFailures:[]}))
 }
 return {paired:{quality:"unverified",count:50,fixture:"crossdomain-50",sourceSha256:sourceSha,fixtureSha256:fixtureSha,pairs},review}
}
test("Fifty signed-off, separately reasoned reviews produce metrics without asserting independent provenance",()=>{
 const d=sample(),out=scoreReviewedPairs(d.paired,d.review)
 assert.equal(out.reviewed,50)
 assert.equal(out.status,"all-cases-reviewed")
 assert.equal(out.metrics.kompasRubricPass,50)
 assert.equal(out.metrics.wins,0)
 assert.equal(out.metrics.ties,50)
 assert.match(out.reviewProvenance,/not independently verified/)
 assert.equal(out.rows.length,50)
})
test("Hard factual failure blocks a rubric pass despite perfect numeric ratings",()=>{
 const d=sample()
 d.review.cases[0].hardFailures=[{model:"kompas",type:"fabrication",reason:"Claimed a measured production result absent from the original resume.",quote:"Kompas example"}]
 const out=scoreReviewedPairs(d.paired,d.review)
 assert.equal(out.metrics.kompasHardFailures,1)
 assert.equal(out.metrics.kompasRubricPass,49)
 assert.equal(out.metrics.referenceRubricPass,50)
})
test("Review cannot pass with missing cases, invented evidence, invalid scores or unsigned reviewer",()=>{
 const d=sample(),clone=()=>structuredClone(d)
 {let x=clone();x.review.cases.pop();assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/All fifty unique cases/)}
 {let x=clone();x.review.cases[1].id=x.review.cases[0].id;assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/duplicate case/)}
 {let x=clone();x.review.cases[0].question="Different question";assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/Review question mismatch/)}
 {let x=clone();x.review.cases[0].kompas.technicalCorrectness.score=5;assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/Invalid kompas/)}
 {let x=clone();x.review.cases[0].kompas.technicalCorrectness.reason="";assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/rationale is required/)}
 {let x=clone();x.review.cases[0].kompas.technicalCorrectness.quote="Nonexistent proof";assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/Quoted kompas evidence/)}
 {let x=clone();x.review.cases[0].hardFailures=[{model:"kompas",type:"fabrication",reason:"The sample claims a result not present.",quote:"not in the original"}];assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/Hard failure quote missing/)}
 {let x=clone();x.review.cases[0].hardFailures=[{model:"reference",type:"proficiency",reason:"Not an allowed failure class."}];assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/Invalid hard failure/)}
 {let x=clone();x.review.fixtureSha256="b".repeat(64);assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/digest mismatch/)}
 {let x=clone();x.review.signedOff=false;assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/Signed-off review/)}
 {let x=clone();x.review.cases[0].kompas.extraneous={score:4,reason:"Not a valid score criterion."};assert.throws(()=>scoreReviewedPairs(x.paired,x.review),/dimension count/)}
})
test("CLI saves reviewed scorecard privately with no overwrite",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"kompas-reviewed-scores-"))
 try {
  const d=sample(),p=path.join(dir,"paired.json"),q=path.join(dir,"review.json"),out=path.join(dir,"reviewed.json")
  await writeFile(p,JSON.stringify(d.paired));await writeFile(q,JSON.stringify(d.review))
  const res=await runCli([p,q,out])
  assert.equal(res.reviewed,50)
  const saved=JSON.parse(await readFile(out,"utf8"))
  assert.equal(saved.metrics.kompasAverage,4)
  if(process.platform!=="win32") assert.equal((await stat(out)).mode&0o777,0o600)
  await assert.rejects(runCli([p,q,out]),/EEXIST/)
  await assert.rejects(runCli([p,q,path.resolve("scores-must-not-be-public.json")]),/outside the repository/)
 }finally{await rm(dir,{recursive:true,force:true})}
})
