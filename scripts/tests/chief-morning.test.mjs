// The Chief's 7am report (src/lib/chief-morning.ts): real code, mocked storage and watchdog.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8')
function load(file, mocks = {}) {
  const module = { exports: {} }
  runInNewContext(ts.transpileModule(read(file), { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, console, JSON, Date,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
}

const store = new Map()
const blob = {
  getText: async k => (store.has(k) ? store.get(k) : null),
  put: async (k, v) => { store.set(k, v) },
  list: async p => [...store.keys()].filter(k => k.startsWith(p)),
}
let findings = []
const M = load('src/lib/chief-morning.ts', {
  '@/lib/storage': { blob },
  '@/lib/agent/watchdog-checks': { runChecks: () => findings },
  '@/lib/chief-guard': load('src/lib/chief-guard.ts'),
})

const NOW = Date.UTC(2026, 9, 23, 12, 0)
const H = 3_600_000
const plain = v => JSON.parse(JSON.stringify(v))
const msg = (category, hoursAgo, extra = {}) => ({ category, internalDate: String(NOW - hoursAgo * H), from: 'Ann <ann@vendor-a.test>', vendor: 'Vendor A', subject: 'Role', jobTitle: 'Security Engineer', ...extra })
const thread = (...messages) => ({ messages })

test('the report lists what needs his call, the risks and the quiet threads, and never claims a send', () => {
  findings = [{ check: 'duplicate-chains', title: 'Possible duplicate submission: Security Engineer' }]
  const threads = [
    thread(msg('Interview Request', 3)),
    thread(msg('Rate Confirmation', 5, { vendor: 'Vendor B' })),
    thread(msg('Sales Pitch', 2, { vendor: 'Spam Co' })),
    thread(msg('Submission Confirmation', 24 * 9, { vendor: 'Vendor C' })),
  ]
  const r = M.buildMorning({ threads, now: NOW })
  assert.deepEqual(plain(r.funnel), { inboxNew: 3, worth: 2, needCalls: 2, chains: 2, risks: 1 })
  assert.equal(r.quiet.length, 1)
  const text = M.morningText(r, 2)
  assert.match(text, /interview invite — Vendor A: Security Engineer/)
  assert.match(text, /rate confirmation — Vendor B/)
  assert.match(text, /call one before anyone files/)
  assert.match(text, /quiet 9 days/)
  assert.match(text, /2 drafts still wait on your Send, Edit or Skip/)
  assert.match(text, /→ 0 sent without you\./)
  assert.match(text, /Apply: new matches are not in this report yet\./)
  assert.doesNotMatch(text, /Nothing needs you/)
})

test('a never-contact vendor is left out of the quiet threads', () => {
  findings = []
  const threads = [thread(msg('Submission Confirmation', 24 * 10, { vendor: 'Barred Staffing', from: 'x@barred.test' }))]
  assert.equal(M.buildMorning({ threads, now: NOW, neverContact: ['barred.test'] }).quiet.length, 0)
  assert.equal(M.buildMorning({ threads, now: NOW }).quiet.length, 1)
})

test('a quiet night says so plainly', () => {
  findings = []
  const text = M.morningText(M.buildMorning({ threads: [], now: NOW }))
  assert.match(text, /Nothing needs you this morning\./)
  assert.match(text, /Inbox: 0 new/)
})

test('the report is off until he turns it on, and off again on "morning off"', async () => {
  assert.equal(await M.morningOn('u1'), false)
  assert.deepEqual(plain(await M.morningUsers()), [])
  await M.setMorning('u1', true)
  assert.equal(await M.morningOn('u1'), true)
  assert.deepEqual(plain(await M.morningUsers()), ['u1'])
  await M.setMorning('u1', false)
  assert.deepEqual(plain(await M.morningUsers()), [])
})

test('only the exact words reach the report, not a message that starts with "good morning"', () => {
  for (const t of ['morning', 'Morning on', 'morning off', 'morning report on', 'morning?']) assert.ok(M.MORNING_WORDS.test(t), t)
  for (const t of ['good morning', 'morning, I applied to the Richmond role', 'mornings are best']) assert.ok(!M.MORNING_WORDS.test(t), t)
  const hook = read('src/app/api/whatsapp/webhook/route.ts').match(/const CHIEF_WORDS = (\/.*\/i)/)[1]
  const words = eval(hook)
  assert.ok(words.test('morning on'))
  assert.ok(!words.test('morning, here is the JD for the Richmond role and the rest of the post'))
})

test('the 7am run is scheduled, and closed without the deployment secret', () => {
  const crons = JSON.parse(read('vercel.json')).crons
  assert.ok(crons.some(c => c.path === '/api/chief/morning' && c.schedule === '13 12 * * *'))
  assert.match(read('src/app/api/chief/morning/route.ts'), /secret\.length < 16 \|\|/)
})
