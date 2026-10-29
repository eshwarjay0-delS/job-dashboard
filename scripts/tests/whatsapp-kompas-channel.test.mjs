import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const nodeRequire = createRequire(import.meta.url)
const revisions = new Map()
const sessions = new Map()
let seq = 0
let calls = 0
let provider = async () => "The grounded answer"
const texts = new Map([["resume", "Verified resume contents"], ["jd", "Job requirements"], ["support", "Supporting case study"]])
const blob = {
  // A credentials policy that can GetObject/PutObject but denies ListObjects
  // must still support both Kompas and ordinary WhatsApp tailoring.
  list: async () => { throw new Error("ListObjectsV2 denied by storage policy") },
  getText: async key => revisions.get(key) ?? null,
  putIfAbsent: async (key, value) => {
    if (revisions.has(key)) return false
    revisions.set(key, value)
    return true
  },
}
const registered = []
let catalogFails = false
const store = {
  remember: async (owner,id) => { if(catalogFails)throw Error("Catalog unavailable");registered.push({owner,id});return true },
  create: async owner => {
    const id = String(++seq).padStart(8, "0") + "-1111-4111-8111-111111111111"
    const value = { id, owner, revision: 0, sources: { mode: "kompas", documents: [] }, history: [] }
    sessions.set(owner + ":" + id, value)
    return structuredClone(value)
  },
  read: async (owner, id) => {
    const value = sessions.get(owner + ":" + id)
    return value ? structuredClone(value) : null
  },
  commit: async (owner, expected, next) => {
    const key = owner + ":" + next.id, current = sessions.get(key)
    if (!current || current.revision !== expected || next.revision !== expected + 1) return false
    sessions.set(key, structuredClone(next))
    return true
  },
}
const compiled = file => ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const reducer = { exports: {} }
runInNewContext(compiled("src/lib/whatsapp-kompas.ts"), {
  module: reducer, exports: reducer.exports, require: nodeRequire,
})
const sharedTurn = async (owner, id, expected, requestId, question) => {
  const original = await store.read(owner, id)
  if (!original || original.revision !== expected) return { status: "conflict" }
  calls++
  const answer = await provider(question, original)
  if (answer === "REPEAT") return { status: "repeated" }
  const current = await store.read(owner, id)
  if (!current || current.revision !== expected) return { status: "conflict" }
  const next = { ...current, revision: current.revision + 1,
    history: [...current.history, { q: question, a: answer }], ledger: { requestId } }
  await store.commit(owner, expected, next)
  return { status: "answered", text: answer, session: next }
}
const module = { exports: {} }
runInNewContext(compiled("src/lib/whatsapp-kompas-channel.ts"), {
  module, exports: module.exports,
  require: key => ({
    "@/lib/storage": { blob },
    "@/lib/docx": { extractText: async bytes => bytes.toString("utf8") },
    "@/lib/pdf-text": { pdfText: async bytes => bytes.toString("utf8") },
    "@/lib/whatsapp": { downloadMedia: async (id, limit) => {
      const value = Buffer.from(texts.get(id) || "")
      if (value.length > limit) throw new Error("too large")
      return value
    } },
    "@/lib/kompas-session-store": { sharedKompasStore: () => store },
    "@/lib/kompas-shared-turn": { sharedKompasTurn: sharedTurn },
    "@/lib/whatsapp-kompas": { kompasTransition: reducer.exports.kompasTransition, classifyKompasPastedSource: reducer.exports.classifyKompasPastedSource },
  })[key] || nodeRequire(key),
  Buffer, Date,
})
const handle = module.exports.handleWhatsAppKompas
const from = "15554441111", owner = "11111111-1111-4111-8111-111111111111"
const t = text => ({ type: "text", text: { body: text } })
const d = (id, filename, caption) => ({ type: "document", document: { id, filename, caption } })
const execute = async (msg, opts = {}) => {
  const sent = []
  const consumed = await handle({ from: opts.from || from, owner: opts.owner || owner,
    verified: opts.verified ?? true, requestId: String(opts.requestId || ++seq), msg,
    send: async message => { sent.push(message) } })
  return { consumed, sent }
}
const reset = () => { revisions.clear(); sessions.clear(); seq = 0; calls = 0; provider = async () => "The grounded answer" }
const started = async () => { await execute(t("kompas")); await execute(t("Resume evidence")); await execute(t("Job requirements")) }

test("1. Non-Kompas WhatsApp traffic stays in the existing tailor path", async () => {
  reset()
  assert.equal((await execute(t("Endpoint analyst role"))).consumed, false)
  assert.equal((await execute(t("kompas engineer"))).consumed, false)
})
test("2. The Kompas command is exact, case-insensitive and does not accept unverified accounts", async () => {
  reset()
  assert.match((await execute(t(" KOMPAS "))).sent[0], /Send your resume/)
  reset()
  assert.match((await execute(t("kompas"), { verified: false })).sent[0], /Link and verify/)
  assert.equal(sessions.size, 0)
})
test("3. A premature start is not misread as resume or JD", async () => {
  reset()
  await execute(t("kompas"))
  assert.match((await execute(t("start"))).sent[0], /resume/)
  assert.match((await execute(t("Resume evidence"))).sent[0], /job description/)
  assert.match((await execute(t("start"))).sent[0], /job description/)
})
test("4. Resume and JD unlock an answer from one shared engine", async () => {
  reset()
  await started()
  const r = await execute(t("DNS"))
  assert.equal(r.sent[0], "The grounded answer")
  assert.equal(calls, 1)
})
test("4b. A repeated answer for a different question is not sent", async () => {
  reset()
  await started()
  provider = async () => "REPEAT"
  const r = await execute(t("What exactly is least privilege?"))
  assert.match(r.sent[0], /did not send that copy/)
  assert.equal([...sessions.values()][0].history.length, 0)
})
test("5. A supporting document remains separate from the two primary sources", async () => {
  reset()
  await execute(t("kompas"))
  await execute(d("resume", "resume.docx"))
  await execute(d("jd", "job.pdf"))
  await execute(d("support", "notes.txt"))
  const current = [...sessions.values()][0]
  assert.equal(current.sources.resume, "Verified resume contents")
  assert.equal(current.sources.jd, "Job requirements")
  assert.equal(current.sources.documents[0].text, "Supporting case study")
})
test("6. Invalid or unsupported attachments do not enter the session", async () => {
  reset()
  await execute(t("kompas"))
  assert.match((await execute(d("empty", "bad.pdf"))).sent[0], /readable/)
  assert.match((await execute(d("resume", "image.png"))).sent[0], /readable/)
  assert.equal([...sessions.values()][0].sources.resume, undefined)
})
test("7. A second owner cannot see the first owner's session", async () => {
  reset()
  await started()
  const other = "22222222-2222-4222-8222-222222222222"
  assert.equal((await execute(t("DNS"), { owner: other })).consumed, false)
  await execute(t("kompas"), { owner: other })
  assert.equal(sessions.size, 2)
})
test("8. Revert returns to tailoring without deleting history", async () => {
  reset()
  await started()
  await execute(t("TLS"))
  const before = [...sessions.values()][0].history.length
  assert.match((await execute(t("revert"))).sent[0], /Back to MFit/)
  assert.equal((await execute(t("New JD"))).consumed, false)
  assert.equal([...sessions.values()][0].history.length, before)
})
test("9. Revert suppresses an answer generated concurrently", async () => {
  reset()
  await started()
  let release, begun
  const entered = new Promise(resolve => { begun = resolve })
  provider = async () => { begun(); return new Promise(resolve => { release = resolve }) }
  const pending = execute(t("Privileged access"))
  await entered
  await execute(t("revert"))
  release("Stale answer")
  const result = await pending
  assert.equal(result.sent.includes("Stale answer"), false)
})
test("10. Concurrent Kompas commands cannot bind two sessions", async () => {
  reset()
  await Promise.all([execute(t("kompas")), execute(t("kompas"))])
  assert.equal([...revisions.values()].filter(x => JSON.parse(x).sessionId).length, 1)
})

test("11. A returned-to-tailoring channel never consumes a new JD", async () => {
  reset()
  await execute(t("kompas"))
  await execute(t("revert"))
  assert.equal((await execute(t("Network Security Engineer job description"))).consumed, false)
})
test("12. A large revision history is read with logarithmic point reads, never an object listing", async () => {
  reset()
  // Session switches create contiguous immutable revisions.
  for (let i = 0; i < 24; i++) {
    await execute(t("kompas"))
    await execute(t("revert"))
  }
  assert.equal((await execute(t("Network Security Engineer job description"))).consumed, false)
  assert.equal(revisions.size, 48)
})
test("13. A storage failure cannot silently misroute a Kompas question as resume tailoring", async () => {
  reset()
  await execute(t("kompas"))
  const original = blob.getText
  blob.getText = async () => { throw new Error("storage permission denied") }
  try {
    const outcome = await execute(t("Privileged access investigation"))
    assert.equal(outcome.consumed, true)
    assert.match(outcome.sent[0], /couldn't check your Kompas WhatsApp session/)
    assert.doesNotMatch(outcome.sent[0], /no AI service/i)
  } finally { blob.getText = original }
})

test("14. Basic WhatsApp Help is routed before any optional Kompas storage call", () => {
  const webhook = readFileSync("src/app/api/whatsapp/webhook/route.ts", "utf8")
  const handleStart = webhook.indexOf("async function handle(from:")
  const command = webhook.indexOf('["help", "hi", "hello", "menu"].includes(command)', handleStart)
  const kompas = webhook.indexOf("const consumed = await handleWhatsAppKompas", handleStart)
  assert.ok(handleStart > 0 && command > handleStart && kompas > command,
    "Help/menu must not be blocked by the Kompas session lookup")
  assert.match(webhook.slice(command, kompas), /return sendText\(from, HELP\)/)
})
test("15. Storage failures must not be reported as AI-provider configuration failures", () => {
  const webhook = readFileSync("src/app/api/whatsapp/webhook/route.ts", "utf8")
  const errorBoundary = webhook.slice(webhook.indexOf("const work = async () => {"), webhook.indexOf("if (typeof after ==="))
  assert.match(errorBoundary, /const providerError =/)
  assert.match(errorBoundary, /\? plainFailure\(e, "do that", true\)/)
  assert.match(errorBoundary, /MarketFit service is unavailable/)
  assert.doesNotMatch(errorBoundary, /sendText\(from, plainFailure\(e, "do that", true\)\)/)
})

test("16. Explicit Use 2 profile switching avoids the Kompas storage precondition", () => {
  const webhook = readFileSync("src/app/api/whatsapp/webhook/route.ts", "utf8")
  const handleStart = webhook.indexOf("async function handle(from:")
  const profile = webhook.indexOf("const profileCommand =", handleStart)
  const kompas = webhook.indexOf("const consumed = await handleWhatsAppKompas", handleStart)
  assert.ok(handleStart > 0 && profile > handleStart && kompas > profile)
  assert.match(webhook.slice(profile, kompas), /if \(!profileCommand && \(type === "text" \|\| type === "document"\)\)/)
  assert.match(webhook.slice(profile, kompas), /\(\?:use\|switch/)
  const select = webhook.indexOf("const email = choiceIn(text", kompas)
  assert.ok(select > kompas, "Existing resume selection must remain behind the shortcut")
})

test("17. Pasted job description first, then Resume.docx, preserves both sources", async () => {
  reset()
  await execute(t("kompas"))
  const jd = "Title: Security Engineer\nOrganization: Information Technology\nPosition: Contract Hire\nPRIMARY LOCATION: New York, NY\nClient: LPL Financial\nDESCRIPTION: The Security Engineer will be responsible for helping develop, mature and sustain the Application Security program."
  const first = await execute(t(jd))
  assert.match(first.sent[0], /Send your resume/)
  const second = await execute(d("resume", "Eshwar_Resume.docx"))
  assert.match(second.sent[0], /Sources received/)
  const state = [...sessions.values()][0]
  assert.equal(state.sources.jd, jd)
  assert.equal(state.sources.resume, "Verified resume contents")
  assert.equal((await execute(t("start"))).sent[0].includes("Ready for your questions"), true)
  assert.equal((await execute(t("Explain vulnerability management"))).sent[0], "The grounded answer")
})
test("18. Resume and pasted JD are accepted even if received concurrently", async () => {
  reset()
  await execute(t("kompas"))
  const jd = "Title: Application Security Engineer\nPosition: Full Time\nClient: Banking Institution\nDESCRIPTION: This role will be responsible for threat modeling, security testing, and vulnerability management in distributed systems."
  await Promise.all([execute(t(jd)), execute(d("resume", "Eshwar_Resume.docx"))])
  const state = [...sessions.values()][0]
  assert.equal(state.sources.jd, jd)
  assert.equal(state.sources.resume, "Verified resume contents")
})
test("19. Previously mistaken JD in resume slot is automatically corrected", async () => {
  reset()
  await execute(t("kompas"))
  const jd = "Title: Security Engineer\nOrganization: Banking\nPosition: Contract\nClient: LPL Financial\nDESCRIPTION: The engineer will be responsible for AppSec and vulnerability management, with direct enterprise security responsibilities."
  const entry = [...sessions.entries()][0]
  const legacy = entry[1]
  sessions.set(entry[0], {...legacy, revision: legacy.revision + 1, sources: {...legacy.sources, resume: jd}})
  const result = await execute(d("resume", "Eshwar_Resume.docx"))
  assert.match(result.sent[0], /Sources received/)
  const state = [...sessions.values()][0]
  assert.equal(state.sources.jd, jd)
  assert.equal(state.sources.resume, "Verified resume contents")
})
test("20. Source setup does not depend on R2 ListObjectsV2 permission", async () => {
  reset()
  await execute(t("kompas"))
  await execute(d("resume", "resume.docx"))
  await execute(d("jd", "job.pdf"))
  assert.equal(calls, 0)
  assert.equal((await execute(t("TLS"))).sent[0], "The grounded answer")
})

test("21. A spoken casual message before sources does not overwrite resume or JD",async()=>{
  reset()
  await execute(t("kompas"))
  const msg={type:"text",text:{body:"This feels like a controlled environment. Make voice notes fast."},mfitVoiceNote:true}
  const outcome=await execute(msg)
  assert.match(outcome.sent[0],/Voice note understood/)
  const state=[...sessions.values()][0]
  assert.equal(state.sources.resume,undefined)
  assert.equal(state.sources.jd,undefined)
  const jd="Job description: Security Engineer at a financial company. Responsibilities include AppSec, vulnerability management and risk assessment."
  const parsed=await execute({type:"text",text:{body:jd},mfitVoiceNote:true})
  assert.match(parsed.sent[0],/Send your resume/)
  assert.equal([...sessions.values()][0].sources.jd,jd)
})

test('shared web link identifies the same session and repeated kompas retains it', async () => {
  reset()
  const first = await execute(t('kompas'))
  const session = [...sessions.values()][0]
  assert.ok(first.sent[0].includes(`/dashboard/kompas/shared/${session.id}`))
  assert.match(first.sent[0], /sign in to the same account/)
  const repeat = await execute(t('kompas'))
  assert.ok(repeat.sent[0].includes(`/dashboard/kompas/shared/${session.id}`))
  assert.equal(sessions.size, 1)
})

test('catalog failures do not block an active kompas reply',async()=>{
 catalogFails=true
 try {
  const messages=[]
  await module.exports.handleWhatsAppKompas({from:'15550009999',owner:'catalog-owner',verified:true,requestId:'catalog-test',msg:{type:'text',text:{body:'kompas'}},send:async text=>messages.push(text)})
  assert.match(messages[0],/Kompas started/)
  catalogFails=false
  await module.exports.handleWhatsAppKompas({from:'15550009999',owner:'catalog-owner',verified:true,requestId:'catalog-retry',msg:{type:'text',text:{body:'kompas'}},send:async text=>messages.push(text)})
  assert.ok(registered.some(s=>s.owner==='catalog-owner'))
  assert.match(messages[1],/already active/)
 } finally { catalogFails=false }
})
