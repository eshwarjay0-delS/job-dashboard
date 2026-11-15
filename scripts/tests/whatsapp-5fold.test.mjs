// Five cumulative folds of one rule: a WhatsApp resume run must leave a result.
// Each fold rechecks every earlier case. A tool the resume does not contain is
// taken off the skills line, including when that tool was written as the heading.
// A run that cannot send a file says so. It does not stop after "Updating".
import test from 'node:test'
import { etagBlobMethods } from './helpers/etag-blob.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { withoutUnsupportedSkills } from '../../src/lib/keyword-targets.ts'

const require = createRequire(import.meta.url)
const source = 'Operated Microsoft Sentinel and Splunk for detection.'

const folds = [
  {
    name: 'a comma-separated skills line drops PW-6000 and keeps Sentinel',
    line: 'Security tools: Sentinel, PW-6000, Splunk.',
    banned: ['pw-6000', 'sentinel', 'splunk'],
    expect: 'Security tools: Sentinel, Splunk.',
  },
  {
    name: 'a pipe-separated skills line drops PW-7000',
    line: 'SIEM | Splunk | PW-7000 | Sentinel.',
    banned: ['pw-7000'],
    expect: 'SIEM | Splunk | Sentinel.',
  },
  {
    name: 'a bullet skills line drops a multi-word unconfirmed product',
    line: 'Tools: Sentinel • Pro-Watch PW-6000 • Splunk',
    banned: ['pro-watch', 'pw-6000'],
    expect: 'Tools: Sentinel • Splunk',
  },
  {
    name: 'an unconfirmed tool used as the heading is not left as the category',
    line: 'PW-6000: Sentinel, Splunk.',
    banned: ['pw-6000'],
    expect: 'Sentinel, Splunk.',
  },
  {
    name: 'a mixed heading keeps the real category and drops the unconfirmed tool',
    line: 'Identity and PW-6000: Sentinel, Splunk.',
    banned: ['pw-6000'],
    expect: 'Identity: Sentinel, Splunk.',
  },
]

function lineOf(fold) {
  const out = withoutUnsupportedSkills([{ idx: 1, text: fold.line }], source, fold.banned)
  return out.length ? out[0].text : fold.line
}

for (let n = 1; n <= folds.length; n++) {
  test(`fold ${n} rechecks every skills line through ${folds[n - 1].name}`, () => {
    for (const fold of folds.slice(0, n)) assert.equal(lineOf(fold), fold.expect, fold.name)
  })
}

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

test('fold 5: a run that cannot send a file says so instead of stopping', async () => {
  const said = []
  const docs = []
  let runs = 0
  let file = null
  let samePerson = true
  let mismatchLibraryBytes = false
  let providerAvailable = true
  let missingUploadLibrary = false
  let uploadLibraryBytes = 'eshwarjay05@gmail.com'
  let uploadSessionBytes = 'eshwarjay05@gmail.com'
  let uploadProfileEmail = 'eshwarjay05@gmail.com'
  let sendError = null
  let hang = false
  let qualityIncomplete = false
  const statuses = ['uncertain']
  const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'
  const selectedFiles = { userDir: `/data/users/${TEST_USER_ID}`, email: 'eshwarjay05@gmail.com', said: 'Eshwar Resume', depth: 0, rel: 'selected.docx', abs: `/data/users/${TEST_USER_ID}/selected.docx` }
  const selectedSessionPath = `/data/users/${TEST_USER_ID}/session-copy.docx`
  const uploadLibraryPath = `/data/users/${TEST_USER_ID}/uploaded.docx`
  const uploadSessionPath = '/data/whatsapp/inbox/15550021/uploaded.docx'
  const entries = new Map()
  const blob = {
    ...etagBlobMethods(entries),
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => file,
    getText: async key => entries.get(key) ?? null,
    delete: async key => { entries.delete(key) },
  }
  const acceptable = { token: 'result', score: 100, coverage: 100, supported_coverage: 100, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'coverage_met', matched: 10, total: 10, missing: [] }, /* Nov4 ATS contract: mocked deliverable results carry a passing ATS check */ ats: { score: 100, passed: true, checks: [], issues: [] } }
  const { generate } = load('src/app/api/whatsapp/webhook/route.ts', {
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('no voice') } },
    'next/server': {},
    '@/lib/storage': {
      blob,
      readPath: async filePath => {
        if (filePath === uploadLibraryPath) return missingUploadLibrary ? null : Buffer.from(uploadLibraryBytes)
        if (filePath === uploadSessionPath) return Buffer.from(uploadSessionBytes)
        if (filePath === selectedFiles.abs) return Buffer.from('eshwarjay05@gmail.com')
        if (filePath === selectedSessionPath) return Buffer.from(mismatchLibraryBytes ? 'different-session-copy' : 'eshwarjay05@gmail.com')
        return Buffer.from('eshwarjay05@gmail.com')
      },
      writePath: async () => {}, deletePath: async () => {}, existsPath: async () => true
    },
    '@/lib/paths': { DATA_DIR: '/data', USER_RESUMES_DIR: '/data/users' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => providerAvailable, resolveKeys: () => ({}), tailorKeys: k => k },
    '@/lib/tailor': { runTailor: () => { runs++; return hang ? new Promise(() => {}) : Promise.resolve(qualityIncomplete ? { ...acceptable, partial: true, coverage: 94, supported_coverage: 94, quality_blockers: ['quality_incomplete'], quality: { status: 'incomplete', incomplete: true, matched: 9, total: 10, missing: ['CCSP'] } } : acceptable) } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer', company: '', location: '' }) },
    '@/lib/whatsapp': { sendText: async (_to, message) => { said.push(message) }, sendDocument: async (_to, body, _name, caption) => { if (sendError) throw sendError; docs.push({ body: Buffer.from(body).toString(), caption }); return 'sent' } },
    '@/lib/owner': { isOwnerWhatsApp: () => false },
    '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) },
    '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity: () => samePerson },
    '@/lib/resume-round-trip-guard': { docxIdentityText: async bytes => Buffer.from(bytes).toString() },
    '@/lib/docx': { extractText: async b => b.toString(), outputNameFor: async () => 'Eshwar_Resume.docx' },
    '@/lib/supabase/service': {
      serviceClientAvailable: () => true,
      createServiceClient: () => ({
        from: table => ({
          select: () => ({
            eq: (_column, id) => ({
              maybeSingle: async () => ({
                data: table === 'profiles' && id === TEST_USER_ID ? { email: uploadProfileEmail } : null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    },
    '@/lib/keyword-targets': { isCertification: () => false },
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': { live: slots => (slots || []).filter(Boolean), DIFFERENT_RESUME: '' },
    '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {},
    '@/lib/resume-library-store': {}, '@/lib/resume-library': { jobKeyOf: () => 'job' },
    '@/lib/made-floor': {}, '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
    '@/lib/whatsapp-recovery-budget': load('src/lib/whatsapp-recovery-budget.ts'),
    '@/lib/whatsapp-upload-age': load('src/lib/whatsapp-upload-age.ts'),
    '@/lib/whatsapp-resume-acceptance': load('src/lib/whatsapp-resume-acceptance.ts'),
    '@/lib/resume-evidence': load('src/lib/resume-evidence.ts'),
    '@/lib/resume-risk': load('src/lib/resume-risk.ts'),
    '@/lib/whatsapp-resume-recovery': {
      enqueueResumeRecovery: async input => ({ ...input, status: statuses.shift() || 'pending' }),
      patchResumeRecovery: async () => {},
      deferResumeRecovery: async () => {},
      dueResumeRecoveries: async () => [],
      markResumeDocumentAccepted: async () => true,
      recordResumeDeliveryStatus: async () => {},
      readResumeRecovery: async () => ({ status: 'pending' }),
    },
  }, '\nexport { generate };')

  await generate('15550021', { jdId: 'stuck', jd: 'Cloud security job', resumePath: selectedSessionPath }, TEST_USER_ID, 60_000, selectedFiles)
  assert.equal(runs, 0, 'an uncertain Meta upload is not sent again')
  assert.match(said.at(-1), /document upload is unconfirmed/)

  file = null
  await generate('15550021', { jdId: 'missing-file', jd: 'Cloud security job two', resumePath: selectedSessionPath }, TEST_USER_ID, 60_000, selectedFiles)
  assert.equal(runs, 1)
  assert.equal(docs.length, 1, 'a missing tailored file still delivers the chosen resume')
  assert.match(docs[0].caption, /updated Word file could not be opened/)
  assert.match(docs[0].caption, /closest matching resume/)
  assert.match(docs[0].body, /eshwarjay05@gmail.com/)
  assert.doesNotMatch(docs[0].caption, /No incomplete file was delivered/)

  docs.length = 0
  file = Buffer.from('jayeshwar44@gmail.com')
  samePerson = false
  await generate('15550021', { jdId: 'wrong-person', jd: 'Cloud security job three', resumePath: selectedSessionPath }, TEST_USER_ID, 60_000, selectedFiles)
  assert.equal(runs, 2)
  assert.equal(docs.length, 1, 'an identity mismatch does not send the rewritten file')
  assert.match(docs[0].body, /eshwarjay05@gmail.com/)
  assert.doesNotMatch(docs[0].body, /jayeshwar44/)
  assert.match(docs[0].caption, /identity\/contact\/date verification/)
  assert.match(docs[0].caption, /closest matching resume/)

  file = Buffer.from('eshwarjay05@gmail.com')
  samePerson = true
  sendError = new Error('WA sendDoc 500: no')
  await generate('15550021', { jdId: 'refused', jd: 'Cloud security job four', resumePath: selectedSessionPath }, TEST_USER_ID, 60_000, selectedFiles)
  assert.equal(runs, 3)
  assert.match(said.at(-1), /run stopped before a file/)
  assert.match(said.at(-1), /saved, and MarketFit will try again/)

  mismatchLibraryBytes = true
  sendError = null
  hang = true
  const docsBeforeTimeout = docs.length
  const stalled = generate('15550021', { jdId: 'stalled', jd: 'Cloud security job five', resumePath: selectedSessionPath }, TEST_USER_ID, 300, selectedFiles)
  const timed = await Promise.race([stalled.then(() => 'done'), new Promise(resolve => setTimeout(() => resolve('still waiting'), 2000))])
  assert.equal(timed, 'done')
  assert.equal(runs, 4, 'the fifth fold reached the timed-out rewrite')
  assert.equal(docs.length, docsBeforeTimeout, 'a selected-library/session byte mismatch must not send a document')
  assert.match(said.at(-1), /could not verify the exact selected same-account resume/)
  assert.match(said.at(-1), /No file was sent; your request is saved for retry/)

  // The original WhatsApp upload path has no Files-picker context. It may use only
  // the same-account copy filed by saveUpload, byte-equal to the inbox source and
  // identity-checked against the authenticated profiles.email row.
  providerAvailable = false
  hang = false
  mismatchLibraryBytes = false
  sendError = null
  docs.length = 0
  said.length = 0
  uploadLibraryBytes = 'eshwarjay05@gmail.com'
  uploadSessionBytes = 'eshwarjay05@gmail.com'
  uploadProfileEmail = 'eshwarjay05@gmail.com'
  missingUploadLibrary = false
  await generate('15550021', {
    jdId: 'uploaded-no-provider',
    jd: 'Cloud security upload job',
    resumePath: uploadSessionPath,
    resumeFiled: uploadLibraryPath,
  }, TEST_USER_ID, 60_000)
  assert.equal(runs, 4, 'provider-unavailable upload fallback does not invoke the model')
  assert.equal(docs.length, 1, 'the exact same-account filed copy can be used for an uploaded DOCX')
  assert.equal(docs[0].body, 'eshwarjay05@gmail.com', 'the sent bytes are the verified filed original')
  assert.match(docs[0].caption, /NOT TAILORED/)
  assert.match(docs[0].caption, /original resume/i)

  docs.length = 0
  await generate('15550021', {
    jdId: 'uploaded-foreign-root',
    jd: 'Cloud security upload job foreign root',
    resumePath: uploadSessionPath,
    resumeFiled: '/data/users/foreign-account/uploaded.docx',
  }, TEST_USER_ID, 60_000)
  assert.equal(docs.length, 0, 'a filed path outside the verified account root is never sent')

  missingUploadLibrary = true
  await generate('15550021', {
    jdId: 'uploaded-missing-copy',
    jd: 'Cloud security upload job missing copy',
    resumePath: uploadSessionPath,
    resumeFiled: uploadLibraryPath,
  }, TEST_USER_ID, 60_000)
  assert.equal(docs.length, 0, 'a missing filed copy never falls back to the inbox bytes')

  missingUploadLibrary = false
  uploadLibraryBytes = 'eshwarjay05@gmail.com'
  uploadSessionBytes = 'different-inbox-bytes'
  await generate('15550021', {
    jdId: 'uploaded-byte-mismatch',
    jd: 'Cloud security upload job byte mismatch',
    resumePath: uploadSessionPath,
    resumeFiled: uploadLibraryPath,
  }, TEST_USER_ID, 60_000)
  assert.equal(docs.length, 0, 'the filed copy must match the uploaded inbox source byte-for-byte')

  uploadLibraryBytes = 'other-person@example.com'
  uploadSessionBytes = 'other-person@example.com'
  uploadProfileEmail = 'eshwarjay05@gmail.com'
  await generate('15550021', {
    jdId: 'uploaded-profile-mismatch',
    jd: 'Cloud security upload job profile mismatch',
    resumePath: uploadSessionPath,
    resumeFiled: uploadLibraryPath,
  }, TEST_USER_ID, 60_000)
  assert.equal(docs.length, 0, 'the resume email is not substituted for the authenticated account profile email')

  uploadLibraryBytes = 'eshwarjay05@gmail.com'
  uploadSessionBytes = 'eshwarjay05@gmail.com'
  uploadProfileEmail = ''
  await generate('15550021', {
    jdId: 'uploaded-profile-unavailable',
    jd: 'Cloud security upload job profile unavailable',
    resumePath: uploadSessionPath,
    resumeFiled: uploadLibraryPath,
  }, TEST_USER_ID, 60_000)
  assert.equal(docs.length, 0, 'missing verified account email fails closed')

  // The 17 Oct screenshot shows an initial-JD draft held below the 98% target.
  // When that quality gate remains incomplete, return only the verified uploaded
  // original; never send the incomplete generated draft.
  providerAvailable = true
  qualityIncomplete = true
  uploadProfileEmail = 'eshwarjay05@gmail.com'
  uploadLibraryBytes = 'eshwarjay05@gmail.com'
  uploadSessionBytes = 'eshwarjay05@gmail.com'
  docs.length = 0
  said.length = 0
  await generate('15550021', {
    jdId: 'uploaded-quality-hold',
    jd: 'Cloud security upload job with a strict supported-coverage target',
    resumePath: uploadSessionPath,
    resumeFiled: uploadLibraryPath,
  }, TEST_USER_ID, 60_000)
  assert.equal(runs, 6, 'an incomplete first pass receives one bounded fresh rewrite')
  assert.equal(docs.length, 1, 'the quality hold returns the verified uploaded original instead of stopping without a file')
  assert.equal(docs[0].body, 'eshwarjay05@gmail.com', 'the incomplete generated draft is never sent')
  assert.match(docs[0].caption, /NOT TAILORED/)
  assert.match(docs[0].caption, /rewrite incomplete/i)
  qualityIncomplete = false
})
