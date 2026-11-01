import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const index=readFileSync(new URL("../../public/kompas/index.html",import.meta.url),"utf8")
const version=JSON.parse(readFileSync(new URL("../../public/kompas/version.json",import.meta.url),"utf8"))
const app=readFileSync(new URL("../../public/kompas/app.js",import.meta.url),"utf8")
test("New self-hosted build and cache key agree so old Electron cannot silently keep the old app",()=>{
 const build=index.match(/window\.PERFACT_BUILD\s*=\s*"([^"]+)"/)?.[1]
 const cache=index.match(/src="app\.js\?v=([^"]+)"/)?.[1]
 assert.ok(build && cache)
 assert.equal(build,version.build)
 assert.equal(cache,build.replace(/^kompas-/,""))
 assert.ok(!build.includes("20261030"),"release stamp must advance after the answer changes")
})
test("Desktop update detection observes a changed release without force-reloading a live meeting",()=>{
 assert.match(app,/v\.build === BUILD/)
 assert.match(app,/cache:\s*"no-store"/)
 assert.match(app,/b\.onclick = \(\) => location\.reload\(\)/)
 const section=app.slice(app.indexOf("async function checkForUpdate()"),app.indexOf("async function showCapabilityVersion"))
 assert.match(section,/b\.onclick = \(\) => location\.reload\(\)/)
 assert.equal((section.match(/location\.reload\(\)/g)||[]).length,1,"Only a user click may reload the session")
})
