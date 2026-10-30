import test from "node:test"
import assert from "node:assert/strict"
import { emptyBible, makeItem, miniFromSession, toDossierSources, toSpeedSources } from "../../src/lib/dossierBible.ts"
import { validateDossierSources } from "../../src/lib/kompas-dossier-bots.ts"
import { buildFastDossierIndex, queryFastDossier } from "../../src/lib/kompas-fast-dossier.ts"

test("miniFromSession accepts PR #126 SessionMini shape and old shape alike", () => {
  const pr = miniFromSession({ version: "kompas-master-bible-v1", sessionId: "s1", field: "security", at: "2026-10-29T12:00:00.000Z", digest: "a".repeat(64), qa: [{ q: "Walk me through triage", a: "I start with scope." }] })
  const old = miniFromSession({ id: "s1", at: Date.parse("2026-10-29T12:00:00.000Z"), qa: [{ q: "Walk me through triage", a: "I start with scope." }] })
  assert.equal(pr.session, "s1"); assert.equal(pr.updatedAt, old.updatedAt)
  assert.deepEqual(pr.sections.qbank.map(i => i.id), old.sections.qbank.map(i => i.id))
})

test("toDossierSources feeds PR #126 validator and fast index; holes never leave", () => {
  const b = emptyBible()
  b.sections.evidence.push(makeItem({ section: "evidence", kind: "story", text: "Cigna vulnerability triage with ServiceNow", source: { doc: "resume", session: null, span: "ServiceNow" } }))
  b.sections.signals.push(makeItem({ section: "signals", kind: "term", text: "Technology risk analyst, regulated bank", source: { doc: "jd", session: null, span: "risk" } }))
  b.sections.evidence.push(makeItem({ section: "evidence", kind: "metric", text: "[ ___ confirm: your actual figure ]", source: null, status: "hole" }))
  const src = toDossierSources(b)
  assert.deepEqual(src.map(s => s.kind).sort(), ["job_description", "resume"])
  assert.ok(!src.some(s => s.text.includes("___")))
  const ok = validateDossierSources(src.map(({ id, kind, title, text }) => ({ id, kind, title, text })))
  assert.ok(Array.isArray(ok), JSON.stringify(ok))
  const idx = buildFastDossierIndex(src, "a".repeat(64), "", "")
  assert.ok(queryFastDossier(idx, "ServiceNow triage", { limit: 3 }).length >= 1)
  assert.equal(typeof toSpeedSources(b).resume, "string") // old shape kept
})
