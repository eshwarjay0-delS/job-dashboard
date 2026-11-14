import test from 'node:test'
import { etagBlobMethods } from './helpers/etag-blob.mjs'
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

    await fs.put('sessions/current', 'original')
    const first = await fs.getWithEtag('sessions/current')
    assert.ok(first?.etag)
    await fs.put('sessions/current', 'newer')
    assert.equal(await fs.putIfMatch('sessions/current', first.etag, 'stale'), false)
    assert.equal(await fs.getText('sessions/current'), 'newer', 'a stale conditional write cannot overwrite a newer session')
    const latest = await fs.getWithEtag('sessions/current')
    const concurrent = await Promise.all([
      fs.putIfMatch('sessions/current', latest.etag, 'winner-a'),
      fs.putIfMatch('sessions/current', latest.etag, 'winner-b'),
    ])
    assert.equal(concurrent.filter(Boolean).length, 1, 'only one concurrent writer may commit against the same ETag')

    let remoteBytes = Buffer.from('original')
    let remoteEtag = '"r2-original"'
    r2.s3 = { send: async command => {
      if (command.constructor.name === 'GetObjectCommand') {
        return { ETag: remoteEtag, Body: { transformToByteArray: async () => remoteBytes } }
      }
      if (command.constructor.name === 'PutObjectCommand') {
        if (command.input.IfMatch !== remoteEtag) throw { $metadata: { httpStatusCode: 412 } }
        remoteBytes = Buffer.from(command.input.Body)
        remoteEtag = '"r2-next"'
        return {}
      }
      throw new Error('unexpected R2 command')
    } }
    const remote = await r2.getWithEtag('sessions/current')
    assert.equal(remote.etag, '"r2-original"')
    remoteEtag = '"r2-concurrent-update"'
    assert.equal(await r2.putIfMatch('sessions/current', remote.etag, 'stale'), false)
    const remoteLatest = await r2.getWithEtag('sessions/current')
    assert.equal(await r2.putIfMatch('sessions/current', remoteLatest.etag, 'committed'), true)
    assert.equal((await r2.getWithEtag('sessions/current')).data.toString(), 'committed')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('R2 conditional writes treat 409 and 404 as retryable conflicts and propagate unexpected failures', async () => {
  const { R2Storage } = load('src/lib/storage.ts', {
    '@/lib/paths': { DATA_DIR: '/tmp/wa-r2-cas-status' },
    '@/lib/storagePolicy': { storageSegments: key => key.split('/'), storageMode: () => 'local' },
  }, '\nexport { R2Storage };')
  const r2 = new R2Storage('bucket', 'account', 'key', 'secret')

  for (const status of [409, 404]) {
    r2.s3 = { send: async command => {
      assert.equal(command.input.IfMatch, '"r2-expected"')
      throw { $metadata: { httpStatusCode: status } }
    } }
    assert.equal(
      await r2.putIfMatch('sessions/current', '"r2-expected"', 'must-not-overwrite'),
      false,
      `HTTP ${status} must trigger a bounded reread rather than an unconditional write`,
    )
  }

  r2.s3 = { send: async () => { throw { $metadata: { httpStatusCode: 500 } } } }
  await assert.rejects(
    r2.putIfMatch('sessions/current', '"r2-expected"', 'must-not-overwrite'),
    error => error?.$metadata?.httpStatusCode === 500,
    'unexpected storage failures must propagate instead of being treated as a conflict',
  )
})
test('same JD starts once concurrently and its lease releases for a deliberate retry', async () => {
  const entries = new Map()
  let providerAvailable = true, offlineMismatch = false, partialMode = false
  let sessionReadCount = 0
  let runs = 0, deliveries = 0, failNext = false, unchangedNext = false
  let failNextDocument = false, failAllDocuments = false, acceptedByProvider = true, sessionMutationDuringSend = null
  let sessionCasBarrier = null
  const said = []
  const docs = []
  const blob = {
    ...etagBlobMethods(entries, { beforePutIfMatch: async key => {
      if (key !== 'whatsapp/session-123.json' || !sessionCasBarrier) return
      const barrier = sessionCasBarrier
      sessionCasBarrier = null
      barrier.entered()
      await barrier.release
    } }),
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => Buffer.from('same@email.com'), getText: async key => entries.get(key) ?? null, delete: async key => { entries.delete(key) },
  }
  const mocks = {
    // These cases exercise resume tailoring; channel transport has its own acceptance suite.
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('Unexpected voice transcription in tailoring test') } },
    'next/server': {}, '@/lib/storage': { blob, readPath: async p => {
      if (offlineMismatch && p.startsWith('/data/users/')) return Buffer.from('other@email.com')
      if (p === '/data/whatsapp/inbox/123/selected.docx') {
        sessionReadCount++
        return Buffer.from(sessionReadCount % 2 === 1 ? 'same@email.com' : 'changed-after-verification@email.com')
      }
      return Buffer.from('same@email.com')
    }, writePath: async () => {}, deletePath: async () => {} },
    '@/lib/paths': { DATA_DIR: '/data', USER_RESUMES_DIR: '/data/users' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => providerAvailable },
    '@/lib/tailor': { runTailor: async () => { runs++; if (failNext) { failNext = false; throw new Error('provider timeout') } if (partialMode) return { token: 'partial-result', score: 100, coverage: 100, supported_coverage: 100, diff: [{ section: 'Experience', before: 'A', after: 'B' }], partial: { failed: 1, total: 5, pendingRoles: [2] }, unverified_added_keywords: [], quality_blockers: ['draft_parts_missing'], quality: { status: 'needs_review', matched: 10, total: 10, missing: [], incomplete: true }, ats: { score: 100, passed: true, checks: [], issues: [] } }; if (unchangedNext) { unchangedNext = false; return { token: 'unchanged-result', unchanged: true, score: 63, coverage: 63 } } return { token: 'result', score: 100, coverage: 100, supported_coverage: 100, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'coverage_met', matched: 10, total: 10, missing: [] }, /* Nov4 ATS contract: mocked deliverable results carry a passing ATS check */ ats: { score: 100, passed: true, checks: [], issues: [] } } } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer' }) },
    '@/lib/whatsapp': {
      sendText: async (_to, message) => { said.push(message) },
      sendDocument: async (_to, body, _name, caption) => {
        if (failNextDocument || failAllDocuments) { if (failNextDocument) failNextDocument = false; throw new Error('WA sendDoc 503: unavailable') }
        deliveries++
        docs.push({ body: Buffer.from(body).toString(), caption })
        if (sessionMutationDuringSend) {
          entries.set('whatsapp/session-123.json', JSON.stringify(sessionMutationDuringSend))
          sessionMutationDuringSend = null
        }
        return 'sent'
      },
    },
    '@/lib/owner': {}, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity },
    '@/lib/resume-round-trip-guard': { docxIdentityText: async bytes => Buffer.from(bytes).toString() }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: t => /pcnse|cissp/i.test(t) },
    '@/lib/whatsapp-trace': { trace: () => {} },
    // Delivery callbacks for inbox alerts (538d77d3, 22 Oct); no status callback is sent here.
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': {}, '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {}, '@/lib/resume-library-store': { markUsed: async () => {}, saveTailored: async () => null }, '@/lib/resume-library': {}, '@/lib/made-floor': {},
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
      markResumeDocumentAccepted: async () => acceptedByProvider,
      recordResumeDeliveryStatus: async () => {},
      readResumeRecovery: async () => ({ status: 'pending' }),
    },
  }
  const { generate, captionFor, resumeGapReport } = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { generate, captionFor, resumeGapReport };')
  const session = { jdId: 'jd-message', jd: 'job description', resumePath: '/data/whatsapp/inbox/123/unique.docx' }
  // The route now clears only a pair actually present in storage; seed the same pair the handler received.
  entries.set('whatsapp/session-123.json', JSON.stringify({ ...session, version: 3, resumeName: 'Unique', seen: [], updatedAt: Date.now() }))
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

  // Explicit 6 Nov owner policy: with no provider, only a verified selected
  // same-account library original may be sent, and it must say NOT TAILORED.
  const offlineUser = '00000000-0000-4000-8000-000000000001'
  const offlineSession = {
    jdId: 'offline-jd',
    jd: 'Cloud Security Engineer contract role',
    resumePath: '/data/whatsapp/inbox/123/selected.docx',
    resumeName: 'Cloud Security Engineer',
  }
  const offlineFiles = {
    userDir: `/data/users/${offlineUser}`,
    email: 'same@email.com',
    said: 'the selected Cloud Security resume',
    depth: 0,
    rel: 'same@email.com/Cloud Security Engineer.docx',
    abs: `/data/users/${offlineUser}/same@email.com/Cloud Security Engineer.docx`,
  }
  // A partial provider draft is not delivered. For an initial JD run, only the exact
  // selected same-account library bytes may be sent, clearly labelled NOT TAILORED.
  const partialSession = { ...offlineSession, jdId: 'partial-initial-run' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: partialSession.jdId, jd: partialSession.jd,
    resumePath: partialSession.resumePath, resumeName: partialSession.resumeName,
    seen: ['partial-initial'], updatedAt: Date.now(),
  }))
  sessionReadCount = 0
  providerAvailable = true
  partialMode = true
  const docsBeforePartialFallback = docs.length
  const readsBeforePartialFallback = sessionReadCount
  await generate('123', partialSession, offlineUser, undefined, offlineFiles)
  partialMode = false
  assert.equal(docs.length, docsBeforePartialFallback + 1, 'a partial initial rewrite uses one verified original fallback')
  assert.equal(sessionReadCount - readsBeforePartialFallback, 1, 'the session copy is read once and compared with the selected library bytes')
  assert.equal(docs.at(-1).body, 'same@email.com', 'only the exact selected library bytes are sent')
  assert.match(docs.at(-1).caption, /Original resume — NOT TAILORED/)
  assert.match(docs.at(-1).caption, /AI rewrite incomplete/)
  assert.match(docs.at(-1).caption, /no edits were applied/)
  const consumedPartial = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(consumedPartial.jd, undefined, 'the old pair is consumed only after the fallback is accepted')
  assert.equal(consumedPartial.resumePath, undefined)

  // If the selected library file no longer matches the session copy, a partial
  // draft must not fall back to the unverified session bytes.
  const partialMismatchSession = { ...offlineSession, jdId: 'partial-byte-mismatch' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: partialMismatchSession.jdId, jd: partialMismatchSession.jd,
    resumePath: partialMismatchSession.resumePath, resumeName: partialMismatchSession.resumeName,
    seen: ['partial-byte-mismatch'], updatedAt: Date.now(),
  }))
  providerAvailable = true
  partialMode = true
  offlineMismatch = true
  const docsBeforePartialMismatch = docs.length
  await generate('123', partialMismatchSession, offlineUser, undefined, offlineFiles)
  partialMode = false
  offlineMismatch = false
  assert.equal(docs.length, docsBeforePartialMismatch, 'a partial draft cannot send when selected and session bytes differ')
  const retainedPartialMismatch = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(retainedPartialMismatch.jdId, partialMismatchSession.jdId, 'an unaccepted fallback leaves the pair available for retry')

  providerAvailable = false
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: offlineSession.jdId, jd: offlineSession.jd,
    resumePath: offlineSession.resumePath, resumeName: offlineSession.resumeName,
    seen: ['offline-initial'], updatedAt: Date.now(),
  }))
  const readsBeforeOfflineFallback = sessionReadCount
  await generate('123', offlineSession, offlineUser, undefined, offlineFiles)
  assert.equal(sessionReadCount - readsBeforeOfflineFallback, 1, 'the verified library bytes are delivered without rereading a mutable session copy')
  assert.equal(runs, 5, 'offline fallback must not call the AI writer')
  assert.equal(deliveries, 6, 'the selected original is delivered once')
  assert.match(docs.at(-1).caption, /Original resume — NOT TAILORED/)
  assert.match(docs.at(-1).caption, /AI provider unavailable/)
  assert.match(docs.at(-1).caption, /no edits were applied/)
  assert.equal(docs.at(-1).body, 'same@email.com', 'the exact selected library bytes are sent')

  const consumedOffline = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(consumedOffline.jd, undefined, 'a successfully accepted offline original consumes its old JD')
  assert.equal(consumedOffline.jdId, undefined)
  assert.equal(consumedOffline.resumePath, undefined, 'the old inbox copy is not left attached to the next JD')
  assert.equal(consumedOffline.last.email, offlineFiles.email)
  assert.equal(consumedOffline.last.used, offlineFiles.rel)

  // A newer pair arriving while Meta accepts the fallback must not be erased.
  const raceSession = { ...offlineSession, jdId: 'offline-race' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: raceSession.jdId, jd: raceSession.jd,
    resumePath: raceSession.resumePath, resumeName: raceSession.resumeName,
    seen: ['race-old'], updatedAt: Date.now(),
  }))
  sessionReadCount = 0
  sessionMutationDuringSend = {
    version: 3, jdId: 'newer-jd', jd: 'A newer job description',
    resumePath: '/data/whatsapp/inbox/123/newer.docx', resumeName: 'Newer Resume',
    seen: ['newer'], updatedAt: Date.now(),
  }
  await generate('123', raceSession, offlineUser, undefined, offlineFiles)
  const preservedNewer = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(preservedNewer.jdId, 'newer-jd')
  assert.equal(preservedNewer.jd, 'A newer job description')
  assert.equal(preservedNewer.resumePath, '/data/whatsapp/inbox/123/newer.docx')
  assert.equal(preservedNewer.last.email, offlineFiles.email, 'the accepted document remains the last-used resume even when a newer pair survives')
  assert.equal(preservedNewer.last.used, offlineFiles.rel)

  // A newer JD may reuse the same resume path. Preserve both fields as one pair.
  const sameResumeRun = { ...offlineSession, jdId: 'offline-same-resume-race' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: sameResumeRun.jdId, jd: sameResumeRun.jd,
    resumePath: sameResumeRun.resumePath, resumeName: sameResumeRun.resumeName,
    seen: ['same-resume-old'], updatedAt: Date.now(),
  }))
  sessionReadCount = 0
  sessionMutationDuringSend = {
    version: 3, jdId: 'newer-jd-same-resume', jd: 'A newer JD using the same resume',
    resumePath: sameResumeRun.resumePath, resumeName: sameResumeRun.resumeName,
    seen: ['same-resume-new'], updatedAt: Date.now(),
  }
  await generate('123', sameResumeRun, offlineUser, undefined, offlineFiles)
  const preservedSameResume = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(preservedSameResume.jdId, 'newer-jd-same-resume')
  assert.equal(preservedSameResume.jd, 'A newer JD using the same resume')
  assert.equal(preservedSameResume.resumePath, sameResumeRun.resumePath)

  // A newer resume may arrive for the same JD. Do not clear the JD independently.
  const sameJdRun = { ...offlineSession, jdId: 'offline-same-jd-race' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: sameJdRun.jdId, jd: sameJdRun.jd,
    resumePath: sameJdRun.resumePath, resumeName: sameJdRun.resumeName,
    seen: ['same-jd-old'], updatedAt: Date.now(),
  }))
  sessionReadCount = 0
  sessionMutationDuringSend = {
    version: 3, jdId: sameJdRun.jdId, jd: sameJdRun.jd,
    resumePath: '/data/whatsapp/inbox/123/newer-resume.docx', resumeName: 'Newer Resume',
    seen: ['same-jd-new'], updatedAt: Date.now(),
  }
  await generate('123', sameJdRun, offlineUser, undefined, offlineFiles)
  const preservedSameJd = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(preservedSameJd.jdId, sameJdRun.jdId)
  assert.equal(preservedSameJd.jd, sameJdRun.jd)
  assert.equal(preservedSameJd.resumePath, '/data/whatsapp/inbox/123/newer-resume.docx')

  sessionReadCount = 0
  sessionMutationDuringSend = null
  // Barrier-controlled race: a newer webhook commits after the old run reads its
  // session snapshot but before its conditional write. The old consumer must retry.
  const casWindowRun = { ...offlineSession, jdId: 'offline-cas-window' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: casWindowRun.jdId, jd: casWindowRun.jd,
    resumePath: casWindowRun.resumePath, resumeName: casWindowRun.resumeName,
    seen: ['cas-window-old'], updatedAt: Date.now(),
  }))
  let casEnteredResolve
  const casEntered = new Promise(resolve => { casEnteredResolve = resolve })
  let casReleaseResolve
  const casRelease = new Promise(resolve => { casReleaseResolve = resolve })
  sessionCasBarrier = { entered: casEnteredResolve, release: casRelease }
  const casWindowSend = generate('123', casWindowRun, offlineUser, undefined, offlineFiles)
  await casEntered
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: 'newer-after-cas-read', jd: 'A newer JD committed inside the CAS window',
    resumePath: '/data/whatsapp/inbox/123/newer-after-cas-read.docx',
    resumeName: 'Newer After CAS Read', seen: ['cas-window-new'], updatedAt: Date.now(),
  }))
  casReleaseResolve()
  await casWindowSend
  const afterCasWindow = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(afterCasWindow.jdId, 'newer-after-cas-read')
  assert.equal(afterCasWindow.jd, 'A newer JD committed inside the CAS window')
  assert.equal(afterCasWindow.resumePath, '/data/whatsapp/inbox/123/newer-after-cas-read.docx')
  assert.equal(afterCasWindow.last.email, offlineFiles.email, 'last-used bookkeeping survives the CAS retry')

  // A refused document send leaves the matching pair intact for retry.
  const failedSendSession = { ...offlineSession, jdId: 'offline-send-failure' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: failedSendSession.jdId, jd: failedSendSession.jd,
    resumePath: failedSendSession.resumePath, resumeName: failedSendSession.resumeName,
    seen: ['failed-send'], updatedAt: Date.now(),
  }))
  sessionReadCount = 0
  failNextDocument = true
  const docsBeforeFailedSend = docs.length
  await generate('123', failedSendSession, offlineUser, undefined, offlineFiles)
  const retainedAfterFailedSend = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(docs.length, docsBeforeFailedSend, 'a rejected Meta send does not count as delivery')
  assert.equal(retainedAfterFailedSend.jdId, failedSendSession.jdId)
  assert.equal(retainedAfterFailedSend.jd, failedSendSession.jd)
  assert.equal(retainedAfterFailedSend.resumePath, failedSendSession.resumePath)


  // The provider-backed rewrite path must also retain the exact pair when both
  // the tailored upload and its same-account fallback are explicitly rejected.
  const failedTailoredSession = { ...offlineSession, jdId: 'tailored-send-failure' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: failedTailoredSession.jdId, jd: failedTailoredSession.jd,
    resumePath: failedTailoredSession.resumePath, resumeName: failedTailoredSession.resumeName,
    seen: ['failed-tailored-send'], updatedAt: Date.now(),
  }))
  sessionReadCount = 0
  providerAvailable = true
  failAllDocuments = true
  const docsBeforeTailoredFailure = docs.length
  await generate('123', failedTailoredSession, offlineUser, undefined, offlineFiles)
  failAllDocuments = false
  providerAvailable = false
  const retainedAfterTailoredFailure = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(docs.length, docsBeforeTailoredFailure, 'neither rejected tailored nor fallback upload counts as delivery')
  assert.equal(retainedAfterTailoredFailure.jdId, failedTailoredSession.jdId)
  assert.equal(retainedAfterTailoredFailure.jd, failedTailoredSession.jd)
  assert.equal(retainedAfterTailoredFailure.resumePath, failedTailoredSession.resumePath)


  // A Meta message ID is not enough when the signed delivery callback has
  // already rejected the document and scheduled recovery; retain the pair.
  const callbackRetrySession = { ...offlineSession, jdId: 'callback-retry-pair' }
  entries.set('whatsapp/session-123.json', JSON.stringify({
    version: 3, jdId: callbackRetrySession.jdId, jd: callbackRetrySession.jd,
    resumePath: callbackRetrySession.resumePath, resumeName: callbackRetrySession.resumeName,
    seen: ['callback-retry'], updatedAt: Date.now(),
  }))
  sessionReadCount = 0
  providerAvailable = true
  // The upload succeeds and returns a message ID; the signed callback has already marked it failed.
  acceptedByProvider = false
  const docsBeforeCallbackRetry = docs.length
  await generate('123', callbackRetrySession, offlineUser, undefined, offlineFiles)
  acceptedByProvider = true
  providerAvailable = false
  const retainedAfterCallbackRetry = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(docs.length, docsBeforeCallbackRetry + 1, 'the original fallback got a message ID but the signed callback rejected it')
  assert.equal(retainedAfterCallbackRetry.jdId, callbackRetrySession.jdId)
  assert.equal(retainedAfterCallbackRetry.jd, callbackRetrySession.jd)
  assert.equal(retainedAfterCallbackRetry.resumePath, callbackRetrySession.resumePath)


  const beforeMismatch = docs.length
  offlineMismatch = true
  await generate('123', { ...offlineSession, jdId: 'offline-byte-mismatch' }, offlineUser, undefined, offlineFiles)
  assert.equal(docs.length, beforeMismatch, 'a library/session byte mismatch must not send a fallback')
  assert.match(said.at(-1), /could not verify or send the selected same-account resume/)

  offlineMismatch = false
  const wrongRootFiles = { ...offlineFiles, userDir: '/data/users/some-other-account' }
  const beforeWrongRoot = docs.length
  await generate('123', { ...offlineSession, jdId: 'offline-root-mismatch' }, offlineUser, undefined, wrongRootFiles)
  assert.equal(docs.length, beforeWrongRoot, 'a different account root must not send a fallback')
  assert.match(said.at(-1), /could not verify or send the selected same-account resume/)

  const mismatchedRelFiles = { ...offlineFiles, rel: 'other@email.com/Cloud Security Engineer.docx' }
  const beforeRelMismatch = docs.length
  await generate('123', { ...offlineSession, jdId: 'offline-relative-path-mismatch' }, offlineUser, undefined, mismatchedRelFiles)
  assert.equal(docs.length, beforeRelMismatch, 'a relative library path that does not resolve to the selected file must not send')
  assert.match(said.at(-1), /could not verify or send the selected same-account resume/)

  const beforeUnselected = docs.length
  await generate('123', { ...offlineSession, jdId: 'offline-upload' }, 'user')
  assert.equal(docs.length, beforeUnselected, 'an upload or unselected resume is not eligible for the library fallback')
  assert.match(said.at(-1), /no same-account library resume was selected/)
  assert.ok(caption.split('\n').length <= 5)
})

test('a below-floor rewrite still delivers the Word file and names what is missing', async () => {
  const entries = new Map()
  const said = []
  const docs = []
  const blob = {
    ...etagBlobMethods(entries),
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
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/resume-round-trip-guard': { docxIdentityText: async bytes => Buffer.from(bytes).toString() }, '@/lib/docx': { extractText: async b => b.toString() },
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

test('a reply to a hold uses confirmed evidence and never sends a baseline when refinement fails', async () => {
  const entries = new Map()
  const said = []
  let deliveries = 0, captured = null, heldNext = false, failNext = false
  const docs = []
  const { createHash } = require('node:crypto')
  const blob = {
    ...etagBlobMethods(entries),
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
    '@/lib/tailor': { runTailor: async opts => { captured = opts; if (failNext) { failNext = false; throw new Error('provider timeout') } if (heldNext) return { token: 'redo-held', edits: { extras: [] }, partial: true, score: 40, coverage: 40, supported_coverage: 40, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: ['draft_parts_missing'], quality: { status: 'needs_review', matched: 4, total: 10, missing: ['splunk'], incomplete: true }, ats: { score: 100, passed: true, checks: [], issues: [] } }; return { token: 'redo', edits: { extras: [] }, score: 100, coverage: 100, supported_coverage: 100, diff: [{ section: 'Experience', before: 'A', after: 'B' }], unverified_added_keywords: [], quality_blockers: [], quality: { status: 'coverage_met', matched: 10, total: 10, missing: [] }, ats: { score: 100, passed: true, checks: [], issues: [] } } } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer' }) },
    '@/lib/whatsapp': { sendText: async (_to, message) => { said.push(message); return 'wamid.hold2' }, sendDocument: async (_to, _body, _name, caption) => { deliveries++; docs.push(caption); return 'sent' } },
    '@/lib/owner': {}, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/resume-round-trip-guard': { docxIdentityText: async bytes => Buffer.from(bytes).toString() }, '@/lib/docx': { extractText: async b => b.toString() },
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
  assert.equal(deliveries, 1, 'an incomplete refinement must not send the original or a partial baseline')
  assert.equal(docs.length, 1, 'only the successful rewritten version was delivered')
  assert.match(said.at(-1), /No file was sent; your previous resume is unchanged/)
  failNext = true
  await refine('123', 'wamid.hold1', 'I have experience with Splunk and AWS', 'user')
  assert.equal(deliveries, 1, 'a provider failure must not send the original baseline')
  assert.equal(docs.length, 1)
  assert.match(said.at(-1), /No file was sent; your previous resume is unchanged/)
})

test('a partial hold names the unfinished sections and invites a reply-redo; other holds do not', async () => {
  // Nov 5, 06:08 hold: the draft covered the JD and passed ATS, yet the generic
  // fallthrough said only "the quality report is incomplete" — the run knew
  // which sections never came back (result.partial) and never said so.
  const entries = new Map()
  const blob = {
    ...etagBlobMethods(entries),
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
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/resume-round-trip-guard': { docxIdentityText: async bytes => Buffer.from(bytes).toString() }, '@/lib/docx': { extractText: async b => b.toString() },
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
