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
  const testModule = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8') + extra
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: testModule, exports: testModule.exports, process, console, Buffer, setTimeout,
    require: id => id in mocks ? mocks[id] : require(id),
    clearTimeout,
  })
  return testModule.exports
}

const pick = load('src/lib/library-pick.ts')
const roles = load('src/lib/role-match.ts')
const USERS = path.join('/data', 'user-resumes')
const USER_DIR = path.join(USERS, 'user1')
const SOC = path.join(USER_DIR, 'a@x.com', 'SOC Analyst', 'SOC.docx')
const APPSEC = path.join(USER_DIR, 'a@x.com', 'AppSec Engineer', 'AppSec.docx')
const JD = 'Application Security Engineer. You will run threat modeling, Burp Suite testing and OWASP Top 10 reviews for our web apps.'

function bot({ agent = { index: 0, why: 'same kind of role', by: 'gemini' }, have = null, sure = true, extra = [], hold = null, floorOk = true, kompasConsumes = false } = {}) {
  process.env.WHATSAPP_PAIR_WAIT_MS = '0'
  const store = new Map()
  const said = [], docs = [], saved = [], used = [], logs = [], runs = [], events = [], uploads = [], channelCalls = []
  const blob = {
    getText: async k => store.get(k) ?? null, put: async (k, v) => { store.set(k, v) }, delete: async k => { store.delete(k) },
    putIfAbsent: async (k, v) => { if (store.has(k)) return false; store.set(k, v); return true },
    get: async k => (k.startsWith('tailored/') ? Buffer.from('a@x.com tailored resume') : null),
  }
  const mocks = {
    // These cases exercise resume tailoring; channel transport has its own acceptance suite.
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async input => { channelCalls.push(input); return kompasConsumes } },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('Unexpected voice transcription in tailoring test') } },
    'next/server': {},
    '@/lib/storage': { blob, readPath: async p => (p === SOC || p === APPSEC || extra.some(e => e.path === p) || String(p).includes('inbox') ? Buffer.from(`resume of a@x.com at ${p}`) : null), writePath: async () => {}, existsPath: async () => true, deletePath: async () => {} },
    '@/lib/paths': { DATA_DIR: '/data', USER_RESUMES_DIR: USERS },
    '@/lib/llm': { resolveKeys: () => ({}), hasAnyKey: () => true, keysFor: async () => ({ gemini: 'g' }), tailorKeys: k => k },
    '@/lib/tailor': { runTailor: async o => { runs.push(o); return { token: 't1', score: 100, coverage: 100, supported_coverage: 100, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'coverage_met', matched: 3, total: 3, missing: [] }, keyword_analysis: { matched: ['owasp'], added: ['burp suite', 'threat modeling'], missing: [] } } } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Application Security Engineer', company: 'Acme', location: '' }) },
    '@/lib/whatsapp': { sendText: async (to, t) => { said.push(t) }, sendDocument: async (to, f, n, caption) => { docs.push(caption); events.push('delivered'); return 'wamid-' + docs.length }, downloadMedia: async () => Buffer.from('a@x.com uploaded resume') },
    '@/lib/owner': { isOwnerWhatsApp: () => false }, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/resume-identity': { sameResumeIdentity: () => true }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: () => false },
    '@/lib/whatsapp-trace': { trace: () => {} },
    // Delivery callbacks for inbox alerts (538d77d3, 22 Oct); no status callback is sent here.
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
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
    '@/lib/role-match': roles,
    '@/lib/chief-approvals': {},
    '@/lib/resume-library-store': {
      existingForJob: async () => have,
      saveTailored: async o => { saved.push(o); return { email: 'a@x.com', category: 'AppSec Engineer', abs: path.join(o.userDir, 'a@x.com', 'AppSec Engineer', 'made.docx') } },
      saveUpload: async o => { uploads.push(o); return { abs: path.join(o.userDir, 'a@x.com', 'AppSec Engineer', 'Mine__0123456789abcdef.docx'), folder: 'a@x.com / AppSec Engineer', name: 'Mine', read: true, existed: false } },
      markUsed: async (dir, abs) => { used.push(abs); events.push('counted') },
      readShelf: async () => ({ uses: {} }),
      relOf: (dir, abs) => path.relative(dir, abs).split(path.sep).join('/'),
    },
    // Whether a resume made earlier for the job still meets the 90% floor (src/lib/made-floor.ts, 26 Oct 2026).
    '@/lib/made-floor': { madeMeetsFloor: async () => floorOk },
    '@/lib/whatsapp-resume-acceptance': load('src/lib/whatsapp-resume-acceptance.ts'),
    '@/lib/whatsapp-resume-recovery': {
      enqueueResumeRecovery: async input => ({ ...input, status: 'pending' }),
      patchResumeRecovery: async () => {},
      deferResumeRecovery: async () => {},
      dueResumeRecoveries: async () => [],
      markResumeDocumentAccepted: async () => true,
      recordResumeDeliveryStatus: async () => {},
      readResumeRecovery: async () => null,
    },
    '@/lib/resume-library': { jobKeyOf: jd => (jd === JD ? 'job-1' : `job-${String(jd).length}`) },
    '@/lib/library-agent': { agentPick: async () => { if (hold) await hold; return agent }, logPick: async (u, e) => { logs.push(e) }, readPicks: async (u, n = 50) => logs.slice(-n).reverse() },
    '@/lib/keywords': { extractKeywords: () => ['burp suite', 'owasp'] },
    '@/lib/resumeOrganization': { resumeEmails: t => [...new Set(t.match(/[\w.]+@[\w.]+\.\w+/g) || [])] },
  }
  // The choice of resume is its own module, shared with Apply on the website: it runs for real over the same stand-ins.
  mocks['@/lib/library-choose'] = load('src/lib/library-choose.ts', mocks)
  const wa = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { handle, loadSession };')
  return { wa, store, said, docs, saved, used, logs, runs, events, uploads, channelCalls }
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
  assert.match(b.said.at(-1), /Updating your \*AppSec\* resume \(in AppSec Engineer\)\. I chose it because its title matches the job's role: Application Security Engineer/)
  assert.equal(b.saved.length, 1)
  assert.equal(b.saved[0].userDir, USER_DIR)
  assert.equal(b.saved[0].depth, 1, 'made from a resume the person wrote')
  assert.equal(b.saved[0].from, 'a@x.com/AppSec Engineer/AppSec.docx')
  assert.deepEqual([...b.saved[0].asked].sort(), ['burp suite', 'owasp', 'threat modeling'])
  assert.match(b.docs.at(-1), /Saved in your Files: a@x\.com \/ AppSec Engineer/)
  assert.match(b.docs.at(-1), /Started from your \*AppSec\* resume \(in AppSec Engineer\)/)
  assert.deepEqual(b.used, [APPSEC], 'the pick is counted in its folder record')
  assert.equal(b.logs.length, 1)
  assert.equal(b.logs[0].agree, true)
  assert.equal(b.logs[0].used, 'a@x.com/AppSec Engineer/AppSec.docx')

  await b.wa.handle('15550001', { type: 'text', id: 'm3', text: { body: 'redo' } }, await b.wa.loadSession('15550001'), 'user1')
  assert.equal(b.runs.length, 2, 'redo makes it again')
})

// Two resumes titled for the job: the niche between them is the agent's to choose (the title came first).
const AS1 = path.join(USER_DIR, 'a@x.com', 'AppSec Engineer', 'AppSec Web.docx')
const AS2 = path.join(USER_DIR, 'a@x.com', 'AppSec Engineer', 'AppSec Cloud.docx')
const titled = (p, name, keywords, at) => ({ path: p, email: 'a@x.com', folder: 'AppSec Engineer', name, title: 'Application Security Engineer', depth: 0, keywords, at })

test('the agent\'s pick is used when it differs from the code\'s, and the disagreement is logged', async () => {
  const b = bot({ agent: { index: 1, why: 'the cloud one' }, extra: [titled(AS1, 'AppSec Web', ['burp suite', 'owasp'], 3), titled(AS2, 'AppSec Cloud', ['aws'], 4)] })
  await b.wa.handle('15550002', { type: 'text', id: 'm1', text: { body: `${JD}\n1` } }, {}, 'user1')
  assert.equal(b.runs[0].givenPath, AS2, 'a number under the job description answers the question; the agent chose between the two titled for it')
  assert.equal(b.logs[0].agree, false)
  assert.equal(b.logs[0].agent, 'a@x.com/AppSec Engineer/AppSec Cloud.docx')
  assert.equal(b.logs[0].code, 'a@x.com/AppSec Engineer/AppSec Web.docx')
  assert.equal(b.logs[0].titled, 2)
})

// The post from the screenshot of 20 Oct 2026: a recruiter's mail for a "Security Analyst" whose skills read like a
// software job. It started from an AI/AppSec resume, then (asked again) from one in the Identity folder.
const POST = `Hi,

I'm an I.T. recruiter at InfoPeople Corp.

The client is looking for a extremely skilled Security Analyst. The position is located in New York, NY.

Role: Security Analyst
Location: New York, NY (Hybrid)
Duration: 12 Months

Technical skills
- Must possess basic knowledge of EC2, Elastic Beanstalk, CloudWatch, Docker, ActiveMQ, RDS/Postgres, Firebase and Sentry.
- Must possess knowledge of languages including Java, Kotlin and SQL.`
const CYBER = path.join(USER_DIR, 'a@x.com', 'Identity and Access Management', 'Cyber Security Analyst.docx')
const AI_APPSEC = path.join(USER_DIR, 'a@x.com', 'AI Security and Governance', 'AI plus AppSec.docx')
const library = () => [
  { path: AI_APPSEC, email: 'a@x.com', folder: 'AI Security and Governance', name: 'AI plus AppSec', title: 'AI Security Engineer', depth: 0, keywords: ['burp suite', 'owasp'], at: 9 },
  { path: CYBER, email: 'a@x.com', folder: 'Identity and Access Management', name: 'Cyber Security Analyst', depth: 0, keywords: ['splunk'], at: 5 },
]

test('a "Security Analyst" post starts from the resume titled for it, not the one with the most keywords or the right folder', async () => {
  const b = bot({ agent: null, extra: library() })
  await b.wa.handle('15550010', { type: 'text', id: 'm1', text: { body: `${POST}\n1` } }, {}, 'user1')
  assert.equal(b.runs[0].givenPath, CYBER, 'the AI/AppSec resume shows more of the keywords and was picked before; its title is not the role')
  assert.match(b.said.at(-1), /Updating your \*Cyber Security Analyst\* resume \(in Identity and Access Management\)\. I chose it because its title matches the job's role: Security Analyst/)
  assert.equal(b.logs[0].role, 'Security Analyst')
  assert.equal(b.logs[0].titled, 1)
})

test('"Make another one with selecting Cybersecurity Analyst resume" is an instruction about the last job, not a new job post', async () => {
  const b = bot({ agent: null, extra: library() })
  const N = '15550011'
  // First go: no resume is titled for it, so the post starts from the one with the most keywords, as before.
  await b.wa.handle(N, { type: 'text', id: 'm1', text: { body: `${JD}\n1` } }, {}, 'user1')
  const first = b.runs.length
  const said = 'Make another one with selecting Cybersecurity Analyst resume'
  assert.equal(said.length, 60)
  await b.wa.handle(N, { type: 'text', id: 'm2', text: { body: said } }, await b.wa.loadSession(N), 'user1')
  assert.equal(b.runs.length, first + 1, 'one more resume')
  assert.equal(b.runs.at(-1).givenPath, CYBER, 'from the resume named')
  assert.equal(b.runs.at(-1).jd, JD, 'for the job post, never for the instruction')
  assert.equal(b.runs.at(-1).noCache, true)
  assert.match(b.said.join('\n'), /I chose it because you asked for it/)
  assert.ok(!b.said.some(t => /Got the job description|which email/i.test(t)))
  assert.equal((await b.wa.loadSession(N)).jd, undefined, 'the instruction did not replace the post')
  assert.equal(b.logs.at(-1).hint, 'Cybersecurity Analyst')

  // The file already made for this job must not be sent back when another base resume was named.
  const again = bot({ have: { abs: APPSEC, file: { path: 'a@x.com/AppSec Engineer/AppSec.docx', role: 'Application Security Engineer', company: 'Acme', category: 'AppSec Engineer', at: Date.UTC(2026, 9, 19) } }, extra: library(), agent: null })
  await again.wa.handle(N, { type: 'text', id: 'm9', text: { body: `${JD}\n1` } }, {}, 'user1')
  assert.match(again.docs.at(-1), /You already have this one/)
  await again.wa.handle(N, { type: 'text', id: 'm10', text: { body: said } }, await again.wa.loadSession(N), 'user1')
  assert.equal(again.runs.at(-1).givenPath, CYBER, 'the named resume, not the Identity folder stand-in')
  assert.equal(again.runs.at(-1).jd, JD)
  assert.equal(again.docs.filter(d => /You already have this one/.test(d)).length, 1)

  // "Another one" with no name: not the resume the last go started from.
  await b.wa.handle(N, { type: 'text', id: 'm3', text: { body: 'make another one' } }, await b.wa.loadSession(N), 'user1')
  assert.equal(b.runs.length, first + 2)
  assert.notEqual(b.runs.at(-1).givenPath, CYBER)
  assert.match(b.said.join('\n'), /as another one, because you asked for a different resume|I chose it because its title/)

  // A name that matches nothing: said, with what there is; nothing is made.
  const before = b.runs.length
  await b.wa.handle(N, { type: 'text', id: 'm4', text: { body: 'use the Kubernetes Platform resume' } }, await b.wa.loadSession(N), 'user1')
  assert.equal(b.runs.length, before)
  assert.match(b.said.at(-1), /I could not find a resume called \*Kubernetes Platform\* under a@x\.com\. Your resumes there: .*\*Cyber Security Analyst\*/)
})

test('before any job, an instruction asks for the job post; a post that ends with "use the X resume" carries the name', async () => {
  const b = bot({ agent: null, extra: library() })
  await b.wa.handle('15550012', { type: 'text', id: 'm1', text: { body: 'Make another one with selecting Cybersecurity Analyst resume' } }, {}, 'user1')
  assert.match(b.said.at(-1), /Send me the job description first/)
  assert.equal(b.runs.length, 0)

  await b.wa.handle('15550013', { type: 'text', id: 'm1', text: { body: `${POST}\n1\nuse the AI Security Engineer resume` } }, {}, 'user1')
  // The last line is read first (the name), then "1" under the post is the email.
  assert.equal(b.runs[0].givenPath, AI_APPSEC)
  assert.equal(b.runs[0].jd, POST)
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

test('a job made before below the 90% floor is made again, not sent again (owner, 26 Oct 2026: "the baseline is serve atleast 90% match")', async () => {
  const have = { abs: APPSEC, file: { path: 'a@x.com/AppSec Engineer/AppSec.docx', role: 'Application Security Engineer', company: 'Acme', category: 'AppSec Engineer', at: Date.UTC(2026, 9, 23) } }
  const b = bot({ have, floorOk: false })
  await b.wa.handle('15550014', { type: 'text', id: 'm1', text: { body: `${JD}\n1` } }, {}, 'user1')
  assert.equal(b.runs.length, 1, 'made again')
  assert.ok(!b.docs.some(d => /You already have this one/.test(d)))
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
  assert.equal((await b.wa.loadSession(N)).preferredEmail, 'b@y.com')
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

test('"Why did you pick that resume?" and "What resumes do I have?" are answered from what was done', async () => {
  const b = bot({ agent: null, extra: library() })
  const N = '15550014'
  await b.wa.handle(N, { type: 'text', id: 'm0', text: { body: 'why did you pick that resume?' } }, {}, 'user1')
  assert.match(b.said.at(-1), /I have not started a resume for you yet/)
  await b.wa.handle(N, { type: 'text', id: 'm1', text: { body: `${POST}
1` } }, {}, 'user1')
  await b.wa.handle(N, { type: 'text', id: 'm2', text: { body: 'Why did you pick that resume?' } }, await b.wa.loadSession(N), 'user1')
  assert.match(b.said.at(-1), /For your last job I started from your \*Cyber Security Analyst\* resume \(in Identity and Access Management\)/)
  assert.match(b.said.at(-1), /It is the one resume whose title matches the job's role \(Security Analyst\)/)
  assert.match(b.said.at(-1), /make another one with the Cybersecurity Analyst resume/)
  await b.wa.handle(N, { type: 'text', id: 'm3', text: { body: 'what resumes do I have?' } }, await b.wa.loadSession(N), 'user1')
  assert.match(b.said.at(-1), /Your \*a@x\.com\* resumes \(\d+\): /)
  assert.ok(b.said.at(-1).includes('*Cyber Security Analyst*') && b.said.at(-1).includes('*AI Security Engineer*'))
  const made = b.runs.length
  assert.equal(made, 1, 'questions make nothing')
  // After a resume was named, the reason says so.
  await b.wa.handle(N, { type: 'text', id: 'm4', text: { body: 'use the AI Security Engineer resume' } }, await b.wa.loadSession(N), 'user1')
  await b.wa.handle(N, { type: 'text', id: 'm5', text: { body: 'which resume did you use?' } }, await b.wa.loadSession(N), 'user1')
  assert.match(b.said.at(-1), /your \*AI plus AppSec\* resume/)
  assert.match(b.said.at(-1), /You asked for it by name/)
})


test('a message consumed by Kompas cannot also start resume tailoring', async () => {
  const b = bot({ kompasConsumes: true })
  await b.wa.handle('15550001', { type: 'text', id: 'channel-question', text: { body: JD } }, {}, 'user1', true)
  assert.equal(b.channelCalls.length, 1)
  assert.equal(b.channelCalls[0].owner, 'user1')
  assert.equal(b.channelCalls[0].verified, true)
  assert.equal(b.channelCalls[0].requestId, 'channel-question')
  assert.equal(b.runs.length, 0)
  assert.equal(b.saved.length, 0)
  assert.equal(b.docs.length, 0)
  assert.equal(b.said.length, 0)
  assert.equal(b.store.size, 0)
})

test('explicit profile switching bypasses the optional Kompas channel', async () => {
  const b = bot({ kompasConsumes: true })
  await b.wa.handle('15550001', { type: 'text', id: 'profile-switch', text: { body: 'use 2' } }, {}, 'user1', true)
  assert.equal(b.channelCalls.length, 0)
  assert.equal((await b.wa.loadSession('15550001')).preferredEmail, 'b@y.com')
  assert.equal(b.runs.length, 0)
})

test('use 1 stays after a finished run records the other email', async () => {
  const b = bot()
  const N = '15550021'
  await b.wa.handle(N, { type: 'text', id: 'u1', text: { body: 'use 1' } }, {}, 'user1')
  assert.match(b.said.at(-1), /every job now starts from your \*a@x\.com\*/)
  const key = 'whatsapp/session-15550021.json'
  const session = JSON.parse(b.store.get(key))
  session.last = { jd: 'older job', email: 'b@y.com', at: Date.now() }
  b.store.set(key, JSON.stringify(session))
  const other = 'Cloud Security Engineer for AWS guardrails, IAM reviews, GuardDuty triage and Terraform policy as code.'
  await b.wa.handle(N, { type: 'text', id: 'job', text: { body: other } }, await b.wa.loadSession(N), 'user1')
  assert.ok(b.said.some(t => t.startsWith('On it: starting from your *a@x.com* resumes.')))
  assert.equal(b.runs[0].givenPath, APPSEC)
})

test('help is answered even when Kompas would consume the message', async () => {
  const b = bot({ kompasConsumes: true })
  await b.wa.handle('15550001', { type: 'text', id: 'help-1', text: { body: 'Help' } }, {}, 'user1', true)
  assert.equal(b.channelCalls.length, 0)
  assert.match(b.said.at(-1), /job description/i)
})
