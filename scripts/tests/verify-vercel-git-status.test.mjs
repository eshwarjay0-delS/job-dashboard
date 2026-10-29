import test from "node:test"
import assert from "node:assert/strict"
import { verifyVercelStatus } from "../verify-vercel-git-status.mjs"
const sha="a".repeat(40),repo="owner/job-dashboard",token="synthetic-not-a-real-token"
const proof="https://vercel.com/example/job-dashboard/deploy123"
function res(statuses,status=200){return {ok:status===200,status,json:async()=>({statuses})}}
function mock(steps){const calls=[];let i=0;return {calls,fetcher:async(u,opts)=>{calls.push([u,opts]);return steps[Math.min(i++,steps.length-1)]}}}
test("Exact SHA and genuine Vercel success cause verified CI result without deploying",async()=>{
 const x=mock([res([{context:"Vercel",state:"success",target_url:proof}])])
 const got=await verifyVercelStatus({sha,repo,token,fetcher:x.fetcher,sleeper:async()=>{throw Error("unexpected sleep")}})
 assert.equal(got.status,"success")
 assert.equal(got.commit,sha)
 assert.equal(got.targetUrl,proof)
 assert.equal(x.calls.length,1)
 assert.match(x.calls[0][0],new RegExp(sha+"/status$"))
 assert.equal(x.calls[0][1].headers.authorization,"Bearer "+token)
})
test("Pending/missing statuses retry until latest Vercel success",async()=>{
 const x=mock([res([]),res([{context:"Other",state:"success"},{context:"Vercel",state:"pending"}]),res([{context:"Vercel",state:"success",target_url:proof}])])
 let waits=0
 const got=await verifyVercelStatus({sha,repo,token,fetcher:x.fetcher,sleeper:async()=>{waits++},attempts:3,intervalMs:0})
 assert.equal(got.attempt,3)
 assert.equal(waits,2)
})
test("Failure or error blocks misleading green deployment job",async()=>{
 for(const state of ["failure","error"]) {
  const x=mock([res([{context:"Vercel",state}])])
  await assert.rejects(verifyVercelStatus({sha,repo,token,fetcher:x.fetcher}),new RegExp(state))
 }
})
test("Missing status, absent permissions, fake proof URL and unset token fail closed",async()=>{
 {const x=mock([res([])]);await assert.rejects(verifyVercelStatus({sha,repo,token,fetcher:x.fetcher,sleeper:async()=>{},attempts:2,intervalMs:0}),/No successful/)}
 {const x=mock([res([],403)]);await assert.rejects(verifyVercelStatus({sha,repo,token,fetcher:x.fetcher}),/HTTP 403/)}
 {const x=mock([res([{context:"Vercel",state:"success",target_url:"https://example.org/fake"}])]);await assert.rejects(verifyVercelStatus({sha,repo,token,fetcher:x.fetcher}),/unexpected proof URL/)}
 await assert.rejects(verifyVercelStatus({sha,repo,token:""}),/GITHUB_TOKEN is required/)
 await assert.rejects(verifyVercelStatus({sha:"not-sha",repo,token}),/40-hex/)
})
