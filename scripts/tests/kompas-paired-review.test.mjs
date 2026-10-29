import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile, readFile, stat, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"
import { pairCapturedAnswers, renderPairedMarkdown, runCli } from "../kompas-paired-review.mjs"

const sha="a".repeat(64)
const fixtureBytes=readFileSync(new URL("../fixtures/kompas-evaluation/crossdomain-50.json",import.meta.url))
const fixtureSha=createHash("sha256").update(fixtureBytes).digest("hex")
const fixture=JSON.parse(fixtureBytes.toString("utf8"))
function sample(n=50) {
 const manifest={status:"capture-complete",quality:"unverified",fixture:"crossdomain-50",caseCount:n,capturedCount:n,sourcesSha256:sha,fixtureSha256:fixtureSha,cases:[]}
 const captures=[],responses=[]
 for(let k=1;k<=n;k++) {
  const id="crossdomain-"+String(k).padStart(2,"0")
  const captureId="test-only-capture-"+String(k).padStart(2,"0")
  const question=fixture[k-1].question
  manifest.cases.push({id,captureId,model:"openai/gpt-oss-120b",reviewStatus:"pending"})
  captures.push({id,captureId,question,fixture:"crossdomain-50",
   text:"Kompas example "+k+" based only on the synthetic context.",
   review:{status:"pending"},provenance:{sourcesSha256:sha,fixtureSha256:fixtureSha},
   meta:{provider:"openrouter",model:"openai/gpt-oss-120b"}})
  responses.push({id,question,text:"Independent reference "+k+" using the synthetic context.",model:"gpt-6"})
 }
 return {captures,manifest,reference:{sourcesSha256:sha,fixtureSha256:fixtureSha,responses}}
}
test("Fifty independent captured pairs produce an UNVERIFIED comparison without invented scores",()=>{
 const {captures,manifest,reference}=sample()
 const report=pairCapturedAnswers(captures,manifest,reference)
 assert.equal(report.count,50)
 assert.equal(report.quality,"unverified")
 assert.equal(report.reviewedByHuman,0)
 assert.equal(report.pairs[0].question,captures[0].question)
 assert.match(renderPairedMarkdown(report),/NOT VERIFIED \(0\/50\)/)
 assert.match(renderPairedMarkdown(report),/crossdomain-50/)
 assert.doesNotMatch(renderPairedMarkdown(report),/50\/50 (?:passed|accuracy)/i)
})
test("Rejects incomplete, duplicate, mismatched-question or mixed-source paired exports",()=>{
 const base=sample()
 const clone=()=>structuredClone(base)
 {const d=clone();d.reference.responses.pop();assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Incomplete ChatGPT/)}
 {const d=clone();d.captures.pop();assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Incomplete Kompas/)}
 {const d=clone();d.captures[1].id=d.captures[0].id;assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/duplicate id/)}
 {const d=clone();d.reference.responses[0].question="Changed interviewer question";assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Questions differ/)}
 {const d=clone();d.reference.sourcesSha256="b".repeat(64);assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/different/)}
 {const d=clone();d.captures[0].provenance.sourcesSha256="b".repeat(64);assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/fingerprint mismatch/)}
 {const d=clone();d.manifest.cases[0].model="wrong-model";assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Model metadata differs/)}
 {const d=clone();d.captures[0].meta.provider="mock-only";assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/synthetic Kompas provider/)}
 {const d=clone();d.captures[0].status="failed";assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Degraded or failed/)}
 {const d=clone();d.manifest.status="failed";assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/capture-complete/)}
 {const d=clone();d.manifest.quality="passed";assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Unexpected quality/)}
 {const d=clone();d.manifest.fixtureSha256="b".repeat(64);assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Manifest fixture SHA-256/)}
 {const d=clone();d.reference.fixtureSha256="b".repeat(64);assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Reference fixture SHA-256/)}
 {const d=clone();d.captures[0].provenance.fixtureSha256="b".repeat(64);assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/fixture fingerprint mismatch/)}
 {const d=clone();d.captures[0].question="Something unexpected?";d.reference.responses[0].question="Something unexpected?";assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/canonical fixture/)}
 {const d=clone();d.manifest.cases[0].id="crossdomain-999";d.captures[0].id="crossdomain-999";d.reference.responses[0].id="crossdomain-999";assert.throws(()=>pairCapturedAnswers(d.captures,d.manifest,d.reference),/Unrecognized case ID/)}
 
})
test("Markdown is a true row-by-row comparison with escaped pipes and multiline answers",()=>{
 const d=sample()
 d.captures[0].text="A | B\nC"
 const md=renderPairedMarkdown(pairCapturedAnswers(d.captures,d.manifest,d.reference))
 assert.ok(md.includes("A \\| B<br>C"))
 assert.equal(md.split("\n").filter(line=>line.startsWith("| crossdomain-")).length,50)
})
test("CLI writes one private file, refuses overwrite, and refuses repository output",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"kompas-private-pairs-"))
 try{
  const d=sample()
  const f=["captures.json","manifest.json","reference.json"].map(name=>path.join(dir,name))
  for(let i=0;i<3;i++)await writeFile(f[i],JSON.stringify([d.captures,d.manifest,d.reference][i]))
  const dest=path.join(dir,"paired.md")
  const got=await runCli([...f,dest])
  assert.equal(got.paired,50)
  assert.equal(got.quality,"unverified")
  assert.equal(got.structured,path.join(dir,"paired.json"))
  const structured=JSON.parse(await readFile(got.structured,"utf8"))
  assert.equal(structured.pairs.length,50)
  assert.equal(structured.fixtureSha256,fixtureSha)
  assert.equal((await stat(got.structured)).mode&0o777,0o600)
  assert.match(await readFile(dest,"utf8"),/Independent reference 50/)
  assert.equal((await stat(dest)).mode&0o777,0o600)
  await assert.rejects(runCli([...f,dest]),/EEXIST/)
  const repoOutput=path.resolve("private-answers-must-not-be-here.md")
  await assert.rejects(runCli([...f,repoOutput]),/outside the repository/)
 }finally{await rm(dir,{recursive:true,force:true})}
})
