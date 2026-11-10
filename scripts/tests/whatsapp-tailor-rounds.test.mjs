// Simulated WhatsApp tailor rounds. Send is a recorder. Nothing leaves this process.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = (file) => readFileSync(new URL('../../' + file, import.meta.url), 'utf8')
const tailorSrc = read('src/lib/tailor.ts')
const routeSrc = read('src/app/api/whatsapp/webhook/route.ts')
const SANDBOX = '15555501023'
const IDENTITY = 'Eshwar Jay\njayeshwar44@gmail.com | (314) 255-9156\nAnalyst, Acme  Jan 2021 - Mar 2024'
const JD = 'Senior Security Analyst. Monitor SIEM alerts, investigate endpoint threats, and write detections for the security operations center each week.'

function load(file, mocks = {}, extra = '') {
  const testModule = { exports: {} }
  const src = read(file) + extra
  const timers = new Map()
  let seq = 0
  const setTimeoutFn = (fn, ms, ...args) => {
    const id = ++seq
    if (ms === 60000) {
      timers.set(id, () => fn(...args))
      if (load.fireLongTimers) queueMicrotask(() => {
        const run = timers.get(id)
        if (!run) return
        timers.delete(id)
        run()
      })
      return id
    }
    if (!ms) queueMicrotask(() => fn(...args))
    return id
  }
  runInNewContext(ts.transpileModule(src, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: testModule,
    exports: testModule.exports,
    process, console, Buffer, URL, Promise, queueMicrotask,
    setTimeout: setTimeoutFn,
    clearTimeout: id => { timers.delete(id) },
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return testModule.exports
}
load.fireLongTimers = false

function loadConstructed() {
  const js = ts.transpileModule(read('src/lib/constructed-jd.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const keywordTargets = ts.transpileModule(read('src/lib/keyword-targets.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const quality = ts.transpileModule(read('src/lib/resume-quality.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const kt = {}, q = {}, exports = {}
  runInNewContext(keywordTargets, { exports: kt, module: { exports: kt }, console, Buffer })
  runInNewContext(quality, { exports: q, module: { exports: q }, console, Buffer })
  runInNewContext(js, {
    exports, module: { exports }, console, Buffer,
    require: id => id.includes('keyword-targets') ? kt : q,
  })
  return exports
}

const { sameResumeIdentity } = load('src/lib/resume-identity.ts', {
  '@/lib/resume-round-trip-guard': load('src/lib/resume-round-trip-guard.ts'),
  '@/lib/jd-terms-gate': load('src/lib/jd-terms-gate.ts'),
})

function passingResult() {
  return {
    token: 'round-token', score: 100, coverage: 100, supported_coverage: 100,
    diff: [{ section: 'Experience', before: 'A', after: 'B' }],
    unverified_added_keywords: [], quality_blockers: [],
    keyword_analysis: { matched: ['siem'], added: [], missing: [] },
    quality: { status: 'coverage_met', matched: 10, total: 10, missing: [], incomplete: false },
    ats: { score: 100, passed: true, checks: [], issues: [] },
  }
}

function payload(id, body) {
  return JSON.stringify({
    entry: [{ changes: [{ value: { messages: [{ from: SANDBOX, id, type: 'text', text: { body } }] } }] }],
  })
}

test('coverage scoring: 70 to 80 is inside the extra pass, and repair still runs under 95', () => {
  const constructed = loadConstructed()
  // 6 Nov 2026 replaced a 70-to-80-only third pass with one extra pass whenever
  // coverage is not above 95. 70 and 80 are inside that band. 40 and 95 are too.
  // A score above 95 does not get another keyword pass.
  for (const n of [40, 70, 75, 80, 90, 95]) assert.equal(constructed.coverageNeedsAnotherPass(n), true, String(n))
  assert.equal(constructed.coverageNeedsAnotherPass(95.1), false)
  assert.equal(constructed.coverageNeedsAnotherPass(100), false)
  assert.match(tailorSrc, /coverageNeedsAnotherPass\(coveragePercent\(shareOf\(best\.afterKw\)\)\)/)
  assert.match(tailorSrc, /supportedShare\(current\) < TARGET_COVERAGE/)
  assert.match(tailorSrc, /for \(let repair = 1; repair <= 3 && supportedShare\(current\) < TARGET_COVERAGE/)
  // Nov 5 skills-line revert: only a term the resume already supports is written back.
  assert.match(tailorSrc, /const left = scoreKws\.filter\(k => floorKws\.has\(k\) && forcedJdKws\.includes\(k\) && !cur\.afterKw\.has\(k\) && !isCertification\(k\)\)/)
  const expression = tailorSrc.match(/const left = (scoreKws\.filter\([^\n]+\))/)?.[1]
  const place = new Function('scoreKws', 'floorKws', 'forcedJdKws', 'cur', 'isCertification', 'return ' + expression)
  assert.deepEqual(place(['illumio'], new Set(['illumio']), [], { afterKw: new Set() }, () => false), [])
  assert.deepEqual(place(['splunk'], new Set(['splunk']), ['splunk'], { afterKw: new Set() }, () => false), ['splunk'])
})

test('the 60-second notice is armed and cleared on every path', () => {
  assert.match(routeSrc, /Still working on your resume/)
  assert.match(routeSrc, /60_000/)
  assert.match(routeSrc, /clearTimeout\(progressTimer\)/)
})

test('simulated webhook covers a file, a bad link, a timeout, a duplicate, and a bad signature', async () => {
  const keys = {
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ALLOWED_FROM: process.env.WHATSAPP_ALLOWED_FROM,
    WHATSAPP_PAIR_WAIT_MS: process.env.WHATSAPP_PAIR_WAIT_MS,
  }
  process.env.WHATSAPP_APP_SECRET = 'sandbox-secret-not-real'
  process.env.WHATSAPP_TOKEN = 'sandbox-token-not-real'
  process.env.WHATSAPP_PHONE_NUMBER_ID = '000'
  process.env.WHATSAPP_ALLOWED_FROM = SANDBOX
  process.env.WHATSAPP_PAIR_WAIT_MS = '0'

  const entries = new Map()
  const said = []
  const docs = []
  let runs = 0
  let mode = 'pass'
  const sessionKey = `whatsapp/session-${SANDBOX}.json`
  const resumePath = `/data/whatsapp/inbox/${SANDBOX}/resume.docx`
  const seed = () => entries.set(sessionKey, JSON.stringify({
    version: 3, resumePath, resumeName: 'Eshwar Resume', resumeAt: Date.now(), seen: [], updatedAt: Date.now(),
  }))
  seed()
  const blob = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => { entries.set(key, value) },
    get: async key => key === 'tailored/round-token.docx' ? Buffer.from('tailored-bytes') : null,
    getText: async key => entries.get(key) ?? null,
    delete: async key => { entries.delete(key) },
  }
  const sendText = async (_to, message) => { said.push(message); return 'wamid-text' }
  const sendDocument = async (_to, file, name, caption) => { docs.push({ file, name, caption }); return 'wamid-doc-' + docs.length }
  const wa = load('src/lib/whatsapp.ts')
  const mocks = {
    'next/server': {
      NextResponse: class NextResponse {
        constructor(body, init = {}) { this.body = body; this.status = init.status || 200 }
        static json(body, init = {}) { return new NextResponse(JSON.stringify(body), init) }
      },
    },
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('no voice in this round') } },
    '@/lib/storage': {
      blob,
      readPath: async () => Buffer.from('source-bytes'),
      writePath: async () => {},
      deletePath: async () => {},
      existsPath: async () => false,
    },
    '@/lib/paths': { DATA_DIR: '/data', USER_RESUMES_DIR: '/data/users' },
    '@/lib/llm': {
      keysFor: async () => ({ gemini: 'sandbox' }),
      hasAnyKey: () => true,
      resolveKeys: () => ({}),
      tailorKeys: k => k,
    },
    '@/lib/tailor': { runTailor: async () => {
      runs++
      if (mode === 'timeout') throw new Error('Tailoring timed out')
      if (mode === 'partial') return { ...passingResult(), partial: { pendingProfile: true } }
      return passingResult()
    } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: '', company: '', location: '' }) },
    '@/lib/whatsapp': { ...wa, sendText, sendDocument, downloadMedia: async () => Buffer.from('') },
    '@/lib/owner': { isOwnerWhatsApp: () => false },
    '@/lib/whatsapp-who': {
      resolveWhatsAppUser: async () => ({ who: { userId: 'sandbox-user', own: true }, checked: true }),
      claimNotice: async () => false,
      textCodesWork: async () => false,
    },
    '@/lib/whatsapp-link': { claimLinkCode: async () => ({ ok: false, why: 'mismatch' }) },
    '@/lib/whatsapp-who-core': {
      notRegisteredMessage: () => 'unregistered',
      NOT_CHECKED_MESSAGE: 'unchecked',
      siteOf: () => 'https://job-dashboard-fawn.vercel.app',
    },
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) },
    '@/lib/plain-failure': { plainFailure: () => 'plain failure' },
    '@/lib/resume-identity': { sameResumeIdentity },
    '@/lib/resume-round-trip-guard': { docxIdentityText: async bytes => Buffer.from(bytes).toString() },
    '@/lib/docx': { extractText: async () => IDENTITY },
    '@/lib/supabase/service': { serviceClientAvailable: () => false, createServiceClient: () => { throw new Error('no service') } },
    '@/lib/keyword-targets': load('src/lib/keyword-targets.ts'),
    '@/lib/resume-risk': load('src/lib/resume-risk.ts'),
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {},
    '@/lib/library-pick': { DIFFERENT_RESUME: 'different' },
    '@/lib/role-match': {
      parseInstruction: () => null,
      parseQuestion: () => null,
      splitTailInstruction: text => ({ jd: text, hint: '' }),
      titlesOf: () => [],
    },
    '@/lib/library-choose': {},
    '@/lib/chief-approvals': {},
    '@/lib/resume-library-store': { relOf: () => '' },
    '@/lib/resume-library': {},
    '@/lib/made-floor': {},
    '@/lib/library-agent': {},
    '@/lib/whatsapp-recovery-budget': load('src/lib/whatsapp-recovery-budget.ts'),
    '@/lib/whatsapp-upload-age': load('src/lib/whatsapp-upload-age.ts'),
    '@/lib/whatsapp-resume-acceptance': load('src/lib/whatsapp-resume-acceptance.ts'),
    '@/lib/resume-evidence': { confirmedCandidateStatements: () => [] },
    '@/lib/whatsapp-resume-recovery': {
      enqueueResumeRecovery: async input => ({ ...input, status: 'pending' }),
      patchResumeRecovery: async () => {},
      deferResumeRecovery: async () => {},
      dueResumeRecoveries: async () => [],
      hasResumeRecoveryForJD: async () => false,
      markResumeDocumentAccepted: async () => true,
      recordResumeDeliveryStatus: async () => {},
      readResumeRecovery: async () => ({ status: 'pending' }),
    },
  }
  const sign = body => 'sha256=' + createHmac('sha256', 'sandbox-secret-not-real').update(body).digest('hex')
  const { POST } = load('src/app/api/whatsapp/webhook/route.ts', mocks)
  const call = (body, headers = {}) => POST({
    text: async () => body,
    headers: { get: name => headers[String(name).toLowerCase()] || null },
    nextUrl: { pathname: '/api/whatsapp/webhook', origin: 'https://job-dashboard-fawn.vercel.app' },
  })

  try {
    const forged = await call('{}', { 'x-hub-signature-256': 'sha256=00' })
    assert.equal(forged.status, 401)
    assert.equal(docs.length, 0)
    assert.equal(said.length, 0)

    const broken = 'not-json'
    const ignored = await call(broken, { 'x-hub-signature-256': sign(broken) })
    assert.equal(ignored.status, 200)
    assert.equal(docs.length, 0)

    const noteBody = payload('wamid.note', 'https://evil.example/not-a-job')
    const note = await call(noteBody, { 'x-hub-signature-256': sign(noteBody) })
    assert.equal(note.status, 200)
    assert.match(said.at(-1), /Send me a job description/)
    assert.equal(runs, 0)
    assert.equal(docs.length, 0)

    const linkBody = payload('wamid.link', 'link ABCD-WXYZ')
    const link = await call(linkBody, { 'x-hub-signature-256': sign(linkBody) })
    assert.equal(link.status, 200)
    assert.match(said.at(-1), /link code did not match/)
    assert.equal(runs, 0)

    load.fireLongTimers = true
    const jobBody = payload('wamid.job', JD)
    const job = await call(jobBody, { 'x-hub-signature-256': sign(jobBody) })
    assert.equal(job.status, 200)
    assert.ok(said.some(line => line.startsWith('Still working on your resume')), '60 second notice')
    assert.equal(docs.length, 1)
    assert.match(docs[0].name, /\.docx$/)
    assert.ok(Buffer.isBuffer(docs[0].file))
    assert.ok(docs[0].caption.split('\n').length <= 5, docs[0].caption)
    assert.match(docs[0].caption, /JD keyword coverage 100%/)
    assert.equal(runs, 1)
    const duplicate = await call(jobBody, { 'x-hub-signature-256': sign(jobBody) })
    assert.equal(duplicate.status, 200)
    assert.equal(runs, 1, 'a repeated message id does not tailor again')
    assert.equal(docs.length, 1)

    load.fireLongTimers = false
    seed()
    mode = 'timeout'
    const timeBody = payload('wamid.time', JD)
    await call(timeBody, { 'x-hub-signature-256': sign(timeBody) })
    assert.equal(docs.length, 2, 'a timeout still sends the already chosen resume')
    assert.match(docs[1].caption, /ran out of time/)
    assert.ok(docs[1].caption.split('\n').length <= 5, docs[1].caption)

    seed()
    mode = 'partial'
    const partialBody = payload('wamid.partial', JD)
    await call(partialBody, { 'x-hub-signature-256': sign(partialBody) })
    assert.equal(docs.length, 3, 'an unfinished rewrite sends the already chosen resume')
    assert.match(docs[2].caption, /did not finish cleanly/)
    assert.ok(docs[2].caption.split('\n').length <= 5)
  } finally {
    for (const [key, value] of Object.entries(keys)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    load.fireLongTimers = false
  }
})

test('live production routes answer and do not accept a forged webhook', async () => {
  const origin = 'https://job-dashboard-fawn.vercel.app'
  const health = await fetch(origin + '/api/health')
  assert.equal(health.status, 200)
  const body = await health.json()
  assert.equal(body.ok, true)
  assert.equal(body.app, 'MarketFit')
  const denied = await fetch(origin + '/api/whatsapp/webhook')
  assert.equal(denied.status, 403)
  const forged = await fetch(origin + '/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=00' },
    body: '{}',
  })
  assert.equal(forged.status, 401)
})
