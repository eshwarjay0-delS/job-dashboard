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
