// WhatsApp sends a tailored file only after its evidence/completion checks. An unchanged fallback
// is allowed only for the exact same-account Files resume the user explicitly named.
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

function harness(runTailor, readPathOverride, hasKeys = true, readRecoveryOverride) {
  const docs = []
  const said = []
  const entries = new Map()
  const recoveryJobs = new Map()
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
      readPath: async p => readPathOverride ? readPathOverride(p) : p === HOUSTON_PATH ? Buffer.from(HOUSTON) : p === SAINT_LOUIS_PATH ? Buffer.from(SAINT_LOUIS) : null,
      writePath: async () => {}, deletePath: async () => {}, existsPath: async () => true,
    },
    '@/lib/paths': { DATA_DIR: '/data', USER_RESUMES_DIR: '/data/user-resumes' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => hasKeys, resolveKeys: () => ({}), tailorKeys: k => k },
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
      enqueueResumeRecovery: async input => { const job = { ...input, status: 'pending' }; recoveryJobs.set(job.id, job); return job },
      patchResumeRecovery: async (id, patch) => { const job = recoveryJobs.get(id); if (job) recoveryJobs.set(id, { ...job, ...patch }) },
      deferResumeRecovery: async () => {},
      dueResumeRecoveries: async () => [],
      markResumeDocumentAccepted: async () => true,
      recordResumeDeliveryStatus: async () => {},
      readResumeRecovery: async id => readRecoveryOverride ? readRecoveryOverride(id, recoveryJobs) : recoveryJobs.get(id) ?? null,
    },
  }
  const { generate, qualityStop } = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { generate, qualityStop };')
  const filesFor = (path, explicitlySelected = true, overrides = {}) => ({
    userDir: TEST_USER_ROOT,
    email: 'candidate1@example.test',
    said: 'your *EASM Cybersecurity Engineer* resume (in GRC and IT Risk). I chose it because its title matches',
    depth: 0,
    rel: path === HOUSTON_PATH ? 'candidate1@example.test/GRC/easm.docx' : 'candidate2@example.test/GRC/grc.docx',
    abs: path,
    explicitlySelected,
    ...overrides,
  })
  return { generate, qualityStop, docs, said, filesFor, recoveryJobs }
}

const low = {
  token: 'easm-30', score: 30.8, coverage: 30.8, supported_coverage: 30.8,
  diff: [{ section: 'Experience', before: 'A', after: 'B' }],
  unverified_added_keywords: [],
  quality_blockers: [],
  quality: { status: 'needs_review', matched: 4, total: 13, missing: ['soc 2', 'tprm', 'supplier', 'vendor', 'high-visibility', 'filter', 'dri'] },
  ats: { score: 90, passed: true, checks: [], issues: [] },
  keyword_analysis: { matched: [], added: [], missing: ['soc 2', 'tprm', 'supplier', 'vendor'] },
}
const unsupported = {
  ...low,
  token: 'easm-unsupported',
  unverified_added_keywords: ['supplierninja'],
  quality: { ...low.quality, missing: [...low.quality.missing, 'supplierninja'] },
  keyword_analysis: { ...low.keyword_analysis, added: ['supplierninja'] },
}

test('a finished below-floor rewrite sends the updated Word file and names the supported shortfall', async () => {
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
  assert.doesNotMatch(docs[0].caption, /supplierninja/)
  assert.doesNotMatch(docs[0].caption, /No incomplete file was delivered/)
  assert.doesNotMatch(said.join('\n'), /I did not send a file/)
  assert.match(said.join('\n'), /EASM Cybersecurity Engineer/)
})

test('a failed or incomplete rewrite may send only the explicitly selected Files resume', async () => {
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
  assert.match(docs[0].caption, /^Original resume — NOT TAILORED/)
  assert.match(docs[0].caption, /exact Files resume you selected for candidate1@example\.test/)
  assert.match(docs[0].caption, /rewrite stopped before it finished/)
  assert.doesNotMatch(docs[0].body, /Rewrote supplier reviews/)
  assert.doesNotMatch(said.join('\n'), /No incomplete file was delivered/)

  mode = 'partial'
  docs.length = 0
  await generate('15550101', { ...session, jdId: 'easm-partial' }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.equal(docs[0].body, HOUSTON)
  assert.match(docs[0].caption, /rewrite was marked incomplete/)
  assert.match(docs[0].caption, /^Original resume — NOT TAILORED/)
  assert.doesNotMatch(docs[0].caption, /No incomplete file was delivered/)
})

test('a finished 30.8% rewrite with a role evidence gap sends the updated file when it adds no unsupported claims', async () => {
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
  assert.match(docs[0].caption, /^Original resume — NOT TAILORED/)
  assert.match(docs[0].caption, /Some experience sections were not rewritten/)
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


test('unsupported JD-only additions hard-hold the draft and label only the explicitly selected original', async () => {
  const { generate, docs } = harness(async () => unsupported)
  await generate('15550101', {
    jdId: 'easm-unsupported', jd: 'EASM cybersecurity engineer with supplierninja',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.equal(docs[0].body, HOUSTON, 'the hard-held draft is never delivered')
  assert.match(docs[0].caption, /^Original resume — NOT TAILORED/)
  assert.match(docs[0].caption, /job-post terms your resume does not support/)
  assert.doesNotMatch(docs[0].body, /supplierninja/)
})

test('an automatic library match without an explicit file selection is text-only on failure', async () => {
  const { generate, docs, said } = harness(async () => { throw new Error('provider down') })
  await generate('15550101', {
    jdId: 'automatic-only', jd: 'EASM role', resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH, false))
  assert.equal(docs.length, 0)
  assert.match(said.join('\n'), /No exact Files resume was explicitly selected/)
})

test('a fresh upload without an explicit Files selection is never sent unchanged', async () => {
  const inboxPath = '/data/whatsapp/inbox/15550101/upload.docx'
  const { generate, docs, said } = harness(async () => { throw new Error('provider down') })
  await generate('15550101', {
    jdId: 'upload-only', jd: 'EASM role', resumePath: inboxPath, resumeName: 'Uploaded resume',
  }, TEST_USER_ID, 60_000)
  assert.equal(docs.length, 0)
  assert.match(said.join('\n'), /No exact Files resume was explicitly selected/)
})

test('fallback rejects a mismatched Library root and a byte mismatch', async () => {
  const rootMismatch = harness(async () => { throw new Error('provider down') })
  await rootMismatch.generate('15550101', {
    jdId: 'wrong-root', jd: 'EASM role', resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH, true, { userDir: '/data/user-resumes/another-account' }))
  assert.equal(rootMismatch.docs.length, 0)
  assert.match(rootMismatch.said.join('\n'), /selected Files resume could not be verified/)

  let reads = 0
  const byteMismatch = harness(async () => { throw new Error('provider down') }, async p => {
    if (p !== HOUSTON_PATH) return null
    reads++
    return Buffer.from(reads === 1 ? HOUSTON : HOUSTON + '\nchanged after selection')
  })
  await byteMismatch.generate('15550101', {
    jdId: 'wrong-bytes', jd: 'EASM role', resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(byteMismatch.docs.length, 0)
  assert.equal(reads, 2, 'the source and selected Library bytes are read independently')
  assert.match(byteMismatch.said.join('\n'), /selected Files resume could not be verified/)
})


test('unsupported JD-only terms are explained before the ordinary coverage hold', async () => {
  const { generate, qualityStop, docs, said, filesFor } = harness(async () => unsupported)
  await generate('15550101', {
    jdId: 'unsupported-text-only', jd: 'EASM cybersecurity engineer with SupplierNinja',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH, false))
  assert.equal(docs.length, 0)
  assert.match(said.at(-1), /job-post terms/)
  assert.match(said.at(-1), /supplierninja/)
  assert.match(qualityStop(unsupported), /not in your resume/)
})
test('explicit fallback requires the durable recovery record, not only in-memory selection', async () => {
  const { generate, docs, said } = harness(async () => { throw new Error('provider down') }, undefined, true, async () => null)
  await generate('15550101', {
    jdId: 'no-durable-fallback', jd: 'EASM role',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 0)
  assert.match(said.at(-1), /exact Files resume you selected could not be verified/)
})
test('provider unavailability sends only an explicitly selected same-account Files resume', async () => {
  const { generate, docs } = harness(async () => { throw new Error('tailor must not run without a key') }, undefined, false)
  await generate('15550101', {
    jdId: 'provider-offline-selected', jd: 'EASM role',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH))
  assert.equal(docs.length, 1)
  assert.equal(docs[0].body, HOUSTON)
  assert.match(docs[0].caption, /^Original resume — NOT TAILORED/)
  assert.match(docs[0].caption, /No AI provider is configured/)
})

test('provider unavailability without explicit selection remains text-only', async () => {
  const { generate, docs, said } = harness(async () => { throw new Error('tailor must not run without a key') }, undefined, false)
  await generate('15550101', {
    jdId: 'provider-offline-unselected', jd: 'EASM role',
    resumePath: HOUSTON_PATH, resumeName: 'EASM Cybersecurity Engineer',
  }, TEST_USER_ID, 60_000, filesFor(HOUSTON_PATH, false))
  assert.equal(docs.length, 0)
  assert.match(said.at(-1), /Tailoring is unavailable/)
  assert.match(said.at(-1), /No exact Files resume was explicitly selected/)
})
