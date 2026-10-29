// Five cumulative folds of one rule: a WhatsApp resume run must leave a result.
// Each fold rechecks every earlier case. A tool the resume does not contain is
// taken off the skills line, including when that tool was written as the heading.
// A run that cannot send a file says so. It does not stop after "Updating".
import test from 'node:test'
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
  })
  return testModule.exports
}

test('fold 5: a run that cannot send a file says so instead of stopping', async () => {
  const said = []
  let runs = 0
  let file = null
  let samePerson = true
  let sendError = null
  const statuses = ['uncertain']
  const entries = new Map()
  const blob = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => file,
    getText: async key => entries.get(key) ?? null,
    delete: async key => { entries.delete(key) },
  }
  const acceptable = { token: 'result', score: 100, coverage: 40, supported_coverage: 100, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'coverage_met', matched: 10, total: 10, missing: [] } }
  const { generate } = load('src/app/api/whatsapp/webhook/route.ts', {
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('no voice') } },
    'next/server': {},
    '@/lib/storage': { blob, readPath: async () => Buffer.from('eshwarjay05@gmail.com'), writePath: async () => {}, deletePath: async () => {}, existsPath: async () => true },
    '@/lib/paths': { DATA_DIR: '/data' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => true, resolveKeys: () => ({}), tailorKeys: k => k },
    '@/lib/tailor': { runTailor: async () => { runs++; return acceptable } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer', company: '', location: '' }) },
    '@/lib/whatsapp': { sendText: async (_to, message) => { said.push(message) }, sendDocument: async () => { if (sendError) throw sendError; return 'sent' } },
    '@/lib/owner': { isOwnerWhatsApp: () => false },
    '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) },
    '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity: () => samePerson },
    '@/lib/docx': { extractText: async b => b.toString(), outputNameFor: async () => 'Eshwar_Resume.docx' },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: () => false },
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': { live: slots => (slots || []).filter(Boolean), DIFFERENT_RESUME: '' },
    '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {},
    '@/lib/resume-library-store': {}, '@/lib/resume-library': { jobKeyOf: () => 'job' },
    '@/lib/made-floor': {}, '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
    '@/lib/whatsapp-resume-acceptance': load('src/lib/whatsapp-resume-acceptance.ts'),
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

  await generate('15550021', { jdId: 'stuck', jd: 'Cloud security job', resumePath: '/resume.docx' }, 'user')
  assert.equal(runs, 0, 'a run already in flight does not start a second silent one')
  assert.match(said.at(-1), /still being finished/)

  file = null
  await generate('15550021', { jdId: 'missing-file', jd: 'Cloud security job two', resumePath: '/resume.docx' }, 'user')
  assert.equal(runs, 1)
  assert.match(said.at(-1), /Word file could not be opened/)

  file = Buffer.from('jayeshwar44@gmail.com')
  samePerson = false
  await generate('15550021', { jdId: 'wrong-person', jd: 'Cloud security job three', resumePath: '/resume.docx' }, 'user')
  assert.equal(runs, 2)
  assert.match(said.at(-1), /changed the name or email/)

  file = Buffer.from('eshwarjay05@gmail.com')
  samePerson = true
  sendError = new Error('WA sendDoc 500: no')
  await generate('15550021', { jdId: 'refused', jd: 'Cloud security job four', resumePath: '/resume.docx' }, 'user')
  assert.equal(runs, 3)
  assert.match(said.at(-1), /WhatsApp refused it/)
  assert.equal(said.filter(t => /run stopped before a file/.test(t)).length, 0)
})
