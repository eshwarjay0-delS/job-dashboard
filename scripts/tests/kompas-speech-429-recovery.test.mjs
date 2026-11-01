import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const api = readFileSync(new URL("../../src/app/api/kompas/speech/route.ts", import.meta.url), "utf8")
const provider = readFileSync(new URL("../../src/lib/kompasSpeech.ts", import.meta.url), "utf8")
const desktop = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8")
const shell = readFileSync(new URL("../../src/lib/kompas-shell.ts", import.meta.url), "utf8")
const start = app.indexOf("let speechUploadQueue = Promise.resolve();")
const end = app.indexOf("// Gap B3 (30 Oct", start)
assert.ok(start > 0 && end > start, "live transcription code is found")
const live = app.slice(start, end)

function harness(fetcher) {
  const metrics = { slept: [], statuses: [], received: [], fetched: [], outstanding: 0, maxOutstanding: 0 }
  const wrappedFetch = async (...args) => {
    metrics.outstanding++
    metrics.maxOutstanding = Math.max(metrics.maxOutstanding, metrics.outstanding)
    metrics.fetched.push({ url: args[0], source: args[1].headers["x-audio-source"], blob: args[1].body })
    try { return await fetcher(...args) } finally { metrics.outstanding-- }
  }
  let clock = 1000
  const DateClock = { now: () => clock, parse: Date.parse.bind(Date) }
  const patch = live.replace(
    "function speechSleep(ms) { return new Promise(resolve => setTimeout(resolve, Math.max(0, ms))); }",
    "function speechSleep(ms) { metrics.slept.push(ms); clock += ms; return Promise.resolve(); }"
  )
  assert.notEqual(patch, live, "test replaces only async sleep with fake clock")
  const context = {
    metrics, Date: DateClock, fetch: wrappedFetch, performance: { now: () => clock },
    AbortController, encodeURIComponent,
    Promise, setTimeout: () => 1, clearTimeout: () => {},
    cleanTranscript: s => String(s || "").trim(), dictationRetry: () => false,
    whisperPrompt: () => "Kerberos, CyberArk", status: s => metrics.statuses.push(s),
    onTranscript: (who, text) => metrics.received.push({ who, text }),
    priorOrTimeout: () => Promise.resolve(), showCaption: () => {},
  }
  runInNewContext(
    "let transcriptionOrder = Promise.resolve(); let transcriptionEpoch = 1; let transcriptionFailedEpoch = -1; let interimOffUntil = 0; let current = {language:'en'}; let running=true;\n" +
    patch + "\nthis.transcribe=transcribe; this.retryDelay=speechRetryAfterMs; this.failureEpoch=()=>transcriptionFailedEpoch;",
    context,
  )
  return { ...context, metrics, blob: new Blob(["a small recorded interview phrase"], {type:"audio/webm"}) }
}
const ok = (text) => new Response(JSON.stringify({ text }), { status: 200, headers: { "content-type": "application/json" } })
const busy = (retry = "15") => new Response(JSON.stringify({ code:"busy" }), { status:429, headers: { "retry-after":retry } })

test("429 keeps original system-audio bytes, honors provider cooldown, and delivers question on retry", async () => {
  let calls = 0
  const h = harness(async () => ++calls === 1 ? busy("15") : ok("How would you investigate a CyberArk policy block?"))
  await h.transcribe(h.blob, "Them", { final: true, epoch: 1, speechMs: 220, spokenAt: 4000 })
  assert.equal(calls, 2)
  assert.deepEqual(h.metrics.slept, [15000])
  assert.equal(h.metrics.fetched[0].blob, h.blob)
  assert.equal(h.metrics.fetched[1].blob, h.blob)
  assert.equal(h.metrics.fetched[0].source, "system")
  assert.equal(h.metrics.fetched[1].source, "system")
  assert.deepEqual(h.metrics.received, [{ who:"Them", text:"How would you investigate a CyberArk policy block?" }])
  assert.equal(h.failureEpoch(), -1)
})

test("Mic and computer audio serialize instead of triggering a concurrent 429 stampede", async () => {
  const h = harness(async (_url, opts) => {
    await Promise.resolve()
    return ok(opts.headers["x-audio-source"] === "system" ? "Interviewer question?" : "My clarification.")
  })
  await Promise.all([
    h.transcribe(h.blob, "Them", { final:true, epoch:1, speechMs:200 }),
    h.transcribe(h.blob, "You", { final:true, epoch:1, speechMs:200 }),
  ])
  assert.equal(h.metrics.maxOutstanding, 1)
  assert.deepEqual(h.metrics.fetched.map(x=>x.source), ["system", "mic"])
  assert.deepEqual(h.metrics.received.map(x=>x.who), ["Them", "You"])
})

test("Repeated provider 429 is bounded and never fabricates a transcript", async () => {
  let calls=0
  const h=harness(async()=>{ calls++; return busy("3") })
  const result=await h.transcribe(h.blob,"Them",{final:true,epoch:1,speechMs:200})
  assert.equal(result,false)
  assert.equal(calls,5)
  assert.equal(h.metrics.received.length,0)
  assert.match(h.metrics.statuses.at(-1),/not been transcribed/)
  assert.ok(h.metrics.slept.length<=4)
})

test("Nonretryable audio validation errors stay bounded to one call", async()=>{
  let calls=0
  const h=harness(async()=>{calls++; return new Response("bad audio",{status:422})})
  const result=await h.transcribe(h.blob,"Them",{final:true,epoch:1,speechMs:200})
  assert.equal(calls,1)
  assert.equal(result,false)
  assert.equal(h.metrics.received.length,0)
})

test("HTTP-date and fractional retry-after values keep their time meaning",()=>{
  const h=harness(async()=>ok("Test"))
  assert.equal(h.retryDelay(new Headers({"retry-after":"8.5"})),8500)
  assert.equal(h.retryDelay(new Headers({"retry-after":"Thu, 01 Jan 1970 00:01:00 GMT"})),59000)
  assert.equal(h.retryDelay(new Headers({"retry-after":"180"})),120000)
  assert.equal(h.retryDelay(new Headers(),0),8000)
  assert.equal(h.retryDelay(new Headers(),1),16000)
})

test("Canonical server returns Retry-After on 429; Electron carries source identity",()=>{
  assert.match(api,/retryAfterSec \? \{ \.\.\.NO_STORE, "Retry-After": String\(retryAfterSec\) \}/)
  assert.match(api,/audioSource = request\.headers\.get\("x-audio-source"\) === "system"/)
  assert.match(provider,/speechRetryAfterSeconds\(response\.headers\.get\("retry-after"\)\)/)
  assert.match(desktop,/FORWARD_HEADERS = \[[^\n]*"x-audio-source"[^\n]*"x-session-id"/)
  assert.match(shell,/url\.pathname = '\/api\/kompas\/speech'/)
  assert.match(app,/who === "Them" && typeof ctx\.createGain === "function"/)
})
