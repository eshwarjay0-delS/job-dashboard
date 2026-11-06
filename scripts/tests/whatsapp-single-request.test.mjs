import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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
const { sameResumeIdentity } = load('src/lib/resume-identity.ts', {
  '@/lib/resume-round-trip-guard': load('src/lib/resume-round-trip-guard.ts'),
  '@/lib/jd-terms-gate': load('src/lib/jd-terms-gate.ts'),
})
test('rejects swapped identities and an extra identity, preserves unchanged email', () => {
  assert.equal(sameResumeIdentity('jayeshwar44@gmail.com', 'eshwarjay05@gmail.com'), false)
  assert.equal(sameResumeIdentity('jayeshwar44@gmail.com', 'jayeshwar44@gmail.com eshwarjay05@gmail.com'), false)
  // Email case alone is not a change; the round-trip guard (gate on) also reads the first line as the name, so check it off.
  process.env.JD_TERMS_ALWAYS_ON_SKILLS = '0'
  try { assert.equal(sameResumeIdentity('JAYESHWAR44@gmail.com', 'jayeshwar44@gmail.com'), true) } finally { delete process.env.JD_TERMS_ALWAYS_ON_SKILLS }
})
test('with the job-post terms gate on, a changed phone or date stops the send; an unchanged file passes', () => {
  // Gate on with a real name line: an email that differs only in letter case is the same resume.
  assert.equal(sameResumeIdentity('Eshwar Jay\nJAYESHWAR44@gmail.com', 'Eshwar Jay\njayeshwar44@gmail.com'), true)
  const src = 'Eshwar Jay\njayeshwar44@gmail.com | (312) 555-0142\nAnalyst, Acme  Jan 2021 - Mar 2024'
  assert.equal(sameResumeIdentity(src, src), true)
  assert.equal(sameResumeIdentity(src, src.replace('0142', '0143')), false)
  assert.equal(sameResumeIdentity(src, src.replace('Jan 2021', 'Jan 2020')), false)
})
test('concurrent storage claims produce exactly one winner and propagate storage failures', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wa-claim-'))
  try {
    const { FsStorage, R2Storage } = load('src/lib/storage.ts', {
      '@/lib/paths': { DATA_DIR: root },
      '@/lib/storagePolicy': { storageSegments: key => key.split('/'), storageMode: () => 'local' },
    }, '\nexport { FsStorage, R2Storage };')
    const fs = new FsStorage(root)
    const won = await Promise.all(Array.from({ length: 30 }, () => fs.putIfAbsent('jobs/request', '1')))
    assert.equal(won.filter(Boolean).length, 1)
    const r2 = new R2Storage('bucket', 'account', 'key', 'secret')
    r2.s3 = { send: async command => { assert.equal(command.input.IfNoneMatch, '*'); throw { $metadata: { httpStatusCode: 412 } } } }
    assert.equal(await r2.putIfAbsent('jobs/request', '1'), false)
    r2.s3 = { send: async () => { throw new Error('storage offline') } }
    await assert.rejects(r2.putIfAbsent('jobs/request', '1'), /storage offline/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('same JD starts once concurrently and its lease releases for a deliberate retry', async () => {
  const entries = new Map()
  let runs = 0, deliveries = 0, failNext = false, unchangedNext = false
  const said = []
  const docs = []
  const blob = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => Buffer.from('same@email.com'), getText: async key => entries.get(key) ?? null, delete: async key => { entries.delete(key) },
  }
  const mocks = {
    // These cases exercise resume tailoring; channel transport has its own acceptance suite.
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('Unexpected voice transcription in tailoring test') } },
    'next/server': {}, '@/lib/storage': { blob, readPath: async () => Buffer.from('same@email.com'), writePath: async () => {}, deletePath: async () => {} },
    '@/lib/paths': { DATA_DIR: '/data' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => true },
    '@/lib/tailor': { runTailor: async () => { runs++; if (failNext) { failNext = false; throw new Error('provider timeout') } if (unchangedNext) { unchangedNext = false; return { token: 'unchanged-result', unchanged: true, score: 63, coverage: 63 } } return { token: 'result', score: 100, coverage: 100, supported_coverage: 100, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'coverage_met', matched: 10, total: 10, missing: [] }, /* Nov4 ATS contract: mocked deliverable results carry a passing ATS check */ ats: { score: 100, passed: true, checks: [], issues: [] } } } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer' }) },
    '@/lib/whatsapp': { sendText: async (_to, message) => { said.push(message) }, sendDocument: async (_to, body, _name, caption) => { deliveries++; docs.push({ body: Buffer.from(body).toString(), caption }); return 'sent' } },
    '@/lib/owner': {}, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: t => /pcnse|cissp/i.test(t) },
    '@/lib/whatsapp-trace': { trace: () => {} },
    // Delivery callbacks for inbox alerts (538d77d3, 22 Oct); no status callback is sent here.
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': {}, '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {}, '@/lib/resume-library-store': {}, '@/lib/resume-library': {}, '@/lib/made-floor': {},
    '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
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
  const { generate, captionFor, resumeGapReport } = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { generate, captionFor, resumeGapReport };')
  const session = { jdId: 'jd-message', jd: 'job description', resumePath: '/data/whatsapp/inbox/123/unique.docx' }
  await Promise.all([generate('123', session, 'user'), generate('123', session, 'user')])
  assert.equal(runs, 1)
  assert.equal(deliveries, 1)
  assert.equal([...entries.keys()].some(key => key.startsWith('whatsapp/jobs/')), false, 'completed work must not leave a permanent claim')
  await generate('123', session, 'user')
  assert.equal(runs, 2, 'resending the same pair deliberately can retry instead of disappearing')
  assert.equal(deliveries, 2)
  failNext = true
  await generate('123', session, 'user')
  assert.equal(runs, 3)
  assert.equal(deliveries, 3, 'a failed rewrite still delivers the chosen resume')
  assert.match(docs.at(-1).caption, /closest matching resume/)
  assert.match(docs.at(-1).caption, /stopped before it finished/)
  assert.equal(docs.at(-1).body, 'same@email.com')
  assert.doesNotMatch(docs.at(-1).caption, /No incomplete file was delivered/)
  assert.doesNotMatch(said.at(-1) || '', /provider timeout/)
  assert.equal([...entries.keys()].some(key => key.startsWith('whatsapp/jobs/')), false, 'a failed rewrite also releases its claim')
  await generate('123', session, 'user')
  assert.equal(runs, 4, 'the same request can recover immediately after provider failure')
  assert.equal(deliveries, 4)
  unchangedNext = true
  await generate('123', session, 'user')
  assert.equal(runs, 5)
  assert.equal(deliveries, 5, 'an unchanged rewrite delivers the chosen resume and does not call it tailored')
  assert.match(docs.at(-1).caption, /The rewrite produced no changes/)
  assert.match(docs.at(-1).caption, /was not rewritten/)
  assert.equal([...entries.keys()].some(key => key.startsWith('whatsapp/jobs/')), false, 'unchanged rewrite releases its claim')
  const saved = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(saved.resumePath, undefined)
  assert.equal(saved.jd, undefined)
  const caption = captionFor('Eshwar', { role: 'Engineer' }, { coverage: 63, quality: { status: 'needs_review' } })
  const gapCaption = captionFor('Eshwar', {}, { coverage: 28.5, quality: { status: 'needs_review', missing: ['f5', 'cisco'] } })
  assert.ok(gapCaption.includes('28.5%'))
  const gapReport = resumeGapReport({ coverage: 28.5, quality: { status: 'needs_review', missing: ['f5', 'cisco'] } })
  assert.match(gapReport, /Missing \/ unresolved JD terms: f5, cisco/)
  assert.doesNotMatch(gapReport, /Risk: Keyword review passed/)
  assert.ok(said.some(text => text.startsWith('*MFit Resume Gap & Risk Report*')), 'successful delivery is followed by the separate risk report')
  assert.ok(!gapCaption.includes('cut short'))
  assert.ok(!gapCaption.includes('could add'))
  assert.ok(caption.includes('63%'))
  assert.match(resumeGapReport({ coverage: 63, quality: { status: 'needs_review' } }), /Risk: Needs review/)
  assert.ok(!caption.includes('Draft:'))
  assert.ok(caption.split('\n').length <= 5)
})

test('a below-floor rewrite still delivers the Word file and names what is missing', async () => {
  const entries = new Map()
  const said = []
  const docs = []
  const blob = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => Buffer.from('same@email.com'), getText: async key => entries.get(key) ?? null, delete: async key => { entries.delete(key) },
  }
  const mocks = {
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('Unexpected voice transcription in tailoring test') } },
    'next/server': {}, '@/lib/storage': { blob, readPath: async () => Buffer.from('same@email.com'), writePath: async () => {}, deletePath: async () => {} },
    '@/lib/paths': { DATA_DIR: '/data' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => true },
    '@/lib/tailor': { runTailor: async () => ({ token: 'held-result', score: 40, coverage: 40, supported_coverage: 40, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'needs_review', matched: 4, total: 10, missing: ['splunk'] }, ats: { score: 100, passed: true, checks: [], issues: [] } }) },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer' }) },
    '@/lib/whatsapp': { sendText: async (_to, message) => { said.push(message); return 'wamid.hold1' }, sendDocument: async (_to, _body, _name, caption) => { docs.push(caption); return 'wamid.doc1' } },
    '@/lib/owner': {}, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: t => /pcnse|cissp/i.test(t) },
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': {}, '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {}, '@/lib/resume-library-store': {}, '@/lib/resume-library': {}, '@/lib/made-floor': {},
    '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
    '@/lib/whatsapp-recovery-budget': load('src/lib/whatsapp-recovery-budget.ts'),
    '@/lib/whatsapp-upload-age': load('src/lib/whatsapp-upload-age.ts'),
    '@/lib/whatsapp-resume-acceptance': load('src/lib/whatsapp-resume-acceptance.ts'),
    '@/lib/resume-risk': load('src/lib/resume-risk.ts'),
    '@/lib/resume-evidence': load('src/lib/resume-evidence.ts'),
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
  const session = { jdId: 'jd-message', jd: 'job description', resumePath: '/data/whatsapp/inbox/123/unique.docx', resumeName: 'EASM Cybersecurity Engineer' }
  await generate('123', session, 'user')
  assert.equal(docs.length, 1, 'a below-floor rewrite still delivers a Word file')
  assert.match(docs[0], /Still missing: splunk/)
  assert.match(docs[0], /40%/)
  assert.doesNotMatch(docs[0], /No incomplete file was delivered/)
  assert.doesNotMatch(said.join('\n'), /I did not send a file/)
  assert.doesNotMatch(said.join('\n'), /No incomplete file was delivered/)
})

test('a reply to a hold re-runs with the reply experience as evidence, and a still-below-floor redo still delivers', async () => {
  const entries = new Map()
  const said = []
  let deliveries = 0, captured = null, heldNext = false
  const docs = []
  const { createHash } = require('node:crypto')
  const blob = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => Buffer.from('same@email.com'), getText: async key => entries.get(key) ?? null, delete: async key => { entries.delete(key) },
  }
  const mocks = {
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('Unexpected voice transcription in tailoring test') } },
    'next/server': {}, '@/lib/storage': { blob, readPath: async () => Buffer.from('same@email.com'), writePath: async () => {}, deletePath: async () => {}, existsPath: async () => true },
    '@/lib/paths': { DATA_DIR: '/data' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => true },
    '@/lib/tailor': { runTailor: async opts => { captured = opts; if (heldNext) return { token: 'redo-held', edits: { extras: [] }, score: 40, coverage: 40, supported_coverage: 40, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'needs_review', matched: 4, total: 10, missing: ['splunk'] }, ats: { score: 100, passed: true, checks: [], issues: [] } }; return { token: 'redo', edits: { extras: [] }, score: 100, coverage: 100, supported_coverage: 100, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'coverage_met', matched: 10, total: 10, missing: [] }, ats: { score: 100, passed: true, checks: [], issues: [] } } } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer' }) },
    '@/lib/whatsapp': { sendText: async (_to, message) => { said.push(message); return 'wamid.hold2' }, sendDocument: async (_to, _body, _name, caption) => { deliveries++; docs.push(caption); return 'sent' } },
    '@/lib/owner': {}, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: t => /pcnse|cissp/i.test(t) },
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': {}, '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {}, '@/lib/resume-library-store': {}, '@/lib/resume-library': {}, '@/lib/made-floor': {},
    '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
    '@/lib/whatsapp-recovery-budget': load('src/lib/whatsapp-recovery-budget.ts'),
    '@/lib/whatsapp-upload-age': load('src/lib/whatsapp-upload-age.ts'),
    '@/lib/whatsapp-resume-acceptance': load('src/lib/whatsapp-resume-acceptance.ts'),
    '@/lib/resume-risk': load('src/lib/resume-risk.ts'),
    '@/lib/resume-evidence': load('src/lib/resume-evidence.ts'),
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
  const { refine } = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { refine };')
  const genKey = `whatsapp/gens/123/${createHash('sha1').update('wamid.hold1').digest('hex').slice(0, 24)}.json`
  entries.set(genKey, JSON.stringify({ userId: 'user', jd: 'job description', file: 'whatsapp/versions/123/base.docx', meta: { role: 'Engineer' }, changes: [], source: '/data/whatsapp/inbox/123/unique.docx', createdAt: Date.now(), held: true }))
  await refine('123', 'wamid.hold1', 'I have experience with Splunk and AWS', 'user')
  assert.equal(captured.immediatePrefs.length, 1)
  assert.equal(captured.immediatePrefs[0], 'I have experience with Splunk and AWS')
  assert.equal(deliveries, 1, 'a passing redo delivers')
  heldNext = true
  await refine('123', 'wamid.hold1', 'I have experience with Splunk and AWS', 'user')
  assert.equal(deliveries, 2, 'a still-below-floor redo still delivers the rewritten file')
  assert.ok(docs.some(text => text.includes('Still missing: splunk') && text.includes('40%')), 'the redo names the shortfall on the file')
  assert.doesNotMatch(said.join('\n'), /No incomplete file was delivered/)
})

test('a partial hold names the unfinished sections and invites a reply-redo; other holds do not', async () => {
  // Nov 5, 06:08 hold: the draft covered the JD and passed ATS, yet the generic
  // fallthrough said only "the quality report is incomplete" — the run knew
  // which sections never came back (result.partial) and never said so.
  const entries = new Map()
  const blob = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => Buffer.from('same@email.com'), getText: async key => entries.get(key) ?? null, delete: async key => { entries.delete(key) },
  }
  const mocks = {
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('Unexpected voice transcription in tailoring test') } },
    'next/server': {}, '@/lib/storage': { blob, readPath: async () => Buffer.from('same@email.com'), writePath: async () => {}, deletePath: async () => {} },
    '@/lib/paths': { DATA_DIR: '/data' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => true },
    '@/lib/tailor': { runTailor: async () => ({}) },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer' }) },
    '@/lib/whatsapp': { sendText: async () => 'wamid', sendDocument: async () => 'sent' },
    '@/lib/owner': {}, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: t => /pcnse|cissp/i.test(t) },
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': {}, '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {}, '@/lib/resume-library-store': {}, '@/lib/resume-library': {}, '@/lib/made-floor': {},
    '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
    '@/lib/whatsapp-recovery-budget': load('src/lib/whatsapp-recovery-budget.ts'),
    '@/lib/whatsapp-upload-age': load('src/lib/whatsapp-upload-age.ts'),
    '@/lib/whatsapp-resume-acceptance': load('src/lib/whatsapp-resume-acceptance.ts'),
    '@/lib/resume-risk': load('src/lib/resume-risk.ts'),
    '@/lib/resume-evidence': load('src/lib/resume-evidence.ts'),
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
  const { qualityStop } = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { qualityStop };')
  const base = {
    token: 'partial-result', score: 97, coverage: 97, supported_coverage: 97,
    diff: [{ section: 'Experience', before: 'A', after: 'B' }],
    unverified_added_keywords: [], quality_blockers: ['draft_parts_missing'],
    quality: { status: 'needs_review', matched: 97, total: 100, missing: [], incomplete: true },
    ats: { score: 100, passed: true, checks: [], issues: [] },
  }
  const named = qualityStop({ ...base, partial: { failed: 3, total: 5, pendingRoles: [1, 2], pendingProfile: true } })
  assert.match(named, /The rewrite did not finish/)
  assert.match(named, /the profile section and 2 experience sections/)
  assert.match(named, /Reply to this message and I will run it again/)
  const bare = qualityStop({ ...base, partial: { failed: 1, total: 3 } })
  assert.match(bare, /The rewrite did not finish/)
  assert.match(bare, /Reply to this message and I will run it again/)
  assert.doesNotMatch(bare, /profile section|experience section/)
  const other = qualityStop({ ...base, partial: undefined, quality_blockers: [], quality: { status: 'needs_review', matched: 97, total: 100, missing: [] } })
  assert.match(other, /The draft was held: the quality report does not clear the delivery bar/)
  assert.doesNotMatch(other, /did not finish|run it again/)
})
