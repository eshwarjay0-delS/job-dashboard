// Motion Recruitment's contract board, read offline from the data its page hands to React (8 of 388 rows, recruiter
// details replaced by stand-ins). The cards the page draws are capped at 20; this data is what holds every job asked for.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { motion, readPage, flightText } = await import('../../src/lib/crawl/portals/motion.ts')
const { collectJobs } = await import('../../src/lib/crawl/collect.ts')
const html = readFileSync(new URL('../fixtures/crawl/motion-contract.html', import.meta.url), 'utf8')

test('the page\'s script pieces join into one text, and the data set is found in it by counting braces', () => {
  const text = flightText(html)
  assert.ok(text.includes('"dataSet":{') && text.includes('Stand-In Recruiter'))
  const { jobs, total, count } = readPage(html)
  assert.equal(total, 388); assert.equal(count, 8)
  assert.equal(jobs.length, 6, 'the six technology jobs; the two that are not are left out')
})

test('each job: title, its own address, place with how it is worked, engagement, pay per hour, date; nothing of the recruiter or the description', () => {
  const { jobs } = readPage(html)
  const lims = jobs.find(j => j.title === 'LIMS Developer-Analyst')
  assert.equal(lims.location, 'Thousand Oaks, California (Open to Remote)')
  assert.equal(lims.engagement, 'Contract')
  assert.equal(lims.payRange, '$61 - $80 per hour')
  assert.match(lims.url, /^https:\/\/motionrecruitment\.com\/tech-jobs\//)
  assert.match(lims.postedAt, /^20\d\d-\d\d-\d\dT/)
  assert.equal(jobs.find(j => /Senior Test Automation Engineer/.test(j.title)).location, 'Irving, TX', 'on-site is just the place')
  for (const j of jobs) {
    assert.deepEqual(Object.keys(j).sort(), ['engagement', 'location', 'payRange', 'postedAt', 'title', 'url'].filter(k => j[k] !== undefined).sort())
    assert.ok(!JSON.stringify(j).match(/recruiter|@|000-000/i), 'the recruiter who owns a job is never kept')
  }
  assert.deepEqual(readPage('<html></html>'), { jobs: [], total: 0, count: 0 })
})

test('the board is asked for 500 at a time until its own count: one request today', async () => {
  const asked = []
  const jobs = await collectJobs(motion, async (url) => { asked.push(url); return html })
  assert.deepEqual(asked, ['https://motionrecruitment.com/tech-jobs/contract?start=0&count=500'])
  assert.equal(jobs.length, 6)
  // A board larger than a page: the next start is asked for, and an empty answer ends it.
  const more = []
  await collectJobs(motion, async (url) => { more.push(url); return more.length === 1 ? html.replace('\\"total\\":388', '\\"total\\":900') : '<html></html>' })
  assert.deepEqual(more.map(u => new URL(u).searchParams.get('start')), ['0', '500'])
})
