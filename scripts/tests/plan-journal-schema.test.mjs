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
  assert.match(gmail.detail, /1,991/)
  assert.match(gmail.next, /CRON_SECRET/)
})
