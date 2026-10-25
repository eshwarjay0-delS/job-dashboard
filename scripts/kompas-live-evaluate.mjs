// Run one reviewed evaluation round against the real authenticated Kompas API.
// Private source bundles and outputs must stay outside the repository.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { saveCheckpoint } from './lib/evaluation-checkpoint.mjs'
const FIXTURES = {
 'interview-50': new URL('./fixtures/kompas-evaluation/interview-50.json', import.meta.url),
 'intent-acceptance-v1': new URL('./fixtures/kompas-evaluation/intent-acceptance-v1.json', import.meta.url),
}
const REVIEWED_HISTORY = new Set(['intro-repeat', 'drilldown'])
const [sourcesFile, outputDir, round = '1', fixtureName = 'interview-50'] = process.argv.slice(2)
if (!sourcesFile || !outputDir) throw Error('Usage: node scripts/kompas-live-evaluate.mjs SOURCES.json PRIVATE_OUTPUT_DIR ROUND [interview-50|intent-acceptance-v1]')
if (!/^[1-9]\d*$/.test(round)) throw Error('Round must be a positive integer')
if (!Object.hasOwn(FIXTURES, fixtureName)) throw Error(`Unknown evaluation fixture ${fixtureName}; zero model calls made.`)
const token = process.env.KOMPAS_API_TOKEN
if (!token) throw Error('KOMPAS_API_TOKEN is not configured; zero model calls made.')
const origin = new URL(process.env.KOMPAS_BASE_URL || 'https://job-dashboard-fawn.vercel.app')
if (origin.protocol !== 'https:') throw Error('HTTPS required')
const cases = JSON.parse(await readFile(FIXTURES[fixtureName]))
const sources = JSON.parse(await readFile(sourcesFile, 'utf8'))
for (const c of cases) {
 const supplemental = fixtureName === 'intent-acceptance-v1'
 if (supplemental && (!c.category || c.chain)) throw Error(`Intent case ${c.id} must be category-scoped and chain-free; zero model calls made.`)
 if (!supplemental && (c.category || !c.chain)) throw Error(`Baseline case ${c.id} must stay on its chain; zero model calls made.`)
 const bundle = sources?.[supplemental ? c.id : c.chain]
 const label = supplemental ? c.id : c.chain
 if (!['resume', 'jd'].every(key => typeof bundle?.[key] === 'string' && bundle[key].trim())) throw Error(`Missing approved resume/JD bundle for ${label}; zero model calls made.`)
 if (!supplemental) continue
 const reviewed = REVIEWED_HISTORY.has(c.category)
 if (reviewed) {
  const turns = bundle.history
  if (!Array.isArray(turns) || turns.length === 0 || turns.some(turn => typeof turn?.q !== 'string' || !turn.q.trim() || typeof turn?.a !== 'string' || !turn.a.trim())) throw Error(`Missing explicit reviewed history for ${c.id}; zero model calls made.`)
  if (bundle.ledger != null && (typeof bundle.ledger !== 'object' || Array.isArray(bundle.ledger))) throw Error(`Reviewed ledger for ${c.id} must be an object; zero model calls made.`)
 } else if (bundle.history != null || bundle.ledger != null) throw Error(`Isolated case ${c.id} must not include prior history; zero model calls made.`)
}
await mkdir(outputDir, { recursive: true, mode: 0o700 })
const destination = path.join(outputDir, `round-${round}.json`)
// Exclusive creation prevents an accidental rerun from overwriting evaluation evidence.
await writeFile(destination, '[]\n', { flag: 'wx', mode: 0o600 })
const records = [], states = new Map()
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
 await saveCheckpoint(destination, [{ round, fixture: fixtureName, stage: 'preflight', status: 'failed', error: error.message }])
 throw error
}
for (const c of cases) {
 const supplemental = Boolean(c.category)
 const bundle = sources[supplemental ? c.id : c.chain]
 const { history: reviewedHistory, ledger: reviewedLedger, ...grounding } = bundle
 const state = states.get(c.chain) || { history: [], ledger: undefined }
 const history = supplemental ? (REVIEWED_HISTORY.has(c.category) ? reviewedHistory : []) : state.history
 const ledger = supplemental ? (REVIEWED_HISTORY.has(c.category) ? reviewedLedger : undefined) : state.ledger
 const began = Date.now()
 try {
  const answer = await request({ question: c.question, stream: false, pinned: true,
   config: { ...grounding, level: c.level, interviewer: c.level, responseCalibration: 'three-level-v1' },
   history, ledger,
  })
  if (!answer.text?.trim() || answer.degraded || !answer.meta?.model) throw Error('Missing actual model answer or degraded response')
  records.push({ id: c.id, round, fixture: fixtureName, category: c.category, question: c.question, level: c.level, criteria: c.criteria,
   historyMode: supplemental ? (REVIEWED_HISTORY.has(c.category) ? 'reviewed' : 'isolated') : 'chain', historyTurns: history.length,
   text: answer.text, meta: answer.meta, elapsedMs: Date.now()-began,
   words: answer.text.trim().split(/\s+/).length, review: { status: 'pending', scores: null, evidence: [] } })
  if (!supplemental) {
   state.history.push({ q: c.question, a: answer.text }); state.ledger = answer.ledger
   states.set(c.chain, state)
  }
 } catch (error) {
  records.push({ id: c.id, round, fixture: fixtureName, status: 'failed', error: error.message, elapsedMs: Date.now()-began })
  await saveCheckpoint(destination, records)
  throw error
 }
 await saveCheckpoint(destination, records)
 console.log(`Captured ${records.length}/${cases.length}; quality review pending`)
}
