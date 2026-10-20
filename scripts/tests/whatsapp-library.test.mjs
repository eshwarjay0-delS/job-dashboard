// The WhatsApp bot starting from the person's Files again (owner, 19 Oct 2026): a job description, "which email is it
// for?", "1", the AI agent's pick from that email's folders (its email read once more from the file), the resume made
// from it, filed back in Files in the folder for its kind of job, the pick logged and counted; "redo"; and a job made
// before sent again with no new run. The bot runs with stand-ins for storage, the AI and WhatsApp.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}, extra = '') {
  const module = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8') + extra
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, console, Buffer, setTimeout,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
}

const pick = load('src/lib/library-pick.ts')
const USERS = path.join('/data', 'user-resumes')
const USER_DIR = path.join(USERS, 'user1')
const SOC = path.join(USER_DIR, 'a@x.com', 'SOC Analyst', 'SOC.docx')
const APPSEC = path.join(USER_DIR, 'a@x.com', 'AppSec Engineer', 'AppSec.docx')
const JD = 'Application Security Engineer. You will run threat modeling, Burp Suite testing and OWASP Top 10 reviews for our web apps.'

function bot({ agent = { index: 0, why: 'same kind of role', by: 'gemini' }, have = null, sure = true, extra = [], hold = null } = {}) {
  process.env.WHATSAPP_PAIR_WAIT_MS = '0'
  const store = new Map()
  const said = [], docs = [], saved = [], used = [], logs = [], runs = [], events = [], uploads = []
  const blob = {
    getText: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v) }, delete: async k => { store.delete(k) },
    putIfAbsent: async (k, v) => { if (store.has(k)) return false; store.set(k, v); return true },
    get: async k => (k.startsWith('tailored/') ? Buffer.from('a@x.com tailored resume') : null),
  }
  const mocks = {
    'next/server': {},
    '@/lib/storage': { blob, readPath: async p => (p === SOC || p === APPSEC || String(p).includes('inbox') ? Buffer.from(`resume of a@x.com at ${p}`) : null), writePath: async () => {}, existsPath: async () => true, deletePath: async () => {} },
    '@/lib/paths': { DATA_DIR: '/data', USER_RESUMES_DIR: USERS },
    '@/lib/llm': { resolveKeys: () => ({}), hasAnyKey: () => true, keysFor: async () => ({ gemini: 'g' }), tailorKeys: k => k },
    '@/lib/tailor': { runTailor: async o => { runs.push(o); return { token: 't1', score: 100, coverage: 100, quality: { status: 'coverage_met', matched: 3, total: 3, missing: [] }, keyword_analysis: { matched: ['owasp'], added: ['burp suite', 'threat modeling'], missing: [] } } } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Application Security Engineer', company: 'Acme', location: '' }) },
    '@/lib/whatsapp': { sendText: async (to, t) => { said.push(t) }, sendDocument: async (to, f, n, caption) => { docs.push(caption); events.push('delivered'); return 'wamid-' + docs.length }, downloadMedia: async () => Buffer.from('a@x.com uploaded resume') },
    '@/lib/owner': { isOwnerWhatsApp: () => false }, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/resume-identity': { sameResumeIdentity: () => true }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: () => false },
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/library-pick-store': {
      libraryOf: async () => ({ index: {}, counts: { 'a@x.com': 2, 'b@y.com': 1 } }),
      numberedEmails: async () => ({ slots: ['a@x.com', 'b@y.com'], sure }),
      candidatesFor: async () => [
        { path: SOC, email: 'a@x.com', folder: 'SOC Analyst', name: 'SOC', depth: 0, keywords: ['splunk'], at: 1 },
        { path: APPSEC, email: 'a@x.com', folder: 'AppSec Engineer', name: 'AppSec', depth: 0, keywords: ['burp suite', 'owasp'], at: 2 },
        ...extra,
      ],
    },
    '@/lib/library-pick': pick,
    '@/lib/resume-library-store': {
      existingForJob: async () => have,
      saveTailored: async o => { saved.push(o); return { email: 'a@x.com', category: 'AppSec Engineer', abs: path.join(o.userDir, 'a@x.com', 'AppSec Engineer', 'made.docx') } },
      saveUpload: async o => { uploads.push(o); return { abs: path.join(o.userDir, 'a@x.com', 'AppSec Engineer', 'Mine__0123456789abcdef.docx'), folder: 'a@x.com / AppSec Engineer', name: 'Mine', read: true, existed: false } },
      markUsed: async (dir, abs) => { used.push(abs); events.push('counted') },
      readShelf: async () => ({ uses: {} }),
      relOf: (dir, abs) => path.relative(dir, abs).split(path.sep).join('/'),
    },
    '@/lib/resume-library': { jobKeyOf: jd => (jd === JD ? 'job-1' : `job-${String(jd).length}`) },
    '@/lib/library-agent': { agentPick: async () => { if (hold) await hold; return agent }, logPick: async (u, e) => { logs.push(e) } },
    '@/lib/keywords': { extractKeywords: () => ['burp suite', 'owasp'] },
    '@/lib/resumeOrganization': { resumeEmails: t => [...new Set(t.match(/[\w.]+@[\w.]+\.\w+/g) || [])] },
  }
  const wa = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { handle, loadSession };')
  return { wa, store, said, docs, saved, used, logs, runs, events, uploads }
}

test('a job description asks which email; "1" starts from the agent\'s pick in Files and files the result there', async () => {
  const b = bot()
  await b.wa.handle('15550001', { type: 'text', id: 'm1', text: { body: JD } }, {}, 'user1')
  assert.match(b.said.at(-1), /Which email is this job for\?/)
  assert.match(b.said.at(-1), /\*1\*\s+a@x\.com/)
  assert.ok((await b.wa.loadSession('15550001')).pending, 'the job waits for its email')

  await b.wa.handle('15550001', { type: 'text', id: 'm2', text: { body: '1' } }, await b.wa.loadSession('15550001'), 'user1')
  assert.equal(b.runs.length, 1)
  assert.equal(b.runs[0].givenPath, APPSEC, 'the code ranks AppSec first and the agent agreed')
  assert.equal(b.runs[0].userResumeDir, USER_DIR)
  assert.match(b.said.at(-1), /Updating your saved \*AppSec Engineer\* resume/)
  assert.equal(b.saved.length, 1)
  assert.equal(b.saved[0].userDir, USER_DIR)
  assert.equal(b.saved[0].depth, 1, 'made from a resume the person wrote')
  assert.equal(b.saved[0].from, 'a@x.com/AppSec Engineer/AppSec.docx')
  assert.deepEqual([...b.saved[0].asked].sort(), ['burp suite', 'owasp', 'threat modeling'])
  assert.match(b.docs.at(-1), /Saved in your Files: a@x\.com \/ AppSec Engineer/)
  assert.match(b.docs.at(-1), /Started from your saved \*AppSec Engineer\* resume/)
  assert.deepEqual(b.used, [APPSEC], 'the pick is counted in its folder record')
  assert.equal(b.logs.length, 1)
  assert.equal(b.logs[0].agree, true)
  assert.equal(b.logs[0].used, 'a@x.com/AppSec Engineer/AppSec.docx')

  await b.wa.handle('15550001', { type: 'text', id: 'm3', text: { body: 'redo' } }, await b.wa.loadSession('15550001'), 'user1')
  assert.equal(b.runs.length, 2, 'redo makes it again')
})

test('the agent\'s pick is used when it differs from the code\'s, and the disagreement is logged', async () => {
  const b = bot({ agent: { index: 1, why: 'the SOC folder' } })
  await b.wa.handle('15550002', { type: 'text', id: 'm1', text: { body: `${JD}\n1` } }, {}, 'user1')
  assert.equal(b.runs[0].givenPath, SOC, 'a number under the job description answers the question')
  assert.equal(b.logs[0].agree, false)
  assert.equal(b.logs[0].agent, 'a@x.com/SOC Analyst/SOC.docx')
  assert.equal(b.logs[0].code, 'a@x.com/AppSec Engineer/AppSec.docx')
})

test('no agent answer: the code\'s pick stands', async () => {
  const b = bot({ agent: null })
  await b.wa.handle('15550003', { type: 'text', id: 'm1', text: { body: `${JD}\n1` } }, {}, 'user1')
  assert.equal(b.runs[0].givenPath, APPSEC)
  assert.equal(b.logs[0].agree, null)
})

test('a job made before is sent again as it is: no new run, nothing saved', async () => {
  const have = { abs: APPSEC, file: { path: 'a@x.com/AppSec Engineer/AppSec.docx', role: 'Application Security Engineer', company: 'Acme', category: 'AppSec Engineer', at: Date.UTC(2026, 9, 18) } }
  const b = bot({ have })
  await b.wa.handle('15550004', { type: 'text', id: 'm1', text: { body: `${JD}\n1` } }, {}, 'user1')
  assert.equal(b.runs.length, 0)
  assert.equal(b.saved.length, 0)
  assert.match(b.docs.at(-1), /You already have this one/)
  assert.ok((await b.wa.loadSession('15550004')).last, 'redo can make it afresh')
})

// ── Found in review before this shipped (19 Oct 2026) ──
const later = () => { let release; const p = new Promise(r => { release = r }); return { p, release } }
const SESSION = '15550009'

test('the email question answered by swipe-reply is an answer, not a change request', async () => {
  const b = bot()
  await b.wa.handle(SESSION, { type: 'text', id: 'm1', text: { body: JD } }, {}, 'user1')
  await b.wa.handle(SESSION, { type: 'text', id: 'm2', text: { body: '1' }, context: { id: 'wamid-question' } }, await b.wa.loadSession(SESSION), 'user1')
  assert.equal(b.runs.length, 1)
})

test('after a job made before is resent, a resume sent alone is never fitted to that old job description', async () => {
  const have = { abs: APPSEC, file: { path: 'a@x.com/AppSec Engineer/AppSec.docx', role: 'r', company: 'c', category: 'AppSec Engineer', at: 1, depth: 1 } }
  const b = bot({ have })
  await b.wa.handle(SESSION, { type: 'text', id: 'm1', text: { body: JD } }, {}, 'user1')
  await b.wa.handle(SESSION, { type: 'text', id: 'm2', text: { body: '1' } }, await b.wa.loadSession(SESSION), 'user1')
  assert.match(b.docs.at(-1), /You already have this one/)
  await b.wa.handle(SESSION, { type: 'document', id: 'm3', document: { id: 'd1', filename: 'Other.docx' } }, await b.wa.loadSession(SESSION), 'user1')
  assert.equal(b.runs.length, 0)
  assert.match(b.said.at(-1), /Now paste the job description/)
})

test('a number under the job description is not trusted when the kept numbering could not be read', async () => {
  const b = bot({ sure: false })
  await b.wa.handle(SESSION, { type: 'text', id: 'm1', text: { body: `${JD}
1` } }, {}, 'user1')
  assert.equal(b.runs.length, 0)
  assert.match(b.said.at(-1), /Which email is this job for\?/)
})

test('redo starts again from what the person wrote, never from the resume made for this job, and skips the kept result', async () => {
  const MADE = path.join(USER_DIR, 'a@x.com', 'AppSec Engineer', 'AppSec (tailored)__0123456789abcdef.docx')
  const b = bot({ extra: [{ path: MADE, email: 'a@x.com', folder: 'AppSec Engineer', name: 'AppSec made', depth: 1, keywords: ['burp suite', 'owasp', 'threat modeling'], at: 3, job: 'job-1' }] })
  await b.wa.handle(SESSION, { type: 'text', id: 'm1', text: { body: `${JD}
1` } }, {}, 'user1')
  await b.wa.handle(SESSION, { type: 'text', id: 'm2', text: { body: 'redo' } }, await b.wa.loadSession(SESSION), 'user1')
  assert.equal(b.runs.length, 2)
  assert.notEqual(b.runs[1].givenPath, MADE)
  assert.equal(b.runs[1].noCache, true)
  assert.equal(b.saved[1].depth, 1)
})

test('a message that arrives while a job is being picked is kept, and the same job is never made twice at once', async () => {
  const gate = later()
  const b = bot({ hold: gate.p })
  const first = b.wa.handle(SESSION, { type: 'text', id: 'm1', text: { body: `${JD}
1` } }, {}, 'user1')
  await new Promise(r => setTimeout(r, 20))
  // The same job pasted again while the first is being picked: told it is on its way, not made twice.
  await b.wa.handle(SESSION, { type: 'text', id: 'm2', text: { body: `${JD}
1` } }, await b.wa.loadSession(SESSION), 'user1')
  assert.match(b.said.at(-1), /already making the resume for this job/)
  // Another job description meanwhile, with no number: it starts from the email just chosen, without asking again
  // (19 Oct 2026: asked once, then remembered).
  const other = 'Cloud Security Engineer for AWS guardrails, IAM reviews, GuardDuty triage and Terraform policy as code.'
  const third = b.wa.handle(SESSION, { type: 'text', id: 'm3', text: { body: other } }, await b.wa.loadSession(SESSION), 'user1')
  await new Promise(r => setTimeout(r, 20))
  assert.equal(b.said.filter(t => /^On it: starting from your \*a@x\.com\* resumes\.\n_Wrong email\? Reply \*use 2\* for b@y\.com\._$/.test(t)).length, 2,
    'each job taken says its email and how to switch; the copy already being made says nothing of the kind')
  gate.release()
  await first
  await third
  assert.equal(b.runs.length, 2, 'two different jobs, each made once')
  const now = await b.wa.loadSession(SESSION)
  assert.equal(now.pending, undefined, 'nothing was asked: the email was remembered')
  assert.equal(now.last?.email, 'a@x.com')
  // The two runs interleave; each pick is counted only after a resume went out, never before.
  assert.deepEqual([...b.events].sort(), ['counted', 'counted', 'delivered', 'delivered'])
  assert.equal(b.events[0], 'delivered', 'a pick is counted once its resume is delivered')
})

test('asked once, then remembered: the next job starts at once from that email, and "use 2" switches it', async () => {
  const b = bot()
  const N = '15550007'
  await b.wa.handle(N, { type: 'text', id: 'm1', text: { body: JD } }, {}, 'user1')
  assert.match(b.said.at(-1), /Which email is this job for\?/, 'never picked: asked, not the first email silently')
  await b.wa.handle(N, { type: 'text', id: 'm2', text: { body: '1' } }, await b.wa.loadSession(N), 'user1')
  assert.equal(b.runs.length, 1)
  const other = 'Cloud Security Engineer for AWS guardrails, IAM reviews, GuardDuty triage and Terraform policy as code.'
  await b.wa.handle(N, { type: 'text', id: 'm3', text: { body: other } }, await b.wa.loadSession(N), 'user1')
  assert.equal(b.runs.length, 2, 'the second job is not asked about')
  assert.ok(b.said.some(t => t.startsWith('On it: starting from your *a@x.com* resumes.')))

  await b.wa.handle(N, { type: 'text', id: 'm4', text: { body: 'use 2' } }, await b.wa.loadSession(N), 'user1')
  assert.match(b.said.at(-1), /every job now starts from your \*b@y\.com\* resumes/)
  assert.equal((await b.wa.loadSession(N)).last?.email, 'b@y.com')
  // The next job goes to b@y.com: it holds no resume in this stand-in, which the bot says plainly.
  await b.wa.handle(N, { type: 'text', id: 'm5', text: { body: `${other} Also Wiz and Prisma Cloud.` } }, await b.wa.loadSession(N), 'user1')
  assert.ok(b.said.some(t => t.startsWith('On it: starting from your *b@y.com* resumes.')))
  assert.match(b.said.at(-1), /no resume of \*b@y\.com\*/)
  assert.equal(b.runs.length, 2)

  // A number under the job description wins for that job and is remembered.
  await b.wa.handle(N, { type: 'text', id: 'm6', text: { body: `${other} Kubernetes too.\n1` } }, await b.wa.loadSession(N), 'user1')
  assert.equal(b.runs.length, 3)
  assert.equal((await b.wa.loadSession(N)).last?.email, 'a@x.com')
})

test('a resume sent with the job post is filed in Files once, and what is made from it is filed beside it', async () => {
  const ACCOUNT = '0f8fad5b-d9cb-469f-a165-70867728950e'
  const b = bot()
  await b.wa.handle(SESSION, { type: 'document', id: 'm1', document: { id: 'd1', filename: 'Mine.docx' } }, {}, ACCOUNT)
  await b.wa.handle(SESSION, { type: 'text', id: 'm2', text: { body: JD } }, await b.wa.loadSession(SESSION), ACCOUNT)
  const MY_FILES = path.join(USERS, ACCOUNT)
  assert.equal(b.uploads.length, 1)
  assert.equal(b.uploads[0].userDir, MY_FILES)
  assert.equal(b.runs.at(-1).userResumeDir.includes('inbox'), true, 'the run itself uses the inbox copy')
  const made = b.saved.at(-1)
  assert.equal(made.userDir, MY_FILES)
  assert.equal(made.depth, 1)
  assert.equal(made.from, 'a@x.com/AppSec Engineer/Mine__0123456789abcdef.docx')
  assert.match(b.docs.at(-1), /Saved in your Files: a@x\.com \/ AppSec Engineer/)
})

test('the shared default bot user files nothing', async () => {
  const b = bot()
  await b.wa.handle(SESSION, { type: 'text', id: 'm1', text: { body: JD } }, {}, 'demo')
  await b.wa.handle(SESSION, { type: 'document', id: 'm2', document: { id: 'd1', filename: 'Mine.docx' } }, await b.wa.loadSession(SESSION), 'demo')
  assert.equal(b.uploads.length, 0)
})
