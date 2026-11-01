import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import vm from "node:vm"

const src=readFileSync(new URL("../../public/kompas/app.js",import.meta.url),"utf8")
const begin=src.indexOf("async function recoverLiveAuth()")
const end=src.indexOf("// Idle is where sessions",begin)
assert.ok(begin>0 && end>begin,"live auth recovery helper must be present")
const code=src.slice(begin,end)
async function run(values) {
  let calls=0, delays=[]
  const ctx=vm.createContext({
    tryRefreshAuth:async()=>{const v=values[calls++];return !!v},
    setTimeout:(cb,delay)=>{delays.push(delay);cb()}
  })
  vm.runInContext(code+"\nthis.recover = recoverLiveAuth;",ctx)
  return { result:await ctx.recover(),calls,delays }
}
test("healthy native renewal returns immediately without a reconnect banner",async()=>{
 const x=await run([true]);assert.equal(x.result,true);assert.equal(x.calls,1);assert.equal(x.delays.length,0)
})
test("temporary failed auth rotation can recover on second attempt",async()=>{
 const x=await run([false,true]);assert.equal(x.result,true);assert.equal(x.calls,2);assert.deepEqual(x.delays,[800])
})
test("temporary network failure can recover on third attempt",async()=>{
 const x=await run([false,false,true]);assert.equal(x.result,true);assert.equal(x.calls,3);assert.deepEqual(x.delays,[800,2400])
})
test("revoked credentials fail closed after bounded attempts",async()=>{
 const x=await run([false,false,false]);assert.equal(x.result,false);assert.equal(x.calls,3);assert.deepEqual(x.delays,[800,2400])
})
test("auth retry is wired to live answer and prep, not only a background timer",()=>{
 assert.match(src,/if \(!s\.__authRetried && await recoverLiveAuth\(\)\)/)
 assert.match(src,/if \(await recoverLiveAuth\(\)\) \{ recoverAnswer/)
 assert.match(src,/recoverAnswer\("AUTH"\); waitForAuthSilently\(/)
 assert.doesNotMatch(src,/recoverAnswer\("AUTH"\); redirectToLogin\(\)/)
})
test("desktop renewal continues when renderer becomes backgrounded",()=>{
 const start=src.indexOf("function keepAuthAlive()"), end=src.indexOf("let __authProbeTimer",start)
 const section=src.slice(start,end)
 assert.match(section,/document\.hidden && !window\.kompasDesktop/)
 assert.match(section,/setInterval\(keepAuthAlive, 60 \* 1000\)/)
 assert.doesNotMatch(section,/__lastAuthRefresh = Date\.now\(\)/)
})
