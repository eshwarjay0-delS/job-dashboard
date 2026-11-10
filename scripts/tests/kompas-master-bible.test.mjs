import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { performance } from "node:perf_hooks"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const root = new URL("../../", import.meta.url)
const loaded = new Map()
function load(path) {
  if (loaded.has(path)) return loaded.get(path)
  const src = readFileSync(new URL(path, root), "utf8")
  const js = ts.transpileModule(src, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText
  const module = { exports: {} }
  loaded.set(path, module.exports)
  const wrapped = (name) => {
    if (name === "./storage") return { blob: {} }
    if (name === "./kompas-fast-dossier") return load("src/lib/kompas-fast-dossier.ts")
    if (name === "./kompas-dossier-bots") return load("src/lib/kompas-dossier-bots.ts")
    return require(name)
  }
  vm.runInNewContext(js, { module, exports: module.exports, require: wrapped, console, Date, Map, Set })
  return module.exports
}
const { buildFastDossierIndex, queryFastDossier, extendFastDossierIndex, tokenizeDossier } = load("src/lib/kompas-fast-dossier.ts")
const { masterBibleStore } = load("src/lib/kompas-master-bible.ts")
const fp = "b".repeat(64)
class MemoryBlob {
  map = new Map()
  async getText(k) { return this.map.get(k) ?? null }
  async put(k, v) { this.map.set(k, v) }
  async putIfAbsent(k, v) {
    if (this.map.has(k)) return false
    this.map.set(k, v)
    return true
  }
}
function qa(topic) {
  return [{ q: "Explain " + topic + " and its failure boundary", a: "A previous practice answer considered " + topic + " evidence, troubleshooting, and a rollback plan." }]
}
test("master Bible saves immutable minis, idempotently merges, and preserves full source QA", async () => {
  const storage = new MemoryBlob(), db = masterBibleStore(storage)
  const a = await db.saveSession(fp, "s-101", "Security", qa("CyberArk"))
  assert.equal(a.added, true)
  const dup = await db.saveSession(fp, "s-101", "Security", qa("CyberArk"))
  assert.equal(dup.added, false)
  const b = await db.saveSession(fp, "s-102", "Security", qa("PKI"))
  assert.equal(b.added, true)
  const latest = await db.readLatest(fp, true)
  assert.equal(latest.sessionCount, 2)
  assert.equal(latest.revision, 1)
  assert.equal(storage.map.size >= 5, true)
  const masterText = await db.context(fp, "PKI troubleshooting", {})
  assert.ok(masterText.includes("PKI"), masterText)
  assert.ok(masterText.includes("context-only"), masterText)
  assert.ok(!masterText.includes("candidate-asserted"), masterText)
  const savedMinis = [...storage.map.keys()].filter(k => /\/mini\//.test(k))
  assert.equal(savedMinis.length, 2)
  assert.ok(savedMinis.some(k => storage.map.get(k).includes("CyberArk")))
  assert.ok(savedMinis.some(k => storage.map.get(k).includes("PKI")))
})
test("two concurrent completed sessions are never lost by version conflicts", async () => {
  const db = masterBibleStore(new MemoryBlob())
  const result = await Promise.all([
    db.saveSession("d".repeat(64), "s101", "SOC", qa("Splunk")),
    db.saveSession("d".repeat(64), "s102", "SOC", qa("Sentinel")),
  ])
  assert.equal(result.filter(x => x.added).length, 2)
  const snapshot = await db.readLatest("d".repeat(64), true)
  assert.equal(snapshot.sessionCount, 2)
})
test("different owners have entirely separate master revisions", async () => {
  const storage = new MemoryBlob(), db = masterBibleStore(storage)
  await db.saveSession("a".repeat(64), "session1", "SOC", qa("secretABC"))
  assert.equal(await db.readLatest("f".repeat(64)), null)
  assert.equal(await db.context("f".repeat(64), "secretABC"), "")
})
test("mismatched rerun cannot overwrite an immutable historical mini", async () => {
  const db = masterBibleStore(new MemoryBlob())
  await db.saveSession("a".repeat(64), "same", "SOC", qa("original"))
  await assert.rejects(db.saveSession("a".repeat(64), "same", "SOC", qa("fabricated")))
})
test("compaction bounds hot index but does not delete durable mini files", async () => {
  const saved = new MemoryBlob(), db = masterBibleStore(saved)
  const owner = "a".repeat(64)
  for (let i = 0; i < 15; i++) await db.saveSession(owner, "session" + i, "SOC", qa("topic" + i))
  const b = await db.readLatest(owner, true)
  assert.equal(b.sessionCount, 15)
  assert.equal([...saved.map.keys()].filter(x => x.includes("/mini/")).length, 15)
  assert.equal(b.index.version, "kompas-fast-dossier-v1")
  const single = buildFastDossierIndex([
    {id:"x",kind:"interview_transcript",title:"x",text:"test failure boundary",digest:fp},
  ],fp,"","")
  const truncated = extendFastDossierIndex(b.index, single, 3)
  assert.ok(truncated.chunks.length <= 3)
})
test("1,000 keywords traverse precomputed postings without rescanning full text", () => {
  const document = Array.from({length:1000}, (_,i) => "term"+i).join(" ")
  const source = {id:"test",kind:"document",title:"Glossary",text:document,digest:fp}
  const index = buildFastDossierIndex([source],fp,"","")
  assert.equal(index.chunks.map(c=>c.text).join(""), document)
  const start = performance.now()
  for (let i=0;i<10;i++) {
    const hits = queryFastDossier(index, document, {limit:5,maxChars:2200})
    assert.ok(hits.length>0)
    assert.ok(hits.reduce((n,h)=>n+h.text.length,0)<=2200)
  }
  const ms = performance.now()-start
  assert.ok(ms<1200, "The 10 lookup passes took "+ms.toFixed(1)+"ms")
})
test("many unrelated job terms cannot create fabricated candidate-asserted experience", () => {
  const idx = buildFastDossierIndex([
    {id:"jd",kind:"job_description",title:"JD",text:"CyberArk EPM Zscaler PKI",digest:fp},
    {id:"real",kind:"resume",title:"Resume",text:"I configured Splunk dashboards for system alert monitoring.",digest:fp},
  ],fp,"","")
  const hits = queryFastDossier(idx,"CyberArk", {firstPerson:true})
  assert.equal(hits.length,0)
  assert.ok(tokenizeDossier("why and how does this work?").includes("work")===false)
})
