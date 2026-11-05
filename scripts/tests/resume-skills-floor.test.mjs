import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

function skillsFloorTerms(scoreKws, floor, already, isCertification) {
  return scoreKws.filter(k => floor.has(k) && !already.has(k) && !isCertification(k))
}

const cert = (k) => k === 'cissp'

test('the skills line names a missing job-post term and never a certification, twenty folds', () => {
  const src = readFileSync(new URL('../../src/lib/resume-skills-floor.ts', import.meta.url), 'utf8')
  assert.match(src, /floor\.has\(k\) && !already\.has\(k\) && !isCertification\(k\)/)
  const score = ['siem', 'pw-6000', 'cissp', 'splunk']
  const floor = new Set(score)
  const already = new Set(['splunk'])
  for (let fold = 0; fold < 20; fold++) {
    assert.deepEqual(skillsFloorTerms(score, floor, already, cert), ['siem', 'pw-6000'])
    assert.deepEqual(skillsFloorTerms(score, floor, new Set(), cert), ['siem', 'pw-6000', 'splunk'])
    assert.deepEqual(skillsFloorTerms(['cissp'], floor, new Set(), cert), [])
    assert.deepEqual(skillsFloorTerms(score, new Set(['siem']), new Set(), cert), ['siem'])
  }
})

test('the tailor floor uses that list and leaves the skills line in place afterwards', () => {
  const src = readFileSync(new URL('../../src/lib/tailor.ts', import.meta.url), 'utf8')
  assert.match(src, /skillsFloorTerms\(scoreKws, floorKws, cur\.afterKw, isCertification\)/)
  const after = src.indexOf('job-post terms on the skills line')
  const call = src.indexOf('removeUnsupportedRewrites(best.edits', after)
  assert.ok(call > after)
  assert.match(src.slice(call, call + 280), /keepSkills: true/)
})
