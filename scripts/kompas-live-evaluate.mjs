// Run one reviewed evaluation round against the real authenticated Kompas API.
// Private source bundles and outputs must stay outside the repository.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { saveCheckpoint } from './lib/evaluation-checkpoint.mjs'
import { buildManifest } from './lib/evaluation-manifest.mjs'
import { captureSummary } from './lib/evaluation-completeness.mjs'
import { evidenceDigest } from './lib/evaluation-provenance.mjs'
import { fixtureName, caseInput } from './lib/evaluation-fixtures.mjs'
const [sourcesFile, outputDir, round = '1', selectedFixture] = process.argv.slice(2)
if (!sourcesFile || !outputDir) throw Error('Usage: node scripts/kompas-live-evaluate.mjs SOURCES.json PRIVATE_OUTPUT_DIR ROUND')
if (!/^[1-9]\d*$/.test(round)) throw Error('Round must be a positive integer')
const fixture = fixtureName(selectedFixture)
const token = process.env.KOMPAS_API_TOKEN
if (!token) throw Error('KOMPAS_API_TOKEN is not configured; zero model calls made.')
const origin = new URL(process.env.KOMPAS_BASE_URL || 'https://job-dashboard-fawn.vercel.app')
if (origin.protocol !== 'https:') throw Error('HTTPS required')
const fixtureBytes = await readFile(new URL(`./fixtures/kompas-evaluation/${fixture}.json`, import.meta.url))
const sourceBytes = await readFile(sourcesFile)
const cases = JSON.parse(fixtureBytes)
const sources = JSON.parse(sourceBytes)
const provenance = { fixtureSha256: evidenceDigest(fixtureBytes), sourcesSha256: evidenceDigest(sourceBytes), origin: origin.origin, runnerSha256: evidenceDigest(await readFile(new URL(import.meta.url))) }
const hashes = provenance
const code = { codeVersion: null, codeVersionStatus: 'Local checkout unavailable; deployed code version unverified.' }
try {
 code.codeVersion = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim()
 code.codeVersionStatus = 'Local runner checkout only; deployed answer-engine version unverified.'
} catch {}
const inputs = new Map(cases.map(c => [c.id, caseInput(c, sources, fixture)]))
await mkdir(outputDir, { recursive: true, mode: 0o700 })
const destination = path.join(outputDir, `round-${round}.json`)
const manifestPath = path.join(outputDir, `round-${round}.manifest.json`)
// Exclusive creation prevents an accidental rerun from overwriting evaluation evidence.
await writeFile(destination, '[]\n', { flag: 'wx', mode: 0o600 })
const records = [], states = new Map()
const writeManifest = (status, stage) => saveCheckpoint(manifestPath, buildManifest({
 status, stage, round: Number(round), fixture, caseCount: cases.length, records, hashes, code, completedAt: new Date().toISOString(),
}))
const request = async body => {
 const res = await fetch(new URL('/api/kompas/answer', origin), {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body), signal: AbortSignal.timeout(65000), redirect: 'error',
 })
 if (!res.ok) throw Error(`Answer API HTTP ${res.status}`)
 return res.json()
}
try {
 const ready = await request({ preflight: true })
 if (!ready.ready) throw Error('Preflight not ready; zero interview answers generated.')
} catch (error) {
 records.push({ round, provenance, stage: 'preflight', status: 'failed', error: error.message })
 await saveCheckpoint(destination, records)
 await writeManifest('failed', 'preflight')
 throw error
}
for (const c of cases) {
 const input = inputs.get(c.id)
 const state = states.get(input.key) || { history: [...input.history], ledger: input.ledger }
 const began = Date.now()
 const captureId = randomUUID()
 try {
  const answer = await request({ question: c.question, stream: false, pinned: true,
   config: { ...input.config, level: c.level, interviewer: c.level, responseCalibration: 'three-level-v1' },
   history: state.history, ledger: state.ledger,
  })
  if (!answer.text?.trim() || answer.degraded || !answer.meta?.model) throw Error('Missing actual model answer or degraded response')
  records.push({ id: c.id, captureId, historyMode: input.historyMode, round, provenance, fixture, question: c.question, level: c.level, criteria: c.criteria,
   text: answer.text, meta: answer.meta, elapsedMs: Date.now()-began,
   words: answer.text.trim().split(/\s+/).length, review: { status: 'pending', scores: null, evidence: [] } })
  state.history.push({ q: c.question, a: answer.text }); state.ledger = answer.ledger
  states.set(input.key, state)
 } catch (error) {
  records.push({ id: c.id, captureId, round, provenance, status: 'failed', error: error.message, elapsedMs: Date.now()-began })
  await saveCheckpoint(destination, records)
  await writeManifest('failed', 'answer')
  throw error
 }
 await saveCheckpoint(destination, records)
 console.log(`Captured ${records.length}/${cases.length}; quality review pending`)
}

const summary = captureSummary(cases, records)
if (summary.status !== 'capture-complete') throw Error('Incomplete capture; no completion manifest written')
await saveCheckpoint(manifestPath, { ...buildManifest({ status: summary.status, stage: 'answers', round: Number(round), fixture, caseCount: cases.length, records, hashes, code, completedAt: new Date().toISOString() }), provenance, ...summary })
