import test from 'node:test'
import assert from 'node:assert/strict'
import { PLAN_JOURNAL, journalMarkdown } from '../../src/lib/plan-vision-journal.ts'

test('journal records use only supported fields so status edits cannot break builds', () => {
  const required = ['id','area','updated','title','approval','delivery','detail','evidence','next']
  const allowed = new Set([...required, 'commit'])
  for (const entry of PLAN_JOURNAL) {
    for (const key of Object.keys(entry)) assert.ok(allowed.has(key), `${entry.id}: unsupported ${key}`)
    for (const key of required) assert.ok(typeof entry[key] === 'string' && entry[key].trim(), `${entry.id}: missing ${key}`)
  }
})

test('all journal evidence survives the text export', () => {
  for (const entry of PLAN_JOURNAL) {
    assert.ok(journalMarkdown(entry.area).includes(`Evidence: ${entry.evidence}`), entry.id)
  }
  const chief = PLAN_JOURNAL.find(e => e.id === 'chief-phase3-briefable')
  assert.ok(chief.evidence.includes('READY for 16ff135'), 'retain the existing release evidence')
})


test('released work is not left in an implementation-only board state', () => {
  for (const id of ['inclusive-browser-desktop', 'jd-keyword-filter']) {
    const entry = PLAN_JOURNAL.find(item => item.id === id)
    assert.ok(entry, `${id}: missing journal entry`)
    assert.equal(entry.delivery, 'deployed', `${id}: release evidence exists but delivery is stale`)
  }
})

test('nov 5 handoff records name the 70 to 80 percent rule and close stale blockers', () => {
  const third = PLAN_JOURNAL.find(e => e.id === 'resume-tailor-quality-restoration-2026-11-04')
  assert.ok(third, 'quality restoration entry missing')
  assert.match(third.evidence, /70 to 80 percent/)
  assert.match(third.next, /not built/)
  const doctrine = PLAN_JOURNAL.find(e => e.id === 'resume-tailor-baseline-doctrine-2026-11-04')
  assert.ok(doctrine, 'baseline doctrine entry missing')
  assert.match(doctrine.detail, /PR 215/)
  assert.doesNotMatch(doctrine.next, /Build the 60-second/)
  const floor = PLAN_JOURNAL.find(e => e.id === 'resume-jd-skills-line-2026-10-29')
  assert.equal(floor.delivery, 'superseded')
  assert.match(floor.evidence, /90cdd1dd/)
  const kompas = PLAN_JOURNAL.find(e => e.id === 'whatsapp-kompas-setup-runtime-blocked-oct27')
  assert.equal(kompas.delivery, 'deployed')
  assert.match(kompas.evidence, /90cdd1dd/)
  assert.doesNotMatch(kompas.next, /Restore runnable checkout/)
})


test('Oct 17 WhatsApp source-boundary release remains traceable after deployment', () => {
  const entry = PLAN_JOURNAL.find(item => item.id === 'whatsapp-oct17-source-recovery-2026-11-10')
  assert.ok(entry, 'Oct 17 source-recovery journal entry missing')
  assert.equal(entry.delivery, 'deployed')
  assert.match(entry.evidence, /a66c108bff6175149c4aadd882ab11128445b8cc/)
  assert.match(entry.evidence, /dpl_7gjdfRFeLjqcPdVC52NkaEatugKA/)
  assert.match(entry.next, /owner reconciliation/i)
  assert.match(entry.next, /Meta message ID/)
})


test('approved final-DOCX Gemini review and current crawler/Gmail blockers remain traceable', () => {
  const gemini = PLAN_JOURNAL.find(e => e.id === 'resume-gemini-final-docx-ats-review-2026-11-10')
  assert.ok(gemini)
  assert.equal(gemini.approval, 'approved')
  assert.equal(gemini.delivery, 'blocked')
  assert.match(gemini.detail, /Give me ATS score/)
  assert.match(gemini.detail, /diagnostics only/)
  const source = PLAN_JOURNAL.find(e => e.id === 'whatsapp-oct17-source-archive-verification-2026-11-10')
  assert.ok(source)
  assert.match(source.detail, /exact digest retained privately/)
  assert.doesNotMatch(`${source.detail} ${source.evidence}`, /\\b[a-f0-9]{16}\\b/i)
  assert.doesNotMatch(`${source.detail} ${source.evidence}`, /\\b\\d{13}\\b/)
  assert.match(source.next, /owner reconciliation/i)
  const crawler = PLAN_JOURNAL.find(e => e.id === 'contract-crawler-work-type-postmerge-run-2026-11-10')
  assert.ok(crawler)
  assert.match(crawler.evidence, /6,818/)
  assert.match(crawler.evidence, /a66c108/)
  const gmail = PLAN_JOURNAL.find(e => e.id === 'gmail-poke-background-update-2026-11-10')
  assert.ok(gmail)
  assert.match(gmail.detail, /2,002/)
  assert.match(gmail.next, /CRON_SECRET/)
})


test('11 Nov completion-watch journal preserves the current WhatsApp and Gmail blockers', () => {
  const entry = PLAN_JOURNAL.find(e => e.id === 'mfit-completion-watch-2026-11-11-2015')
  assert.ok(entry, 'current completion-watch journal entry missing')
  assert.equal(entry.approval, 'approved')
  assert.equal(entry.delivery, 'in progress')
  assert.match(entry.detail, /70% raw overlap/)
  assert.match(entry.detail, /draft_parts_missing/)
  assert.match(entry.detail, /exceed_egress_quota/)
  assert.match(entry.next, /restack PR #296|Restack PR #296/i)
})


test('11 Nov WhatsApp fallback and contract classifier journal entries preserve exact pending gates', () => {
  const wa = PLAN_JOURNAL.find(e => e.id === 'mfit-whatsapp-fallback-boundary-tests-2026-11-11')
  assert.ok(wa)
  assert.equal(wa.approval, 'approved')
  assert.equal(wa.delivery, 'in progress')
  assert.match(wa.evidence, /fcee3fb6/)
  const app = PLAN_JOURNAL.find(e => e.id === 'mfit-contract-classifier-precision-2026-11-11')
  assert.ok(app)
  assert.equal(app.approval, 'approved')
  assert.equal(app.delivery, 'in progress')
  assert.match(app.evidence, /278d9b3f/)
})


test('12 Nov 16:16 completion checkpoint preserves live release and exact blockers', () => {
  const entry = PLAN_JOURNAL.find(e => e.id === 'mfit-completion-watch-2026-11-12-1616z')
  assert.ok(entry, '16:16 completion checkpoint missing')
  assert.equal(entry.approval, 'approved')
  assert.equal(entry.delivery, 'blocked')
  assert.match(entry.evidence, /6c82abf4b240de7c768916188794b8beaaaf3b10/)
  assert.match(entry.evidence, /exceed_egress_quota/)
  assert.match(entry.evidence, /KOMPAS_VERCEL_API_TOKEN/)
  assert.match(entry.next, /before any historical replay/)
})


test('current no-bypass instruction supersedes the earlier public skip-login request', () => {
  const correction = PLAN_JOURNAL.find(e => e.id === 'kompas-no-auth-bypass-current-instruction-2026-11-12-1955z')
  assert.ok(correction)
  assert.equal(correction.approval, 'approved')
  assert.match(correction.detail, /do not bypass access controls/i)
  const prior = PLAN_JOURNAL.find(e => e.id === 'skip-login-live-2026-11-12')
  assert.ok(prior)
  assert.match(prior.next, /Keep AUTH_DISABLED/i)
  assert.match(prior.next, /Do not set a synthetic-owner identity/i)
})

test('17 Oct current source-access recheck stays blocked and private-locator free', () => {
  const entry = PLAN_JOURNAL.find(e => e.id === 'whatsapp-incident-evidence-recheck-2026-11-12-1940')
  assert.ok(entry)
  const serialized = JSON.stringify(entry)
  assert.match(serialized, /path not found/i)
  assert.doesNotMatch(serialized, /@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  assert.doesNotMatch(serialized, /[a-f0-9]{64}/i)
  assert.doesNotMatch(serialized, /J_Eshwar_44|Resume_Inventory\.csv|1a1464393628992f|\.docx/i)
  const current = PLAN_JOURNAL.find(e => e.id === 'whatsapp-oct17-source-access-recheck-2026-11-12-1955z')
  assert.ok(current)
  assert.equal(current.delivery, 'blocked')
  assert.match(current.next, /do not replay or resend/i)
})
