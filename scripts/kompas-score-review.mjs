/**
 * Tabulate independently entered per-case review scores. This does not call a
 * model and cannot establish that the stated reviewer or provider is genuine.
 * All fifty case records are required; averages are never a substitute for
 * individual failures, especially fabricated claims or unsafe advice.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const REVIEW_AXES = [
  "directRelevance", "explicitCoverage", "factualGrounding", "technicalCorrectness",
  "contextContinuity", "naturalDelivery", "unnecessaryDetail", "audienceDepth",
]
const BAD = new Set(["fabrication","contradiction","unsafe","privacy","wrong-question"])
const check = (valid,message) => { if(!valid) throw Error(message) }
const unique = (rows,label) => {
  check(Array.isArray(rows),label+" must be an array")
  const out=new Map()
  for (const row of rows) {
    check(row && typeof row.id==="string" && row.id.length>0,label+" case id missing")
    check(!out.has(row.id),label+" duplicate case "+row.id)
    out.set(row.id,row)
  }
  return out
}
const isProof = (proof) => typeof proof==="string" && proof.trim().length>=12
function validateScores(scores,text,model,id) {
  check(scores && typeof scores==="object" && !Array.isArray(scores),"Missing "+model+" scores at "+id)
  check(Object.keys(scores).length===REVIEW_AXES.length,"Wrong "+model+" score dimension count at "+id)
  const values=[]
  for (const key of REVIEW_AXES) {
    const item=scores[key]
    check(item && Number.isInteger(item.score) && item.score>=0 && item.score<=4,"Invalid "+model+" "+key+" rating at "+id)
    check(isProof(item.reason), "A concrete "+model+" "+key+" rationale is required at "+id)
    if (item.quote !== undefined && item.quote !== null && item.quote!=="") {
      check(typeof item.quote==="string" && text.includes(item.quote),"Quoted "+model+" evidence does not appear in source answer at "+id)
    }
    values.push(item.score)
  }
  return values.reduce((sum,n)=>sum+n,0)/values.length
}
export function scoreReviewedPairs(paired,review) {
  check(paired?.quality==="unverified" && paired.count===50 && Array.isArray(paired.pairs) && paired.pairs.length===50, "A complete 50-case unverified paired report is required")
  check(review && typeof review.reviewerId==="string" && review.reviewerId.trim().length>=3, "Reviewer ID required")
  check(review.signedOff===true && typeof review.reviewedAt==="string" && !Number.isNaN(Date.parse(review.reviewedAt)), "Signed-off review date required")
  check(review.fixtureSha256===paired.fixtureSha256 && review.sourceSha256===paired.sourceSha256, "Review fixture or source digest mismatch")
  const cases=unique(review.cases,"review")
  const pairedIds=unique(paired.pairs,"paired")
  check(cases.size===50 && pairedIds.size===50,"All fifty unique cases must be reviewed")
  const rows=[]
  for (const [id,p] of pairedIds) {
    const r=cases.get(id)
    check(!!r,"Missing reviewer evidence for "+id)
    check(r.question===p.question,"Review question mismatch at "+id)
    const failures=r.hardFailures
    check(Array.isArray(failures),"Explicit hardFailure assessment required at "+id)
    for(const failure of failures) {
      check(["reference","kompas"].includes(failure.model)&&BAD.has(failure.type)&&isProof(failure.reason), "Invalid hard failure record at "+id)
      if(failure.quote)check(p[failure.model].includes(failure.quote),"Hard failure quote missing in "+failure.model+" output at "+id)
    }
    const reference=validateScores(r.reference,p.reference,"reference",id)
    const kompas=validateScores(r.kompas,p.kompas,"kompas",id)
    const failReference=failures.some(f=>f.model==="reference")
    const failKompas=failures.some(f=>f.model==="kompas")
    const referenceMeetsRubric=!failReference&&REVIEW_AXES.every(k=>r.reference[k].score>=3)
    const kompasMeetsRubric=!failKompas&&REVIEW_AXES.every(k=>r.kompas[k].score>=3)
    rows.push({
      id,question:p.question,domain:r.domain||"unconfirmed",
      referenceScore:reference,kompasScore:kompas,delta:kompas-reference,
      referenceMeetsRubric,kompasMeetsRubric,
      hardFailures:failures,
      outcome:kompas===reference?"tie":kompas>reference?"kompas-higher":"reference-higher",
      kompasElapsedMs:Number.isFinite(r.kompasElapsedMs)&&r.kompasElapsedMs>=0?r.kompasElapsedMs:null,
    })
  }
  const count=rows.length
  const mean=key=>Math.round(rows.reduce((s,r)=>s+r[key],0)/count*100)/100
  const wins=rows.filter(r=>r.outcome==="kompas-higher").length
  const losses=rows.filter(r=>r.outcome==="reference-higher").length
  const ties=rows.filter(r=>r.outcome==="tie").length
  return {
    status:"all-cases-reviewed",reviewProvenance:"self-attested; reviewer identity and source truth not independently verified",
    fixture:paired.fixture,sourceSha256:paired.sourceSha256,fixtureSha256:paired.fixtureSha256,
    reviewed:count,reviewerId:review.reviewerId,reviewedAt:review.reviewedAt,
    metrics:{
      kompasAverage:mean("kompasScore"),referenceAverage:mean("referenceScore"),
      kompasRubricPass:rows.filter(r=>r.kompasMeetsRubric).length,
      referenceRubricPass:rows.filter(r=>r.referenceMeetsRubric).length,
      wins,losses,ties,
      kompasHardFailures:rows.reduce((s,r)=>s+r.hardFailures.filter(f=>f.model==="kompas").length,0),
      referenceHardFailures:rows.reduce((s,r)=>s+r.hardFailures.filter(f=>f.model==="reference").length,0),
    },rows,
    note:"These are self-attested review ratings, not independently verified model accuracy. Hardware/voice latency, provider authenticity and original resume claims require separate checks.",
  }
}
export async function runCli(args) {
  check(args.length===3,"Usage: node scripts/kompas-score-review.mjs PRIVATE_PAIRED.json PRIVATE_REVIEW.json PRIVATE_OUTPUT.json")
  const [pairedPath,reviewPath,destination]=args
  const target=resolve(destination),root=resolve(fileURLToPath(new URL("../",import.meta.url)))
  check(target!==root&&!target.startsWith(root+sep),"Review scores must be written outside the repository")
  const [paired,review]=await Promise.all([readFile(pairedPath,"utf8").then(JSON.parse),readFile(reviewPath,"utf8").then(JSON.parse)])
  const result=scoreReviewedPairs(paired,review)
  await mkdir(dirname(target),{recursive:true,mode:0o700})
  await writeFile(target,JSON.stringify(result,null,2)+"\n",{flag:"wx",mode:0o600})
  return {saved:target,reviewed:result.reviewed,status:result.status}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  runCli(process.argv.slice(2)).then(x=>console.log(JSON.stringify(x)))
    .catch(e=>{console.error(e.message);process.exitCode=1})
