import test from "node:test"
import assert from "node:assert/strict"
import { createReviewTemplate } from "../kompas-review-template.mjs"
import { REVIEW_AXES,scoreReviewedPairs } from "../kompas-score-review.mjs"
const pairs=Array.from({length:50},(_,i)=>({id:"crossdomain-"+String(i+1).padStart(2,"0"),question:"Question "+(i+1)+"?",kompas:"Synthetic response",reference:"Synthetic reference"}))
const paired={quality:"unverified",count:50,sourceSha256:"a".repeat(64),fixtureSha256:"b".repeat(64),pairs}
test("Reviewer template contains exactly 50 ungraded cases across both models",()=>{
 const template=createReviewTemplate(paired)
 assert.equal(template.cases.length,50)
 assert.equal(template.signedOff,false)
 assert.equal(template.reviewerId,"")
 assert.ok(template.cases.every(c=>REVIEW_AXES.every(key=>c.kompas[key].score===null&&c.reference[key].score===null)))
 assert.throws(()=>scoreReviewedPairs(paired,template),/Reviewer ID required/)
})
test("Reviewer template rejects incomplete or duplicate paired source",()=>{
 assert.throws(()=>createReviewTemplate({...paired,count:49}),/Expected all fifty/)
 const duplicate=structuredClone(paired);duplicate.pairs[1].id=duplicate.pairs[0].id
 assert.throws(()=>createReviewTemplate(duplicate),/Duplicate/)
})
