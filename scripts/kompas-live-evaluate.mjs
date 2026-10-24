// Run one reviewed evaluation round against the real authenticated Kompas API.
// Private source bundles and outputs must stay outside the repository.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { saveCheckpoint } from './lib/evaluation-checkpoint.mjs'
const [sourcesFile, outputDir, round = '1'] = process.argv.slice(2)
if (!sourcesFile || !outputDir) throw Error('Usage: node scripts/kompas-live-evaluate.mjs SOURCES.json PRIVATE_OUTPUT_DIR ROUND')
if (!/^[1-9]\d*$/.test(round)) throw Error('Round must be a positive integer')
const token = process.env.KOMPAS_API_TOKEN
if (!token) throw Error('KOMPAS_API_TOKEN is not configured; zero model calls made.')
const origin = new URL(process.env.KOMPAS_BASE_URL || 'https://job-dashboard-fawn.vercel.app')
if (origin.protocol !== 'https:') throw Error('HTTPS required')
const cases = JSON.parse(await readFile(new URL('./fixtures/kompas-evaluation/interview-50.json', import.meta.url)))
const sources = JSON.parse(await readFile(sourcesFile, 'utf8'))
for (const c of cases) {
 if (!['resume', 'jd'].every(key => typeof sources[c.chain]?.[key] === 'string' && sources[c.chain][key].trim())) throw Error(`Missing approved resume/JD bundle for ${c.chain}; zero model calls made.`)
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
 await saveCheckpoint(destination, [{ round, stage: 'preflight', status: 'failed', error: error.message }])
 throw error
}
for (const c of cases) {
 const state = states.get(c.chain) || { history: [], ledger: undefined }
 const began = Date.now()
 try {
  const answer = await request({ question: c.question, stream: false, pinned: true,
   config: { ...sources[c.chain], level: c.level, interviewer: c.level, responseCalibration: 'three-level-v1' },
   history: state.history, ledger: state.ledger,
  })
  if (!answer.text?.trim() || answer.degraded || !answer.meta?.model) throw Error('Missing actual model answer or degraded response')
  records.push({ id: c.id, round, question: c.question, level: c.level, criteria: c.criteria,
   text: answer.text, meta: answer.meta, elapsedMs: Date.now()-began,
   words: answer.text.trim().split(/\s+/).length, review: { status: 'pending', scores: null, evidence: [] } })
  state.history.push({ q: c.question, a: answer.text }); state.ledger = answer.ledger
  states.set(c.chain, state)
 } catch (error) {
  records.push({ id: c.id, round, status: 'failed', error: error.message, elapsedMs: Date.now()-began })
  await saveCheckpoint(destination, records)
  throw error
 }
 await saveCheckpoint(destination, records)
 console.log(`Captured ${records.length}/${cases.length}; quality review pending`)
}
