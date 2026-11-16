// WhatsApp must always deliver a resume file for the profile already chosen.
// Nov 6, 2026: the EASM run refused a 30.8% rewrite and sent no file.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}, extra = '') {
  const testModule = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8') + extra
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: testModule, exports: testModule.exports, process, console, Buffer, setTimeout, clearTimeout,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return testModule.exports
}

const { sameResumeIdentity } = load('src/lib/resume-identity.ts', {
  '@/lib/resume-round-trip-guard': load('src/lib/resume-round-trip-guard.ts'),
  '@/lib/jd-terms-gate': load('src/lib/jd-terms-gate.ts'),
})

const HOUSTON = 'Candidate One\ncandidate1@example.test | 202-555-0101\nAnalyst, Acme  Jan 2021 - Mar 2024'
const SAINT_LOUIS = 'Candidate Two\ncandidate2@example.test | 202-555-0102\nAnalyst, Acme  Jan 2019 - Jun 2022'
const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'
const TEST_USER_ROOT = `/data/user-resumes/${TEST_USER_ID}`
const HOUSTON_PATH = `${TEST_USER_ROOT}/candidate1@example.test/GRC/easm.docx`
const SAINT_LOUIS_PATH = `${TEST_USER_ROOT}/candidate2@example.test/GRC/grc.docx`
const REWRITTEN = HOUSTON + '\nRewrote supplier reviews.'

function harness(runTailor) {
  const docs = []
  const said = []
  const entries = new Map()
  const storage = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async key => (String(key).startsWith('tailored/') ? Buffer.from(REWRITTEN) : null),
    getText: async key => entries.get(key) ?? null,
    delete: async key => { entries.delete(key) },
  }
  const mocks = {
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('no voice') } },
    'next/server': {},
    '@/lib/storage': {
      blob: storage,
      readPath: async p => p === HOUSTON_PATH ? Buffer.from(HOUSTON) : p === SAINT_LOUIS_PATH ? Buffer.from(SAINT_LOUIS) : null,
      writePath: async () => {}, deletePath: async () => {}, existsPath: async () => true,
    },
    '@/lib/paths': { DATA_DIR: '/data', USER_RESUMES_DIR: '/data/user-resumes' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => true, resolveKeys: () => ({}), tailorKeys: k => k },
    '@/lib/tailor': { runTailor },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'EASM Cybersecurity Engineer', company: 'Acme', location: '' }) },
    '@/lib/whatsapp': {
      sendText: async (_to, message) => { said.push(message); return 'wamid.text' },
      sendDocument: async (_to, body, _name, caption) => { docs.push({ body: Buffer.from(body).toString(), caption }); return 'wamid.doc' },
    },
    '@/lib/owner': { isOwnerWhatsApp: () => false },
    '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Candidate' }) },
    '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity },
    '@/lib/resume-round-trip-guard': { docxIdentityText: async bytes => Buffer.from(bytes).toString() },
    '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: () => false },
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': { live: slots => (slots || []).filter(Boolean), DIFFERENT_RESUME: 'different' },
    '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {},
    '@/lib/resume-library-store': { markUsed: async () => {}, relOf: () => 'rel', saveTailored: async () => { throw new Error('shortfall must not be filed as a new base') } },
    '@/lib/resume-library': {}, '@/lib/made-floor': {}, '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
    '@/lib/whatsapp-recovery-budget': load('src/lib/whatsapp-recovery-budget.ts'),
    '@/lib/whatsapp-upload-age': load('src/lib/whatsapp-upload-age.ts'),
    '@/lib/whatsapp-resume-acceptance': load('src/lib/whatsapp-resume-acceptance.ts'),
    '@/lib/resume-evidence': load('src/lib/resume-evidence.ts'),
    '@/lib/resume-risk': load('src/lib/resume-risk.ts'),
    '@/lib/whatsapp-resume-recovery': {
      enqueueResumeRecovery: async input => ({ ...input, status: 'pending' }),
      patchResumeRecovery: async () => {},
      deferResumeRecovery: async () => {},
      dueResumeRecoveries: async () => [],
      markResumeDocumentAccepted: async () => true,
      recordResumeDeliveryStatus: async () => {},
      readResumeRecovery: async () => ({ status: 'pending' }),
    },
  }
  const { generate } = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { generate };')
  const filesFor = path => ({
    userDir: TEST_USER_ROOT,
    email: 'candidate1@example.test',
    said: 'your *EASM Cybersecurity Engineer* resume (in GRC and IT Risk). I chose it because its title matches',
    depth: 0,
    rel: path === HOUSTON_PATH ? 'candidate1@example.test/GRC/easm.docx' : 'candidate2@example.test/GRC/grc.docx',
    abs: path,
  })
  return { generate, docs, said, filesFor }
}

const low = {
  token: 'easm-30', score: 30.8, coverage: 30.8, supported_coverage: 30.8,
  diff: [{ section: 'Experience', before: 'A', after: 'B' }],
  unverified_added_keywords: ['supplierninja'],
  quality_blockers: [],
  quality: { status: 'needs_review', matched: 4, total: 13, missing: ['soc 2', 'tprm', 'supplier', 'vendor', 'high-visibility', 'supplierninja', 'filter', 'dri'] },
  ats: { score: 90, passed: true, checks: [], issues: [] },
  keyword_analysis: { matched: [], added: ['supplierninja'], missing: ['soc 2', 'tprm', 'supplier', 'vendor'] },
}

test('a below-floor rewrite still delivers that Word file and names the missing terms', async () => {
  const { generate, docs, said, filesFor } = harness(async () => low)
  await generate('15550101', {
    jdId: 'easm', jd: 'EASM cybersecurity engineer with SOC 2 and TPRM',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.match(docs[0].body, /Rewrote supplier reviews/)
  assert.match(docs[0].body, /candidate1@example.test/)
  assert.doesNotMatch(docs[0].body, /candidate2/)
  assert.match(docs[0].caption, /30\.8%/)
  assert.match(docs[0].caption, /Still missing: soc 2, tprm, supplier, vendor/)
  assert.match(docs[0].caption, /supplierninja/)
  assert.doesNotMatch(docs[0].caption, /No incomplete file was delivered/)
  assert.doesNotMatch(said.join('\n'), /I did not send a file/)
  assert.match(said.join('\n'), /EASM Cybersecurity Engineer/)
})

test('a failed or incomplete rewrite still delivers the chosen library resume', async () => {
  let mode = 'throw'
  const { generate, docs, said, filesFor } = harness(async () => {
    if (mode === 'throw') throw new Error('provider down')
    return { ...low, token: 'partial', partial: { failed: 2, total: 4, pendingRoles: [1] }, quality: { ...low.quality, incomplete: true } }
  })
  const session = {
    jdId: 'easm-fail', jd: 'EASM cybersecurity engineer',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }
  await generate('15550101', session, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.equal(docs[0].body, HOUSTON)
  assert.match(docs[0].caption, /closest matching resume/)
  assert.match(docs[0].caption, /Original resume — NOT TAILORED/)
  assert.match(docs[0].caption, /EASM Cybersecurity Engineer/)
  assert.match(docs[0].caption, /in GRC and IT Risk/)
  assert.match(docs[0].caption, /did not finish cleanly/)
  assert.match(docs[0].caption, /was not rewritten/)
  assert.doesNotMatch(docs[0].body, /Rewrote supplier reviews/)
  assert.doesNotMatch(said.join('\n'), /No incomplete file was delivered/)

  mode = 'partial'
  docs.length = 0
  await generate('15550101', { ...session, jdId: 'easm-partial' }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.equal(docs[0].body, HOUSTON)
  assert.match(docs[0].caption, /marked incomplete/)
  assert.match(docs[0].caption, /closest matching resume/)
  assert.match(docs[0].caption, /Original resume — NOT TAILORED/)
  assert.doesNotMatch(docs[0].caption, /No incomplete file was delivered/)
})

test('a finished 30.8% rewrite with a role evidence gap sends the updated file, not the library file', async () => {
  const finished = {
    ...low,
    token: 'easm-scored',
    quality: { ...low.quality, incomplete: false, status: 'needs_review' },
    quality_blockers: ['role_evidence_gaps'],
    ats: { score: 92, passed: true, checks: [], issues: [] },
  }
  const { generate, docs, said, filesFor } = harness(async () => finished)
  await generate('15550101', {
    jdId: 'easm-scored', jd: 'EASM cybersecurity engineer with SOC 2 and TPRM',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.match(docs[0].body, /Rewrote supplier reviews/)
  assert.match(docs[0].caption, /30\.8%/)
  assert.match(docs[0].caption, /Skills your resume already supports: 30\.8%/)
  assert.match(docs[0].caption, /ATS parse check: 92%/)
  assert.match(docs[0].caption, /Risk factor:/)
  assert.match(docs[0].caption, /Still missing: soc 2, tprm, supplier, vendor/)
  assert.doesNotMatch(docs[0].caption, /was not rewritten/)
  assert.doesNotMatch(docs[0].caption, /marked incomplete/)
  assert.doesNotMatch(docs[0].caption, /closest matching resume/)
  assert.doesNotMatch(docs[0].caption, /Original resume — NOT TAILORED/)
  assert.doesNotMatch(said.join('\n'), /I did not send a file/)
})

test('a slow constructed-JD rewrite sends the rewritten file, not the original', async () => {
  const finished = {
    token: 'iam-rewritten', score: 97, coverage: 97, supported_coverage: 98,
    diff: [{ section: 'Experience', before: 'Administered access.', after: 'Administered access, using SailPoint and CyberArk.' }],
    quality: { status: 'coverage_met', matched: 97, total: 100, missing: [], incomplete: false },
    quality_blockers: [],
    ats: { score: 100, passed: true, checks: [], issues: [] },
    keyword_analysis: { matched: ['okta'], added: ['sailpoint', 'cyberark'], missing: [] },
  }
  const { generate, docs, said, filesFor } = harness(async () => {
    await new Promise(resolve => setTimeout(resolve, 50))
    return finished
  })
  await generate('15550101', {
    jdId: 'iam-slow', jd: 'IAM consultant with SailPoint and CyberArk',
    resumePath: HOUSTON_PATH, resumeName: 'Senior IAM Business Analyst',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.match(docs[0].body, /Rewrote supplier reviews/)
  assert.match(docs[0].caption, /97%/)
  assert.doesNotMatch(docs[0].caption, /was not rewritten/)
  assert.doesNotMatch(docs[0].caption, /did not finish cleanly/)
  assert.doesNotMatch(docs[0].body, /candidate2/)
  assert.doesNotMatch(said.join('\n'), /I did not send a file/)
})

test('roles that were not rewritten still send the chosen library file', async () => {
  const unfinished = {
    ...low,
    token: 'easm-unrewritten',
    quality: { ...low.quality, incomplete: false },
    quality_blockers: ['roles_unrewritten'],
  }
  const { generate, docs, filesFor } = harness(async () => unfinished)
  await generate('15550101', {
    jdId: 'easm-roles', jd: 'EASM cybersecurity engineer',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.equal(docs[0].body, HOUSTON)
  assert.match(docs[0].caption, /closest matching resume/)
  assert.match(docs[0].caption, /Original resume — NOT TAILORED/)
  assert.match(docs[0].caption, /Some experience sections were not rewritten/)
  assert.match(docs[0].caption, /was not rewritten/)
  assert.doesNotMatch(docs[0].body, /Rewrote supplier reviews/)
})

test('the Houston and Saint Louis profiles are not mixed when the failsafe sends a file', async () => {
  const { generate, docs, said, filesFor } = harness(async () => { throw new Error('provider down') })
  await generate('15550101', {
    jdId: 'houston', jd: 'EASM role',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.match(docs[0].body, /candidate1@example.test/)
  assert.doesNotMatch(docs[0].body, /candidate2/)

  docs.length = 0
  await generate('15550101', {
    jdId: 'wrong-profile', jd: 'EASM role again',
    resumePath: SAINT_LOUIS_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(SAINT_LOUIS_PATH))
  assert.equal(docs.length, 0, 'a Saint Louis file is not sent for the Houston profile')
  assert.doesNotMatch(said.join('\n'), /candidate2/)
  assert.doesNotMatch(docs.map(d => d.body).join('\n'), /candidate2/)
})


test('the not-tailored label is restricted to Files/library-origin fallback', () => {
  const source = readFileSync(new URL('../../src/app/api/whatsapp/webhook/route.ts', import.meta.url), 'utf8')
  assert.match(source, /closestResumeCaption\(name, chosenLabel\(files, session\.resumeName\), why, !!files\)/)
  assert.match(source, /\.\.\.\(markNotTailored \? \["Original resume — NOT TAILORED"\] : \[\]\)/)
})
