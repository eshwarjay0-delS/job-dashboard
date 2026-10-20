// TEKsystems' Phenom widget, read offline from a saved page of its answer (12 of the 1,054 IT jobs, trimmed).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { teksystems, readPage } = await import('../../src/lib/crawl/portals/teksystems.ts')
const { collectJobs } = await import('../../src/lib/crawl/collect.ts')
const page0 = readFileSync(new URL('../fixtures/crawl/teksystems-page0.json', import.meta.url), 'utf8')

test('a page of the answer is read as jobs: title, address built from the sequence number, place, engagement, date, summary', () => {
  const { jobs, total } = readPage(page0)
  assert.equal(total, 1054)
  assert.equal(jobs.length, 12)
  assert.deepEqual({ ...jobs[0], description: undefined }, {
    title: 'Analyst - Facilities', url: 'https://careers.teksystems.com/us/en/job/TESYUSJP006334643ENUS/Analyst-Facilities',
    location: 'Saint Louis, Missouri, USA', engagement: 'Contractor', postedAt: '2026-10-07T18:30:55.701+0000', description: undefined,
  })
  assert.match(jobs[0].description, /^Description\. Provide Level 3 product support leadership/, 'the opening of the posting first')
  assert.match(jobs[0].description, /\nJoin us as an Analyst - Facilities/, 'then the site\'s own summary')
  assert.equal(jobs[2].url, 'https://careers.teksystems.com/us/en/job/TESYUSJP006317266ENUS/Implementations-Network-Engineer-II')
  for (const j of jobs) {
    assert.match(j.url, /^https:\/\/careers\.teksystems\.com\/us\/en\/job\/TESYUS[A-Z0-9]+\/[A-Za-z0-9-]+$/)
    assert.ok(!/<|&[a-z]+;/.test(j.title))
  }
  assert.deepEqual(readPage('{}'), { jobs: [], total: 0 })
})

test('the board is read 100 at a time through the runner\'s fetch until its own count, with the IT filter, and nothing is asked twice', async () => {
  const asked = []
  const get = async (url, init) => {
    const body = JSON.parse(init.body)
    asked.push({ url, method: init.method, from: body.from, size: body.size, cats: body.selected_fields.category.length })
    const rows = JSON.parse(page0).refineSearch.data.jobs.map((j, i) => ({ ...j, jobSeqNo: `P${body.from}J${i}`, title: `${j.title} ${body.from}` }))
    return JSON.stringify({ refineSearch: { totalHits: 230, data: { jobs: body.from >= 200 ? rows.slice(0, 3) : rows } } })
  }
  const jobs = await collectJobs(teksystems, get)
  assert.deepEqual(asked.map(a => a.from), [0, 100, 200])
  assert.ok(asked.every(a => a.url === 'https://careers.teksystems.com/widgets' && a.method === 'POST' && a.size === 100 && a.cats === 10))
  assert.equal(jobs.length, 12 + 12 + 3)
  assert.equal(new Set(jobs.map(j => j.url)).size, jobs.length)
})

test('a board that answers nothing ends the read at once', async () => {
  let calls = 0
  const jobs = await collectJobs(teksystems, async () => { calls++; return JSON.stringify({ refineSearch: { totalHits: 5000, data: { jobs: [] } } }) })
  assert.equal(calls, 1)
  assert.deepEqual(jobs, [])
})
