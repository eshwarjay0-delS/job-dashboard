import test from 'node:test'
import assert from 'node:assert/strict'
import {REA_SESSIONS,filterReaSessions} from '../../src/lib/rea-register.ts'
import {readFileSync,existsSync} from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'../..')
test('each REA session retains source, ordered findings, boundaries and next action',()=>{
 assert.equal(new Set(REA_SESSIONS.map(s=>s.id)).size,REA_SESSIONS.length)
 for(const s of REA_SESSIONS){assert.ok(s.request&&s.limits&&s.next&&s.sources.length&&s.steps.length);for(const step of s.steps)assert.ok(step.label&&step.finding&&step.evidence);for(const source of s.sources)if(source.path)assert.ok(existsSync(path.join(root,source.path)),source.path)}
})
test('filters find Parakeet and keep tool failures distinct from public reviews',()=>{
 assert.ok(filterReaSessions('Parakeet','kompas','all').some(s=>s.id==='parakeet-kompas'))  // later sessions may cite Parakeet too
 const tool=filterReaSessions('','all','REA tool attempt');assert.ok(tool.length>=1);assert.equal(tool.find(s=>s.id==='rea-tool-inventory').state,'Blocked')
 assert.ok(filterReaSessions('','all','Public reference review').every(s=>s.method==='Public reference review'))
 assert.equal(filterReaSessions('Parakeet','gmail','all').length,0)
})
test('REA route inherits existing admin gate and is discoverable from hub',()=>{
 assert.match(readFileSync(path.join(root,'src/app/dashboard/admin/vision/layout.tsx'),'utf8'),/await requireVisionAdmin\(\)/)
 assert.match(readFileSync(path.join(root,'src/app/dashboard/admin/vision/page.tsx'),'utf8'),/href="\/dashboard\/admin\/vision\/rea"/)
})

test('released desktop browser remains deployed with acceptance still explicit',()=>{
 const entry=REA_SESSIONS.find(s=>s.id==='inclusive-browser-desktop')
 assert.ok(entry)
 assert.equal(entry.state,'Deployed, verification pending')
 assert.match(entry.limits,/real portal\/SSO\/upload\/restart acceptance pending/)
})


test('Oct 17 WhatsApp source recovery separates deployed code from blocked historical acceptance', () => {
 const entry=REA_SESSIONS.find(s=>s.id==='whatsapp-oct17-source-recovery-2026-11-10')
 assert.ok(entry)
 assert.equal(entry.state,'Deployed, verification pending')
 assert.ok(entry.steps.some(s=>s.status==='Tested' && s.evidence.includes('dpl_7gjdfRFeLjqcPdVC52NkaEatugKA')))
 assert.ok(entry.steps.some(s=>s.status==='Blocked' && s.finding.includes('generated output')))
 assert.match(entry.next,/owner reconciliation/)
 assert.match(entry.next,/signed delivery\/read receipt/)
})


test('final-DOCX Gemini, source-archive, Gmail and crawler acceptance gates stay explicit', () => {
 const gemini=REA_SESSIONS.find(s=>s.id==='resume-gemini-final-docx-ats-review-2026-11-10')
 assert.ok(gemini)
 assert.equal(gemini.state,'Blocked')
 assert.match(gemini.next,/final-DOCX/)
 const source=REA_SESSIONS.find(s=>s.id==='whatsapp-oct17-source-archive-verification-2026-11-10')
 assert.ok(source)
 assert.ok(source.steps.some(s=>s.status==='Tested' && s.finding.includes('27,724 bytes')))
 assert.ok(source.steps.some(s=>s.status==='Blocked' && s.finding.includes('R2 key')))
 const gmail=REA_SESSIONS.find(s=>s.id==='gmail-poke-background-update-2026-11-10')
 assert.ok(gmail)
 assert.equal(gmail.state,'Blocked')
 assert.match(gmail.limits,/No live Gmail API call/)
 const crawler=REA_SESSIONS.find(s=>s.id==='contract-crawler-work-type-postmerge-run-2026-11-10')
 assert.ok(crawler)
 assert.equal(crawler.state,'Blocked')
 assert.match(crawler.limits,/post-classifier crawl/)
})


test('Oct 17 public REA record avoids private source locators', () => {
 const entry = REA_SESSIONS.find(s => s.id === 'whatsapp-oct17-source-archive-verification-2026-11-10')
 assert.ok(entry)
 const publicRecord = JSON.stringify(entry)
 assert.match(publicRecord, /private Library(?: resume)? archive/)
 assert.doesNotMatch(publicRecord, /\\b[a-f0-9]{16}\\b/i)
 assert.doesNotMatch(publicRecord, /\\b\\d{13}\\b/)
 assert.doesNotMatch(publicRecord, /\\.docx/i)
})


test('11 Nov WhatsApp profile-gap and Gmail Auth quota REA records remain traceable', () => {
  const whatsapp = REA_SESSIONS.find(s => s.id === 'whatsapp-profile-gap-fill-2026-11-11')
  assert.ok(whatsapp, 'WhatsApp profile-gap REA entry missing')
  assert.equal(whatsapp.state, 'Blocked')
  assert.ok(whatsapp.steps.some(s => s.status === 'Implemented' && s.label.includes('pending-state resolver')))
  assert.ok(whatsapp.steps.some(s => s.status === 'Blocked' && s.finding.includes('No live model call')))
  assert.ok(whatsapp.sources.some(s => s.path === 'docs/research/whatsapp-profile-gap-fill-2026-11-11.md'))

  const gmail = REA_SESSIONS.find(s => s.id === 'gmail-supabase-auth-egress-quota-2026-11-11')
  assert.ok(gmail, 'Gmail Supabase Auth quota REA entry missing')
  assert.equal(gmail.state, 'Blocked')
  assert.match(gmail.limits, /No mailbox contents/)
  assert.ok(gmail.steps.some(s => s.status === 'Blocked' && s.finding.includes('upgrade the plan or remove spend caps')))
  assert.ok(gmail.sources.some(s => s.path === 'docs/research/gmail-supabase-egress-quota-2026-11-11.md'))
})


test('11 Nov WhatsApp fallback and contract classifier REA records remain traceable', () => {
  const wa = REA_SESSIONS.find(s => s.id === 'whatsapp-fallback-boundary-tests-2026-11-11')
  assert.ok(wa)
  assert.equal(wa.state, 'Implemented, verification pending')
  assert.ok(wa.steps.some(s => s.status === 'Pending' && s.finding.includes('queued')))
  assert.ok(wa.sources.some(s => s.path === 'scripts/tests/whatsapp-resume-contract.test.mjs'))

  const app = REA_SESSIONS.find(s => s.id === 'contract-classifier-precision-2026-11-11')
  assert.ok(app)
  assert.equal(app.state, 'Implemented, verification pending')
  assert.ok(app.steps.some(s => s.status === 'Pending' && s.finding.includes('queued')))
  assert.ok(app.sources.some(s => s.path === 'src/lib/contract-jobs.ts'))
})


test('12 Nov 16:16 completion REA entry records source limits and release gates', () => {
  const entry = REA_SESSIONS.find(s => s.id === 'mfit-completion-watch-2026-11-12-1616z')
  assert.ok(entry, '16:16 completion REA entry missing')
  assert.equal(entry.state, 'Blocked')
  assert.match(entry.limits, /No private token/)
  assert.ok(entry.steps.some(s => s.finding.includes('no linked WhatsApp number')))
  assert.ok(entry.steps.some(s => s.finding.includes('HTTP 402 exceed_egress_quota')))
  assert.ok(entry.sources.some(s => s.url?.endsWith('/pull/321')))
})


test('REA entries use only supported area, method, state and step-status values', () => {
  const areas = new Set(['gmail', 'applications', 'resume', 'kompas', 'platform'])
  const methods = new Set(['Public reference review', 'Source and artifact analysis', 'REA tool attempt'])
  const states = new Set(['Research mapped', 'Implemented, verification pending', 'Deployed, verification pending', 'Blocked'])
  const stepStates = new Set(['Observed', 'Implemented', 'Tested', 'Pending', 'Blocked'])
  for (const entry of REA_SESSIONS) {
    assert.ok(areas.has(entry.area), \`unsupported REA area: \${entry.id}\`)
    assert.ok(methods.has(entry.method), \`unsupported REA method: \${entry.id}\`)
    assert.ok(states.has(entry.state), \`unsupported REA state: \${entry.id}\`)
    for (const step of entry.steps) assert.ok(stepStates.has(step.status), \`unsupported REA step status: \${entry.id}/\${step.label}\`)
  }
})

test('current Oct 17 evidence recheck contains no private source locator', () => {
  const entry = REA_SESSIONS.find(s => s.id === 'whatsapp-incident-evidence-recheck-2026-11-12')
  assert.ok(entry)
  const serialized = JSON.stringify(entry)
  assert.match(serialized, /path not found/i)
  assert.doesNotMatch(serialized, /@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /[a-f0-9]{64}/i)
  assert.doesNotMatch(serialized, /J_Eshwar_44|Resume_Inventory\.csv|1a1464393628992f|\.docx/i)
  const checkpoint = REA_SESSIONS.find(s => s.id === 'mfit-continuation-restack-2026-11-12-1955z')
  assert.ok(checkpoint)
  assert.equal(checkpoint.state, 'Implemented, verification pending')
})

test('public incident handoff documents omit private account and source locators', () => {
  const paths = [
    'docs/completion-watch.md',
    'docs/research/whatsapp-resume-acceptance-2026-11-10.md',
    'docs/whatsapp-kompas.md'
  ]
  const text = paths.map(p => readFileSync(path.join(root, p), 'utf8')).join('\n')
  assert.doesNotMatch(text, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(text, /1a1464393628992f|J_Eshwar_44|Resume_Inventory\.csv|aaa10a967b98cfed74d00b9529a95da074d6b4a6e704f1276c7e1b0d53cc7712/i)
})
